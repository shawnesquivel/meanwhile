import { arch, platform } from "node:os";
import * as vscode from "vscode";
import type {
  MetricBeacon,
  MetricEvent,
  Sponsor,
  Surface,
} from "../../shared/contract";
import { routes } from "../../shared/contract";
import type { AuthService } from "./auth";
import { fetchJson } from "./http";
import { eventNonce } from "./ids";
import { dlog } from "./log";

const MAX_QUEUE = 200;
const FLUSH_INTERVAL_MS = 15_000;

/**
 * Fire-and-forget beacon sender with a small in-memory retry queue. Losing a
 * beacon costs cents, so the failure mode is "drop oldest", never "block the
 * editor" or "grow unbounded".
 */
export class MetricsClient {
  private queue: MetricBeacon[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly base: string,
    private readonly clientId: string,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.flush();
  }

  /** Build + enqueue a beacon for a served sponsor. */
  emit(
    event: MetricEvent,
    sponsor: Sponsor,
    surface: Surface,
    visibleMs?: number,
  ): void {
    this.enqueue({
      event,
      sponsorId: sponsor.sponsorId,
      campaignId: sponsor.campaignId,
      surface,
      clientId: this.clientId,
      sessionToken: sponsor.sessionToken,
      nonce: eventNonce(),
      ts: new Date().toISOString(),
      ...(visibleMs !== undefined ? { visibleMs } : {}),
      client: {
        os: platform(),
        arch: arch(),
        editor: vscode.env.appName,
        extVersion: vscode.extensions.getExtension(
          "shawnesquivel.meanwhile",
        )?.packageJSON?.version,
      },
    });
  }

  /** Enqueue a pre-built beacon (used by the loopback for webview events). */
  enqueue(beacon: MetricBeacon): void {
    this.queue.push(beacon);
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    // Clicks are precious — push them out immediately.
    if (beacon.event === "click" || beacon.event === "view_threshold_met") {
      void this.flush();
    }
  }

  private pending: Promise<void> | null = null;

  /** Drain the queue. Awaiting this always covers any in-flight drain too,
   *  so callers (dispose, tests) get a real completion signal. */
  flush(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.queue.length === 0) return Promise.resolve();
    this.pending = (async () => {
      try {
        while (this.queue.length > 0) {
          const beacon = this.queue[0];
          try {
            await this.auth.withAuth((bearer) =>
              fetchJson(this.base + routes.metrics(), {
                method: "POST",
                body: JSON.stringify(beacon),
                headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
                timeoutMs: 6000,
              }),
            );
            this.queue.shift();
          } catch (e) {
            // Leave the queue intact; the next interval retries. Nonces make
            // server-side duplicates impossible.
            dlog("metrics", "flush failed; will retry", {
              e: String(e),
              queued: this.queue.length,
            });
            break;
          }
        }
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }
}
