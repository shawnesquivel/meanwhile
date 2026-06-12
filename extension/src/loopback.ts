import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { join } from "node:path";
import * as vscode from "vscode";
import type { MetricEvent, Surface } from "../../shared/contract";
import { ALL_SURFACES, BILLABLE_EVENTS } from "../../shared/contract";
import { meanwhileDir } from "./config";
import { dlog } from "./log";
import type { MetricsClient } from "./metrics";
import { eventNonce } from "./ids";
import type { PortfolioService } from "./portfolio";

/**
 * Local bridge between patched webview bundles and the extension host.
 *
 * Webview JS cannot reach the backend (CSP) or the filesystem, so it talks to
 * 127.0.0.1:<port> instead. The port + token are persisted in
 * ~/.meanwhile/loopback.json; the webview patcher (M1e) inlines both into the
 * injected snippet. Binding prefers the persisted port so a patched bundle
 * keeps working across editor restarts without re-patching.
 */

const BASE_PORT = 48757;
const PORT_ATTEMPTS = 10;
const DISCOVERY_FILE = "loopback.json";

interface Discovery {
  port: number;
  token: string;
  pid: number;
  startedAtMs: number;
}

interface WebviewMetricBody {
  event?: string;
  sponsorId?: string;
  campaignId?: string;
  surface?: string;
  sessionToken?: string;
  visibleMs?: number;
  clickUrl?: string;
}

export class Loopback {
  private server: Server | null = null;
  port = 0;
  token = "";

  constructor(
    private readonly portfolio: PortfolioService,
    private readonly metrics: MetricsClient,
    private readonly clientId: string,
  ) {}

  private discoveryPath(): string {
    return join(meanwhileDir(), DISCOVERY_FILE);
  }

  private loadPersisted(): Discovery | null {
    try {
      const j = JSON.parse(
        readFileSync(this.discoveryPath(), "utf8"),
      ) as Discovery;
      return j && typeof j.port === "number" && typeof j.token === "string"
        ? j
        : null;
    } catch {
      return null;
    }
  }

  async start(): Promise<void> {
    const persisted = this.loadPersisted();
    this.token = persisted?.token || randomBytes(16).toString("base64url");

    const candidates: number[] = [];
    if (persisted?.port) candidates.push(persisted.port);
    for (let i = 0; i < PORT_ATTEMPTS; i++) {
      const p = BASE_PORT + i;
      if (!candidates.includes(p)) candidates.push(p);
    }

    for (const port of candidates) {
      const ok = await this.tryListen(port);
      if (ok) {
        this.port = port;
        break;
      }
    }
    if (!this.port) {
      dlog("loopback", "no port available; webview surface disabled");
      return;
    }

    const d: Discovery = {
      port: this.port,
      token: this.token,
      pid: process.pid,
      startedAtMs: Date.now(),
    };
    try {
      writeFileSync(this.discoveryPath(), JSON.stringify(d, null, 2) + "\n", {
        mode: 0o600,
      });
    } catch (e) {
      dlog("loopback", "discovery write failed", { e: String(e) });
    }
    dlog("loopback", "listening", { port: this.port });
  }

  private tryListen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const srv = createServer((req, res) => void this.route(req, res));
      srv.once("error", () => resolve(false));
      srv.listen(port, "127.0.0.1", () => {
        this.server = srv;
        resolve(true);
      });
    });
  }

  dispose(): void {
    this.server?.close();
    this.server = null;
  }

  // --- routing ---------------------------------------------------------

  private async route(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
    // CORS first: webview origins are opaque (vscode-webview://…).
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === "/health") {
      this.json(res, 200, { ok: true });
      return;
    }
    if (url.searchParams.get("t") !== this.token) {
      this.json(res, 403, { error: "bad token" });
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/v1/sponsors") {
        const p = this.portfolio.portfolio;
        this.json(res, 200, {
          sponsors: p?.sponsors ?? [],
          rotationIntervalMs: p?.rotationIntervalMs ?? 30_000,
          viewThresholdMs: p?.viewThresholdMs ?? 3_000,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/metrics") {
        const body = (await this.readJson(req)) as WebviewMetricBody;
        const accepted = this.forwardMetric(body);
        this.json(res, accepted ? 200 : 400, { ok: accepted });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/click") {
        const body = (await this.readJson(req)) as WebviewMetricBody;
        const opened = await this.handleClick(body);
        this.json(res, opened ? 200 : 400, { ok: opened });
        return;
      }
      this.json(res, 404, { error: "not found" });
    } catch (e) {
      dlog("loopback", "route error", { path: url.pathname, e: String(e) });
      this.json(res, 500, { error: "internal" });
    }
  }

  private forwardMetric(body: WebviewMetricBody): boolean {
    const event = body.event as MetricEvent;
    const surface = body.surface as Surface;
    if (!BILLABLE_EVENTS.includes(event)) return false;
    if (!ALL_SURFACES.includes(surface)) return false;
    if (!body.sponsorId || !body.campaignId) return false;
    this.metrics.enqueue({
      event,
      sponsorId: body.sponsorId,
      campaignId: body.campaignId,
      surface,
      clientId: this.clientId,
      sessionToken: body.sessionToken ?? "",
      nonce: eventNonce(),
      ts: new Date().toISOString(),
      ...(typeof body.visibleMs === "number"
        ? { visibleMs: body.visibleMs }
        : {}),
    });
    return true;
  }

  private async handleClick(body: WebviewMetricBody): Promise<boolean> {
    const raw = (body.clickUrl || "").trim();
    if (!/^https:\/\//i.test(raw)) return false;
    this.forwardMetric({ ...body, event: "click" });
    await vscode.env.openExternal(vscode.Uri.parse(raw));
    return true;
  }

  // --- helpers ----------------------------------------------------------

  private json(res: ServerResponse, status: number, body: unknown): void {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": buf.length,
    });
    res.end(buf);
  }

  private readJson(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > 64 * 1024) {
          reject(new Error("body too large"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }
}
