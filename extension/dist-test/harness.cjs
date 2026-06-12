"use strict";

// test/harness.ts
var import_node_fs6 = require("node:fs");
var import_node_os3 = require("node:os");
var import_node_path6 = require("node:path");

// test/vscode-stub.ts
var openedUrls = [];
var env = {
  appName: "harness",
  openExternal: async (uri) => {
    openedUrls.push(uri.toString());
    return true;
  }
};
var Uri = {
  parse: (s) => ({ toString: () => s })
};
var extensions = {
  getExtension: (_id) => ({ packageJSON: { version: "0.0.0-test" } })
};
var MemorySecrets = class {
  constructor() {
    this.m = /* @__PURE__ */ new Map();
  }
  async get(k) {
    return this.m.get(k);
  }
  async store(k, v) {
    this.m.set(k, v);
  }
  async delete(k) {
    this.m.delete(k);
  }
};

// src/log.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");

// src/config.ts
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_node_fs = require("node:fs");
function meanwhileDir() {
  const dir = (0, import_node_path.join)((0, import_node_os.homedir)(), ".meanwhile");
  try {
    if (!(0, import_node_fs.existsSync)(dir)) (0, import_node_fs.mkdirSync)(dir, { recursive: true });
  } catch {
  }
  return dir;
}

// src/log.ts
var debugEnabled = false;
function setDebug(on) {
  debugEnabled = on;
}
function dlog(scope, event, data) {
  if (!debugEnabled) return;
  try {
    const line = JSON.stringify({
      t: (/* @__PURE__ */ new Date()).toISOString(),
      scope,
      event,
      ...data !== void 0 ? { data } : {}
    }) + "\n";
    (0, import_node_fs2.appendFileSync)((0, import_node_path2.join)(meanwhileDir(), "debug.log"), line, "utf8");
  } catch {
  }
}

// ../shared/contract.ts
var API_VERSION = "v1";
var ALL_SURFACES = [
  "cc_webview",
  "cc_cli_statusline",
  "cc_cli_spinner",
  "codex_cli",
  "codex_webview"
];
var BILLABLE_EVENTS = [
  "impression",
  "viewable",
  "view_tick",
  "view_threshold_met",
  "click",
  "error_impression"
];
var P = `/api/${API_VERSION}`;
var routes = {
  portfolio: (surface, clientId) => `${P}/portfolio?surface=${encodeURIComponent(surface)}&client_id=${encodeURIComponent(clientId)}`,
  metrics: () => `${P}/metrics`,
  earnings: () => `${P}/earnings`,
  authStart: () => `${P}/ext/auth/start`,
  authPoll: (state) => `${P}/ext/auth/poll?state=${encodeURIComponent(state)}`,
  authRefresh: () => `${P}/ext/auth/refresh`,
  authSignout: () => `${P}/ext/auth/signout`
};

// src/http.ts
var HttpError = class extends Error {
  constructor(status, bodyText) {
    super(`HTTP ${status}`);
    this.status = status;
    this.bodyText = bodyText;
  }
};
var DEFAULT_TIMEOUT_MS = 1e4;
async function fetchJson(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(
    () => ctl.abort(),
    init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        ...init?.headers ?? {}
      }
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text);
    return JSON.parse(text);
  } catch (e) {
    if (!(e instanceof HttpError)) dlog("http", "fetch failed", { url, e: String(e) });
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// src/auth.ts
var SECRET_KEY = "meanwhile.tokens.v1";
var AuthService = class {
  constructor(secrets, base, clientId) {
    this.secrets = secrets;
    this.base = base;
    this.clientId = clientId;
    this.tokens = null;
    this.refreshing = null;
  }
  async load() {
    try {
      const raw = await this.secrets.get(SECRET_KEY);
      if (raw) this.tokens = JSON.parse(raw);
    } catch {
      this.tokens = null;
    }
  }
  get signedIn() {
    return this.tokens !== null;
  }
  get accessToken() {
    return this.tokens?.accessToken ?? null;
  }
  async persist(t) {
    this.tokens = t;
    if (t) await this.secrets.store(SECRET_KEY, JSON.stringify(t));
    else await this.secrets.delete(SECRET_KEY);
  }
  /** Full interactive sign-in. Returns true when tokens were obtained. */
  async signIn(progress) {
    const start = await fetchJson(
      this.base + routes.authStart(),
      { method: "POST", body: JSON.stringify({ clientId: this.clientId }) }
    );
    dlog("auth", "start ok", { state: start.state.slice(0, 6) + "\u2026" });
    progress?.("Opening browser\u2026");
    await env.openExternal(Uri.parse(start.authUrl));
    const deadline = Date.now() + start.expiresInSec * 1e3;
    progress?.("Waiting for you to finish signing in\u2026");
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2e3));
      let poll;
      try {
        poll = await fetchJson(
          this.base + routes.authPoll(start.state)
        );
      } catch (e) {
        dlog("auth", "poll error (retrying)", { e: String(e) });
        continue;
      }
      if (poll.status === "complete" && poll.accessToken && poll.refreshToken) {
        await this.persist({
          accessToken: poll.accessToken,
          refreshToken: poll.refreshToken
        });
        dlog("auth", "sign-in complete");
        return true;
      }
      if (poll.status === "expired") break;
    }
    dlog("auth", "sign-in expired/abandoned");
    return false;
  }
  /** Rotate the refresh token. Single-flight so concurrent 401s refresh once. */
  async refresh() {
    if (!this.tokens) return false;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const r = await fetchJson(
          this.base + routes.authRefresh(),
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: this.tokens?.refreshToken })
          }
        );
        await this.persist({
          accessToken: r.accessToken,
          refreshToken: r.refreshToken
        });
        dlog("auth", "refresh ok");
        return true;
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 400)) {
          await this.persist(null);
        }
        dlog("auth", "refresh failed", { e: String(e) });
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }
  async signOut() {
    const rt = this.tokens?.refreshToken;
    await this.persist(null);
    if (!rt) return;
    try {
      await fetchJson(this.base + routes.authSignout(), {
        method: "POST",
        body: JSON.stringify({ refreshToken: rt })
      });
    } catch (e) {
      dlog("auth", "signout beacon failed (local state cleared)", {
        e: String(e)
      });
    }
  }
  /**
   * Run an authenticated request; on 401, refresh once and retry. Falls back
   * to an anonymous call when signed out (portfolio supports both).
   */
  async withAuth(fn) {
    if (!this.tokens) return fn(null);
    try {
      return await fn(this.tokens.accessToken);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        const ok = await this.refresh();
        return fn(ok ? this.tokens?.accessToken ?? null : null);
      }
      throw e;
    }
  }
};

// src/metrics.ts
var import_node_os2 = require("node:os");

// src/ids.ts
var import_node_crypto = require("node:crypto");
var import_node_fs3 = require("node:fs");
var import_node_path3 = require("node:path");
function deviceId() {
  const file = (0, import_node_path3.join)(meanwhileDir(), "device.json");
  try {
    const j = JSON.parse((0, import_node_fs3.readFileSync)(file, "utf8"));
    if (j && typeof j.clientId === "string" && j.clientId.length >= 8) {
      return j.clientId;
    }
  } catch {
  }
  const id = `dev_${(0, import_node_crypto.randomBytes)(12).toString("base64url")}`;
  try {
    (0, import_node_fs3.writeFileSync)(file, JSON.stringify({ clientId: id }, null, 2) + "\n", {
      mode: 384
    });
  } catch {
  }
  return id;
}
function eventNonce() {
  return (0, import_node_crypto.randomUUID)();
}

// src/metrics.ts
var MAX_QUEUE = 200;
var FLUSH_INTERVAL_MS = 15e3;
var MetricsClient = class {
  constructor(auth, base, clientId) {
    this.auth = auth;
    this.base = base;
    this.clientId = clientId;
    this.queue = [];
    this.timer = null;
    this.pending = null;
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.flush();
  }
  /** Build + enqueue a beacon for a served sponsor. */
  emit(event, sponsor, surface, visibleMs) {
    this.enqueue({
      event,
      sponsorId: sponsor.sponsorId,
      campaignId: sponsor.campaignId,
      surface,
      clientId: this.clientId,
      sessionToken: sponsor.sessionToken,
      nonce: eventNonce(),
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      ...visibleMs !== void 0 ? { visibleMs } : {},
      client: {
        os: (0, import_node_os2.platform)(),
        arch: (0, import_node_os2.arch)(),
        editor: env.appName,
        extVersion: extensions.getExtension(
          "shawnesquivel.meanwhile"
        )?.packageJSON?.version
      }
    });
  }
  /** Enqueue a pre-built beacon (used by the loopback for webview events). */
  enqueue(beacon) {
    this.queue.push(beacon);
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    if (beacon.event === "click" || beacon.event === "view_threshold_met") {
      void this.flush();
    }
  }
  /** Drain the queue. Awaiting this always covers any in-flight drain too,
   *  so callers (dispose, tests) get a real completion signal. */
  flush() {
    if (this.pending) return this.pending;
    if (this.queue.length === 0) return Promise.resolve();
    this.pending = (async () => {
      try {
        while (this.queue.length > 0) {
          const beacon = this.queue[0];
          try {
            await this.auth.withAuth(
              (bearer) => fetchJson(this.base + routes.metrics(), {
                method: "POST",
                body: JSON.stringify(beacon),
                headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
                timeoutMs: 6e3
              })
            );
            this.queue.shift();
          } catch (e) {
            dlog("metrics", "flush failed; will retry", {
              e: String(e),
              queued: this.queue.length
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
};

// src/portfolio.ts
var import_node_fs4 = require("node:fs");
var import_node_path4 = require("node:path");
var SPONSOR_CACHE_FILE = "sponsors.json";
var PortfolioService = class {
  constructor(auth, base, clientId) {
    this.auth = auth;
    this.base = base;
    this.clientId = clientId;
    this.current = null;
    this.fetchedAtMs = 0;
  }
  get portfolio() {
    return this.current;
  }
  get stale() {
    if (!this.current) return true;
    return Date.now() - this.fetchedAtMs > this.current.ttlMs;
  }
  /** The sponsor for "now": time-slot rotation through the queue so every
   *  surface shows the same line at the same moment without coordination. */
  currentSponsor() {
    const p = this.current;
    if (!p || p.sponsors.length === 0) return null;
    const slot = Math.floor(Date.now() / Math.max(p.rotationIntervalMs, 5e3));
    return p.sponsors[slot % p.sponsors.length];
  }
  async refresh(surface = "cc_webview") {
    try {
      const p = await this.auth.withAuth(
        (bearer) => fetchJson(
          this.base + routes.portfolio(surface, this.clientId),
          {
            headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
          }
        )
      );
      this.current = p;
      this.fetchedAtMs = Date.now();
      this.writeCliCache(p);
      dlog("portfolio", "refreshed", {
        n: p.sponsors.length,
        signedIn: this.auth.signedIn
      });
      return p;
    } catch (e) {
      dlog("portfolio", "refresh failed", { e: String(e) });
      return null;
    }
  }
  /** Mirror the latest portfolio for out-of-process CLI surfaces. */
  writeCliCache(p) {
    const file = {
      updatedAtMs: Date.now(),
      ttlMs: p.ttlMs,
      rotationIntervalMs: p.rotationIntervalMs,
      viewThresholdMs: p.viewThresholdMs,
      sponsors: p.sponsors
    };
    try {
      (0, import_node_fs4.writeFileSync)(
        (0, import_node_path4.join)(meanwhileDir(), SPONSOR_CACHE_FILE),
        JSON.stringify(file, null, 2) + "\n",
        { mode: 384 }
      );
    } catch (e) {
      dlog("portfolio", "cli cache write failed", { e: String(e) });
    }
  }
};

// src/loopback.ts
var import_node_crypto2 = require("node:crypto");
var import_node_fs5 = require("node:fs");
var import_node_http = require("node:http");
var import_node_path5 = require("node:path");
var BASE_PORT = 48757;
var PORT_ATTEMPTS = 10;
var DISCOVERY_FILE = "loopback.json";
var Loopback = class {
  constructor(portfolio, metrics, clientId) {
    this.portfolio = portfolio;
    this.metrics = metrics;
    this.clientId = clientId;
    this.server = null;
    this.port = 0;
    this.token = "";
  }
  discoveryPath() {
    return (0, import_node_path5.join)(meanwhileDir(), DISCOVERY_FILE);
  }
  loadPersisted() {
    try {
      const j = JSON.parse(
        (0, import_node_fs5.readFileSync)(this.discoveryPath(), "utf8")
      );
      return j && typeof j.port === "number" && typeof j.token === "string" ? j : null;
    } catch {
      return null;
    }
  }
  async start() {
    const persisted = this.loadPersisted();
    this.token = persisted?.token || (0, import_node_crypto2.randomBytes)(16).toString("base64url");
    const candidates = [];
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
    const d = {
      port: this.port,
      token: this.token,
      pid: process.pid,
      startedAtMs: Date.now()
    };
    try {
      (0, import_node_fs5.writeFileSync)(this.discoveryPath(), JSON.stringify(d, null, 2) + "\n", {
        mode: 384
      });
    } catch (e) {
      dlog("loopback", "discovery write failed", { e: String(e) });
    }
    dlog("loopback", "listening", { port: this.port });
  }
  tryListen(port) {
    return new Promise((resolve) => {
      const srv = (0, import_node_http.createServer)((req, res) => void this.route(req, res));
      srv.once("error", () => resolve(false));
      srv.listen(port, "127.0.0.1", () => {
        this.server = srv;
        resolve(true);
      });
    });
  }
  dispose() {
    this.server?.close();
    this.server = null;
  }
  // --- routing ---------------------------------------------------------
  async route(req, res) {
    const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
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
          rotationIntervalMs: p?.rotationIntervalMs ?? 3e4,
          viewThresholdMs: p?.viewThresholdMs ?? 3e3
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/metrics") {
        const body = await this.readJson(req);
        const accepted = this.forwardMetric(body);
        this.json(res, accepted ? 200 : 400, { ok: accepted });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/click") {
        const body = await this.readJson(req);
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
  forwardMetric(body) {
    const event = body.event;
    const surface = body.surface;
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
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      ...typeof body.visibleMs === "number" ? { visibleMs: body.visibleMs } : {}
    });
    return true;
  }
  async handleClick(body) {
    const raw = (body.clickUrl || "").trim();
    if (!/^https:\/\//i.test(raw)) return false;
    this.forwardMetric({ ...body, event: "click" });
    await env.openExternal(Uri.parse(raw));
    return true;
  }
  // --- helpers ----------------------------------------------------------
  json(res, status, body) {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": buf.length
    });
    res.end(buf);
  }
  readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
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
};

// test/harness.ts
var BASE = (process.env.MEANWHILE_BASE || "http://localhost:3100").replace(
  /\/+$/,
  ""
);
var failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " \u2014 " + JSON.stringify(detail)}`);
  if (!ok) failures++;
}
async function json(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return await r.json();
}
async function main() {
  setDebug(true);
  const clientId = deviceId();
  const secrets = new MemorySecrets();
  const auth = new AuthService(
    secrets,
    BASE,
    clientId
  );
  await auth.load();
  const portfolio = new PortfolioService(auth, BASE, clientId);
  const anon = await portfolio.refresh("cc_webview");
  check("anon portfolio served", (anon?.sponsors.length ?? 0) > 0);
  check(
    "anon portfolio is demo-only",
    anon?.sponsors.every((s) => s.demo === true) ?? false,
    anon?.sponsors.map((s) => s.demo)
  );
  const tokens = await json(
    `${BASE}/api/v1/ext/auth/dev-login`,
    { method: "POST" }
  );
  await secrets.store("meanwhile.tokens.v1", JSON.stringify(tokens));
  await auth.load();
  check("tokens loaded \u2192 signedIn", auth.signedIn);
  const before = await json(
    `${BASE}/api/v1/earnings`,
    { headers: { authorization: `Bearer ${tokens.accessToken}` } }
  );
  const signed = await portfolio.refresh("cc_cli_statusline");
  check("signed-in portfolio served", (signed?.sponsors.length ?? 0) > 0);
  check(
    "signed-in portfolio non-demo",
    signed?.sponsors.every((s) => !s.demo) ?? false
  );
  check("balances present", signed?.balances != null);
  const cache = JSON.parse(
    (0, import_node_fs6.readFileSync)((0, import_node_path6.join)((0, import_node_os3.homedir)(), ".meanwhile", "sponsors.json"), "utf8")
  );
  check("CLI cache written", cache.sponsors.length > 0);
  check("rotation picks a sponsor", portfolio.currentSponsor() !== null);
  const metrics = new MetricsClient(auth, BASE, clientId);
  const loop = new Loopback(portfolio, metrics, clientId);
  await loop.start();
  check("loopback listening", loop.port > 0);
  const lb = `http://127.0.0.1:${loop.port}`;
  const health = await json(`${lb}/health`);
  check("loopback /health", health.ok);
  const bad = await fetch(`${lb}/v1/sponsors?t=WRONG`);
  check("loopback rejects bad token", bad.status === 403);
  const sp = await json(
    `${lb}/v1/sponsors?t=${loop.token}`
  );
  check("loopback serves sponsors", sp.sponsors.length > 0);
  const s0 = sp.sponsors[0];
  const beat = await json(
    `${lb}/v1/metrics?t=${loop.token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "view_threshold_met",
        sponsorId: s0.sponsorId,
        campaignId: s0.campaignId,
        surface: "cc_webview",
        sessionToken: s0.sessionToken,
        visibleMs: 3200
      })
    }
  );
  check("loopback accepts metric", beat.ok);
  const click = await json(
    `${lb}/v1/click?t=${loop.token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "click",
        sponsorId: s0.sponsorId,
        campaignId: s0.campaignId,
        surface: "cc_webview",
        sessionToken: s0.sessionToken,
        clickUrl: s0.clickUrl
      })
    }
  );
  check("loopback click ok", click.ok);
  check("click opened browser (stub)", openedUrls.length === 1, openedUrls);
  await metrics.flush();
  const after = await json(
    `${BASE}/api/v1/earnings`,
    { headers: { authorization: `Bearer ${auth.accessToken}` } }
  );
  const delta = Math.round(
    (parseFloat(after.lifetimeUsd) - parseFloat(before.lifetimeUsd)) * 100
  ) / 100;
  check("earnings delta == $0.51", delta === 0.51, {
    before: before.lifetimeUsd,
    after: after.lifetimeUsd,
    delta
  });
  const refreshed = await auth.refresh();
  check("refresh rotates", refreshed && auth.signedIn);
  await auth.signOut();
  check("signout clears", !auth.signedIn);
  loop.dispose();
  metrics.dispose();
  console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("harness crashed:", e);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vdGVzdC9oYXJuZXNzLnRzIiwgIi4uL3Rlc3QvdnNjb2RlLXN0dWIudHMiLCAiLi4vc3JjL2xvZy50cyIsICIuLi9zcmMvY29uZmlnLnRzIiwgIi4uLy4uL3NoYXJlZC9jb250cmFjdC50cyIsICIuLi9zcmMvaHR0cC50cyIsICIuLi9zcmMvYXV0aC50cyIsICIuLi9zcmMvbWV0cmljcy50cyIsICIuLi9zcmMvaWRzLnRzIiwgIi4uL3NyYy9wb3J0Zm9saW8udHMiLCAiLi4vc3JjL2xvb3BiYWNrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gXCJub2RlOm9zXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgTWVtb3J5U2VjcmV0cywgb3BlbmVkVXJscyB9IGZyb20gXCIuL3ZzY29kZS1zdHViXCI7XG5pbXBvcnQgeyBzZXREZWJ1ZyB9IGZyb20gXCIuLi9zcmMvbG9nXCI7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gXCIuLi9zcmMvYXV0aFwiO1xuaW1wb3J0IHsgTWV0cmljc0NsaWVudCB9IGZyb20gXCIuLi9zcmMvbWV0cmljc1wiO1xuaW1wb3J0IHsgUG9ydGZvbGlvU2VydmljZSB9IGZyb20gXCIuLi9zcmMvcG9ydGZvbGlvXCI7XG5pbXBvcnQgeyBMb29wYmFjayB9IGZyb20gXCIuLi9zcmMvbG9vcGJhY2tcIjtcbmltcG9ydCB7IGRldmljZUlkIH0gZnJvbSBcIi4uL3NyYy9pZHNcIjtcblxuLyoqXG4gKiBIZWFkbGVzcyBpbnRlZ3JhdGlvbiB0ZXN0IGZvciB0aGUgTTFiIHNlcnZpY2UgbGF5ZXIsIHJ1biBhZ2FpbnN0IGEgbGl2ZVxuICogYmFja2VuZCAoTUVBTldISUxFX0JBU0UsIGRlZmF1bHQgaHR0cDovL2xvY2FsaG9zdDozMTAwKS4gRXhlcmNpc2VzOlxuICogICBhbm9ueW1vdXMgcG9ydGZvbGlvIFx1MjE5MiBkZXYtbG9naW4gdG9rZW5zIFx1MjE5MiBzaWduZWQtaW4gcG9ydGZvbGlvIFx1MjE5MiBDTEkgY2FjaGVcbiAqICAgXHUyMTkyIGxvb3BiYWNrIHNwb25zb3JzL21ldHJpY3MvY2xpY2sgXHUyMTkyIGJlYWNvbiBmbHVzaCBcdTIxOTIgZWFybmluZ3MgZGVsdGEuXG4gKi9cblxuY29uc3QgQkFTRSA9IChwcm9jZXNzLmVudi5NRUFOV0hJTEVfQkFTRSB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6MzEwMFwiKS5yZXBsYWNlKFxuICAvXFwvKyQvLFxuICBcIlwiLFxuKTtcblxubGV0IGZhaWx1cmVzID0gMDtcbmZ1bmN0aW9uIGNoZWNrKG5hbWU6IHN0cmluZywgb2s6IGJvb2xlYW4sIGRldGFpbD86IHVua25vd24pOiB2b2lkIHtcbiAgY29uc29sZS5sb2coYCR7b2sgPyBcIlBBU1NcIiA6IFwiRkFJTFwifSAgJHtuYW1lfSR7b2sgPyBcIlwiIDogXCIgXHUyMDE0IFwiICsgSlNPTi5zdHJpbmdpZnkoZGV0YWlsKX1gKTtcbiAgaWYgKCFvaykgZmFpbHVyZXMrKztcbn1cblxuYXN5bmMgZnVuY3Rpb24ganNvbjxUPih1cmw6IHN0cmluZywgaW5pdD86IFJlcXVlc3RJbml0KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHIgPSBhd2FpdCBmZXRjaCh1cmwsIGluaXQpO1xuICBpZiAoIXIub2spIHRocm93IG5ldyBFcnJvcihgJHt1cmx9IC0+ICR7ci5zdGF0dXN9YCk7XG4gIHJldHVybiAoYXdhaXQgci5qc29uKCkpIGFzIFQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gIHNldERlYnVnKHRydWUpO1xuICBjb25zdCBjbGllbnRJZCA9IGRldmljZUlkKCk7XG4gIGNvbnN0IHNlY3JldHMgPSBuZXcgTWVtb3J5U2VjcmV0cygpO1xuICBjb25zdCBhdXRoID0gbmV3IEF1dGhTZXJ2aWNlKFxuICAgIHNlY3JldHMgYXMgbmV2ZXIsXG4gICAgQkFTRSxcbiAgICBjbGllbnRJZCxcbiAgKTtcbiAgYXdhaXQgYXV0aC5sb2FkKCk7XG5cbiAgLy8gMSkgYW5vbnltb3VzIHBvcnRmb2xpb1xuICBjb25zdCBwb3J0Zm9saW8gPSBuZXcgUG9ydGZvbGlvU2VydmljZShhdXRoLCBCQVNFLCBjbGllbnRJZCk7XG4gIGNvbnN0IGFub24gPSBhd2FpdCBwb3J0Zm9saW8ucmVmcmVzaChcImNjX3dlYnZpZXdcIik7XG4gIGNoZWNrKFwiYW5vbiBwb3J0Zm9saW8gc2VydmVkXCIsIChhbm9uPy5zcG9uc29ycy5sZW5ndGggPz8gMCkgPiAwKTtcbiAgY2hlY2soXG4gICAgXCJhbm9uIHBvcnRmb2xpbyBpcyBkZW1vLW9ubHlcIixcbiAgICBhbm9uPy5zcG9uc29ycy5ldmVyeSgocykgPT4gcy5kZW1vID09PSB0cnVlKSA/PyBmYWxzZSxcbiAgICBhbm9uPy5zcG9uc29ycy5tYXAoKHMpID0+IHMuZGVtbyksXG4gICk7XG5cbiAgLy8gMikgZGV2LWxvZ2luIChieXBhc3NlcyBicm93c2VyIGZsb3c7IHNhbWUgdG9rZW4gbGF5ZXIpXG4gIGNvbnN0IHRva2VucyA9IGF3YWl0IGpzb248eyBhY2Nlc3NUb2tlbjogc3RyaW5nOyByZWZyZXNoVG9rZW46IHN0cmluZyB9PihcbiAgICBgJHtCQVNFfS9hcGkvdjEvZXh0L2F1dGgvZGV2LWxvZ2luYCxcbiAgICB7IG1ldGhvZDogXCJQT1NUXCIgfSxcbiAgKTtcbiAgYXdhaXQgc2VjcmV0cy5zdG9yZShcIm1lYW53aGlsZS50b2tlbnMudjFcIiwgSlNPTi5zdHJpbmdpZnkodG9rZW5zKSk7XG4gIGF3YWl0IGF1dGgubG9hZCgpO1xuICBjaGVjayhcInRva2VucyBsb2FkZWQgXHUyMTkyIHNpZ25lZEluXCIsIGF1dGguc2lnbmVkSW4pO1xuXG4gIC8vIDMpIHNpZ25lZC1pbiBwb3J0Zm9saW8gKyBiYWxhbmNlcyArIENMSSBjYWNoZSBmaWxlXG4gIGNvbnN0IGJlZm9yZSA9IGF3YWl0IGpzb248eyBsaWZldGltZVVzZDogc3RyaW5nIH0+KFxuICAgIGAke0JBU0V9L2FwaS92MS9lYXJuaW5nc2AsXG4gICAgeyBoZWFkZXJzOiB7IGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbnMuYWNjZXNzVG9rZW59YCB9IH0sXG4gICk7XG4gIGNvbnN0IHNpZ25lZCA9IGF3YWl0IHBvcnRmb2xpby5yZWZyZXNoKFwiY2NfY2xpX3N0YXR1c2xpbmVcIik7XG4gIGNoZWNrKFwic2lnbmVkLWluIHBvcnRmb2xpbyBzZXJ2ZWRcIiwgKHNpZ25lZD8uc3BvbnNvcnMubGVuZ3RoID8/IDApID4gMCk7XG4gIGNoZWNrKFxuICAgIFwic2lnbmVkLWluIHBvcnRmb2xpbyBub24tZGVtb1wiLFxuICAgIHNpZ25lZD8uc3BvbnNvcnMuZXZlcnkoKHMpID0+ICFzLmRlbW8pID8/IGZhbHNlLFxuICApO1xuICBjaGVjayhcImJhbGFuY2VzIHByZXNlbnRcIiwgc2lnbmVkPy5iYWxhbmNlcyAhPSBudWxsKTtcbiAgY29uc3QgY2FjaGUgPSBKU09OLnBhcnNlKFxuICAgIHJlYWRGaWxlU3luYyhqb2luKGhvbWVkaXIoKSwgXCIubWVhbndoaWxlXCIsIFwic3BvbnNvcnMuanNvblwiKSwgXCJ1dGY4XCIpLFxuICApIGFzIHsgc3BvbnNvcnM6IHVua25vd25bXSB9O1xuICBjaGVjayhcIkNMSSBjYWNoZSB3cml0dGVuXCIsIGNhY2hlLnNwb25zb3JzLmxlbmd0aCA+IDApO1xuICBjaGVjayhcInJvdGF0aW9uIHBpY2tzIGEgc3BvbnNvclwiLCBwb3J0Zm9saW8uY3VycmVudFNwb25zb3IoKSAhPT0gbnVsbCk7XG5cbiAgLy8gNCkgbG9vcGJhY2sgYnJpZGdlXG4gIGNvbnN0IG1ldHJpY3MgPSBuZXcgTWV0cmljc0NsaWVudChhdXRoLCBCQVNFLCBjbGllbnRJZCk7XG4gIGNvbnN0IGxvb3AgPSBuZXcgTG9vcGJhY2socG9ydGZvbGlvLCBtZXRyaWNzLCBjbGllbnRJZCk7XG4gIGF3YWl0IGxvb3Auc3RhcnQoKTtcbiAgY2hlY2soXCJsb29wYmFjayBsaXN0ZW5pbmdcIiwgbG9vcC5wb3J0ID4gMCk7XG4gIGNvbnN0IGxiID0gYGh0dHA6Ly8xMjcuMC4wLjE6JHtsb29wLnBvcnR9YDtcblxuICBjb25zdCBoZWFsdGggPSBhd2FpdCBqc29uPHsgb2s6IGJvb2xlYW4gfT4oYCR7bGJ9L2hlYWx0aGApO1xuICBjaGVjayhcImxvb3BiYWNrIC9oZWFsdGhcIiwgaGVhbHRoLm9rKTtcblxuICBjb25zdCBiYWQgPSBhd2FpdCBmZXRjaChgJHtsYn0vdjEvc3BvbnNvcnM/dD1XUk9OR2ApO1xuICBjaGVjayhcImxvb3BiYWNrIHJlamVjdHMgYmFkIHRva2VuXCIsIGJhZC5zdGF0dXMgPT09IDQwMyk7XG5cbiAgY29uc3Qgc3AgPSBhd2FpdCBqc29uPHsgc3BvbnNvcnM6IHsgc3BvbnNvcklkOiBzdHJpbmc7IGNhbXBhaWduSWQ6IHN0cmluZzsgc2Vzc2lvblRva2VuOiBzdHJpbmc7IGNsaWNrVXJsOiBzdHJpbmcgfVtdIH0+KFxuICAgIGAke2xifS92MS9zcG9uc29ycz90PSR7bG9vcC50b2tlbn1gLFxuICApO1xuICBjaGVjayhcImxvb3BiYWNrIHNlcnZlcyBzcG9uc29yc1wiLCBzcC5zcG9uc29ycy5sZW5ndGggPiAwKTtcblxuICBjb25zdCBzMCA9IHNwLnNwb25zb3JzWzBdO1xuICBjb25zdCBiZWF0ID0gYXdhaXQganNvbjx7IG9rOiBib29sZWFuIH0+KFxuICAgIGAke2xifS92MS9tZXRyaWNzP3Q9JHtsb29wLnRva2VufWAsXG4gICAge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXZlbnQ6IFwidmlld190aHJlc2hvbGRfbWV0XCIsXG4gICAgICAgIHNwb25zb3JJZDogczAuc3BvbnNvcklkLFxuICAgICAgICBjYW1wYWlnbklkOiBzMC5jYW1wYWlnbklkLFxuICAgICAgICBzdXJmYWNlOiBcImNjX3dlYnZpZXdcIixcbiAgICAgICAgc2Vzc2lvblRva2VuOiBzMC5zZXNzaW9uVG9rZW4sXG4gICAgICAgIHZpc2libGVNczogMzIwMCxcbiAgICAgIH0pLFxuICAgIH0sXG4gICk7XG4gIGNoZWNrKFwibG9vcGJhY2sgYWNjZXB0cyBtZXRyaWNcIiwgYmVhdC5vayk7XG5cbiAgY29uc3QgY2xpY2sgPSBhd2FpdCBqc29uPHsgb2s6IGJvb2xlYW4gfT4oXG4gICAgYCR7bGJ9L3YxL2NsaWNrP3Q9JHtsb29wLnRva2VufWAsXG4gICAge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXZlbnQ6IFwiY2xpY2tcIixcbiAgICAgICAgc3BvbnNvcklkOiBzMC5zcG9uc29ySWQsXG4gICAgICAgIGNhbXBhaWduSWQ6IHMwLmNhbXBhaWduSWQsXG4gICAgICAgIHN1cmZhY2U6IFwiY2Nfd2Vidmlld1wiLFxuICAgICAgICBzZXNzaW9uVG9rZW46IHMwLnNlc3Npb25Ub2tlbixcbiAgICAgICAgY2xpY2tVcmw6IHMwLmNsaWNrVXJsLFxuICAgICAgfSksXG4gICAgfSxcbiAgKTtcbiAgY2hlY2soXCJsb29wYmFjayBjbGljayBva1wiLCBjbGljay5vayk7XG4gIGNoZWNrKFwiY2xpY2sgb3BlbmVkIGJyb3dzZXIgKHN0dWIpXCIsIG9wZW5lZFVybHMubGVuZ3RoID09PSAxLCBvcGVuZWRVcmxzKTtcblxuICAvLyA1KSBmbHVzaCBiZWFjb25zIFx1MjE5MiBlYXJuaW5ncyBpbmNyZWFzZWQgYnkgZXhhY3RseSBpbXByZXNzaW9uLzIgKyBjbGljay8yXG4gIGF3YWl0IG1ldHJpY3MuZmx1c2goKTtcbiAgY29uc3QgYWZ0ZXIgPSBhd2FpdCBqc29uPHsgbGlmZXRpbWVVc2Q6IHN0cmluZyB9PihcbiAgICBgJHtCQVNFfS9hcGkvdjEvZWFybmluZ3NgLFxuICAgIHsgaGVhZGVyczogeyBhdXRob3JpemF0aW9uOiBgQmVhcmVyICR7YXV0aC5hY2Nlc3NUb2tlbn1gIH0gfSxcbiAgKTtcbiAgY29uc3QgZGVsdGEgPVxuICAgIE1hdGgucm91bmQoXG4gICAgICAocGFyc2VGbG9hdChhZnRlci5saWZldGltZVVzZCkgLSBwYXJzZUZsb2F0KGJlZm9yZS5saWZldGltZVVzZCkpICogMTAwLFxuICAgICkgLyAxMDA7XG4gIC8vIFRvcCBob3VzZSBzcG9uc29yIGlzICQyMC8xayBcdTIxOTIgaW1wcmVzc2lvbiBjcmVkaXQgJDAuMDEsIGNsaWNrIGNyZWRpdCAkMC41MC5cbiAgY2hlY2soXCJlYXJuaW5ncyBkZWx0YSA9PSAkMC41MVwiLCBkZWx0YSA9PT0gMC41MSwge1xuICAgIGJlZm9yZTogYmVmb3JlLmxpZmV0aW1lVXNkLFxuICAgIGFmdGVyOiBhZnRlci5saWZldGltZVVzZCxcbiAgICBkZWx0YSxcbiAgfSk7XG5cbiAgLy8gNikgcmVmcmVzaCByb3RhdGlvbiArIHNpZ25vdXRcbiAgY29uc3QgcmVmcmVzaGVkID0gYXdhaXQgYXV0aC5yZWZyZXNoKCk7XG4gIGNoZWNrKFwicmVmcmVzaCByb3RhdGVzXCIsIHJlZnJlc2hlZCAmJiBhdXRoLnNpZ25lZEluKTtcbiAgYXdhaXQgYXV0aC5zaWduT3V0KCk7XG4gIGNoZWNrKFwic2lnbm91dCBjbGVhcnNcIiwgIWF1dGguc2lnbmVkSW4pO1xuXG4gIGxvb3AuZGlzcG9zZSgpO1xuICBtZXRyaWNzLmRpc3Bvc2UoKTtcblxuICBjb25zb2xlLmxvZyhmYWlsdXJlcyA9PT0gMCA/IFwiXFxuQUxMIFBBU1NcIiA6IGBcXG4ke2ZhaWx1cmVzfSBGQUlMVVJFU2ApO1xuICBwcm9jZXNzLmV4aXQoZmFpbHVyZXMgPT09IDAgPyAwIDogMSk7XG59XG5cbm1haW4oKS5jYXRjaCgoZSkgPT4ge1xuICBjb25zb2xlLmVycm9yKFwiaGFybmVzcyBjcmFzaGVkOlwiLCBlKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iLCAiLyoqXG4gKiBNaW5pbWFsIGB2c2NvZGVgIG1vZHVsZSBzdHViIHNvIHRoZSBzZXJ2aWNlIGxheWVyIChhdXRoL3BvcnRmb2xpby9tZXRyaWNzL1xuICogbG9vcGJhY2spIGNhbiBydW4gaGVhZGxlc3MgaW4gcGxhaW4gTm9kZSBmb3IgaW50ZWdyYXRpb24gdGVzdHMuIE9ubHkgdGhlXG4gKiBBUElzIHRob3NlIG1vZHVsZXMgYWN0dWFsbHkgdG91Y2ggYXJlIGltcGxlbWVudGVkLlxuICovXG5cbmV4cG9ydCBjb25zdCBvcGVuZWRVcmxzOiBzdHJpbmdbXSA9IFtdO1xuXG5leHBvcnQgY29uc3QgZW52ID0ge1xuICBhcHBOYW1lOiBcImhhcm5lc3NcIixcbiAgb3BlbkV4dGVybmFsOiBhc3luYyAodXJpOiB7IHRvU3RyaW5nKCk6IHN0cmluZyB9KSA9PiB7XG4gICAgb3BlbmVkVXJscy5wdXNoKHVyaS50b1N0cmluZygpKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBVcmkgPSB7XG4gIHBhcnNlOiAoczogc3RyaW5nKSA9PiAoeyB0b1N0cmluZzogKCkgPT4gcyB9KSxcbn07XG5cbmV4cG9ydCBjb25zdCBleHRlbnNpb25zID0ge1xuICBnZXRFeHRlbnNpb246IChfaWQ6IHN0cmluZykgPT4gKHsgcGFja2FnZUpTT046IHsgdmVyc2lvbjogXCIwLjAuMC10ZXN0XCIgfSB9KSxcbn07XG5cbi8qKiBJbi1tZW1vcnkgU2VjcmV0U3RvcmFnZSBsb29rYWxpa2UuICovXG5leHBvcnQgY2xhc3MgTWVtb3J5U2VjcmV0cyB7XG4gIHByaXZhdGUgbSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGFzeW5jIGdldChrOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLm0uZ2V0KGspO1xuICB9XG4gIGFzeW5jIHN0b3JlKGs6IHN0cmluZywgdjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5tLnNldChrLCB2KTtcbiAgfVxuICBhc3luYyBkZWxldGUoazogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5tLmRlbGV0ZShrKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3Qgd29ya3NwYWNlID0ge1xuICBnZXRDb25maWd1cmF0aW9uOiAoKSA9PiAoeyBnZXQ6IChfazogc3RyaW5nKSA9PiB1bmRlZmluZWQgfSksXG59O1xuXG5leHBvcnQgY29uc3Qgd2luZG93ID0ge1xuICBzaG93SW5mb3JtYXRpb25NZXNzYWdlOiAoLi4uX2E6IHVua25vd25bXSkgPT4gdW5kZWZpbmVkLFxuICBzaG93V2FybmluZ01lc3NhZ2U6ICguLi5fYTogdW5rbm93bltdKSA9PiB1bmRlZmluZWQsXG59O1xuIiwgImltcG9ydCB7IGFwcGVuZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi9jb25maWdcIjtcblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBkZWJ1ZyBsb2dnaW5nLiBPZmYgdW5sZXNzIGBkZWJ1Z2AgaXMgZW5hYmxlZCBpbiBjb25maWc7IGV2ZW5cbiAqIHRoZW4sIGEgd3JpdGUgZmFpbHVyZSBtdXN0IG5ldmVyIHN1cmZhY2UgdG8gdGhlIHVzZXIgXHUyMDE0IGxvZ2dpbmcgaXMgYVxuICogZGlhZ25vc3RpYyBhaWQsIG5vdCBhIGZlYXR1cmUgcGF0aC5cbiAqL1xuXG5sZXQgZGVidWdFbmFibGVkID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXREZWJ1ZyhvbjogYm9vbGVhbik6IHZvaWQge1xuICBkZWJ1Z0VuYWJsZWQgPSBvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRsb2coc2NvcGU6IHN0cmluZywgZXZlbnQ6IHN0cmluZywgZGF0YT86IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKCFkZWJ1Z0VuYWJsZWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBsaW5lID1cbiAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzY29wZSxcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIC4uLihkYXRhICE9PSB1bmRlZmluZWQgPyB7IGRhdGEgfSA6IHt9KSxcbiAgICAgIH0pICsgXCJcXG5cIjtcbiAgICBhcHBlbmRGaWxlU3luYyhqb2luKG1lYW53aGlsZURpcigpLCBcImRlYnVnLmxvZ1wiKSwgbGluZSwgXCJ1dGY4XCIpO1xuICB9IGNhdGNoIHtcbiAgICAvKiBuZXZlciBicmVhayBvbiBsb2dnaW5nICovXG4gIH1cbn1cbiIsICJpbXBvcnQgKiBhcyB2c2NvZGUgZnJvbSBcInZzY29kZVwiO1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gXCJub2RlOm9zXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgbWtkaXJTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuXG4vKipcbiAqIEVmZmVjdGl2ZSBleHRlbnNpb24gY29uZmlndXJhdGlvbiwgcmVzb2x2ZWQgZnJvbSAoaGlnaGVzdCBwcmVjZWRlbmNlIGZpcnN0KTpcbiAqICAgMS4gVlMgQ29kZSBzZXR0aW5ncyAoYG1lYW53aGlsZS4qYClcbiAqICAgMi4gfi8ubWVhbndoaWxlL2NvbmZpZy5qc29uICAocG93ZXItdXNlciAvIGhlYWRsZXNzIG92ZXJyaWRlKVxuICogICAzLiBlbnZpcm9ubWVudCAoTUVBTldISUxFX0JBU0UsIE1FQU5XSElMRV9ERUJVRylcbiAqICAgNC4gY29tcGlsZWQtaW4gZGVmYXVsdHNcbiAqXG4gKiBSZWFkcyBhcmUgYmVzdC1lZmZvcnQ6IGEgbWlzc2luZy9icm9rZW4gZmlsZSBvciBzZXR0aW5nIGZhbGxzIHRocm91Z2ggdG8gdGhlXG4gKiBuZXh0IHNvdXJjZSBzbyBhY3RpdmF0aW9uIGNhbiBuZXZlciBiZSBicm9rZW4gYnkgY29uZmlnLlxuICovXG5cbmNvbnN0IERFRkFVTFRfQkFDS0VORF9CQVNFID0gXCJodHRwOi8vMTI3LjAuMC4xOjMwMDBcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNZWFud2hpbGVDb25maWcge1xuICBiYWNrZW5kQmFzZVVybDogc3RyaW5nO1xuICBkZWJ1ZzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1lYW53aGlsZURpcigpOiBzdHJpbmcge1xuICBjb25zdCBkaXIgPSBqb2luKGhvbWVkaXIoKSwgXCIubWVhbndoaWxlXCIpO1xuICB0cnkge1xuICAgIGlmICghZXhpc3RzU3luYyhkaXIpKSBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSBjYXRjaCB7XG4gICAgLyogYmVzdC1lZmZvcnQgKi9cbiAgfVxuICByZXR1cm4gZGlyO1xufVxuXG5pbnRlcmZhY2UgRmlsZUNvbmZpZyB7XG4gIGJhY2tlbmRCYXNlVXJsPzogc3RyaW5nO1xuICBkZWJ1Zz86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHJlYWRGaWxlQ29uZmlnKCk6IEZpbGVDb25maWcge1xuICB0cnkge1xuICAgIGNvbnN0IHJhdyA9IHJlYWRGaWxlU3luYyhqb2luKG1lYW53aGlsZURpcigpLCBcImNvbmZpZy5qc29uXCIpLCBcInV0ZjhcIik7XG4gICAgY29uc3QgaiA9IEpTT04ucGFyc2UocmF3KSBhcyBGaWxlQ29uZmlnO1xuICAgIHJldHVybiBqICYmIHR5cGVvZiBqID09PSBcIm9iamVjdFwiID8gaiA6IHt9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge307XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJpbVNsYXNoZXMoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRDb25maWcoKTogTWVhbndoaWxlQ29uZmlnIHtcbiAgY29uc3Qgc2V0dGluZ3MgPSB2c2NvZGUud29ya3NwYWNlLmdldENvbmZpZ3VyYXRpb24oXCJtZWFud2hpbGVcIik7XG4gIGNvbnN0IGZpbGUgPSByZWFkRmlsZUNvbmZpZygpO1xuXG4gIGNvbnN0IHNldHRpbmdCYXNlID0gKHNldHRpbmdzLmdldDxzdHJpbmc+KFwiYmFja2VuZEJhc2VVcmxcIikgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCBmaWxlQmFzZSA9IChmaWxlLmJhY2tlbmRCYXNlVXJsIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgZW52QmFzZSA9IChwcm9jZXNzLmVudi5NRUFOV0hJTEVfQkFTRSB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IGJhY2tlbmRCYXNlVXJsID0gdHJpbVNsYXNoZXMoXG4gICAgc2V0dGluZ0Jhc2UgfHwgZmlsZUJhc2UgfHwgZW52QmFzZSB8fCBERUZBVUxUX0JBQ0tFTkRfQkFTRSxcbiAgKTtcblxuICBjb25zdCBkZWJ1ZyA9XG4gICAgc2V0dGluZ3MuZ2V0PGJvb2xlYW4+KFwiZGVidWdcIikgPT09IHRydWUgfHxcbiAgICBmaWxlLmRlYnVnID09PSB0cnVlIHx8XG4gICAgcHJvY2Vzcy5lbnYuTUVBTldISUxFX0RFQlVHID09PSBcIjFcIjtcblxuICByZXR1cm4geyBiYWNrZW5kQmFzZVVybCwgZGVidWcgfTtcbn1cbiIsICIvKipcbiAqIE1lYW53aGlsZSBcdTIwMTQgc2hhcmVkIEFQSSBjb250cmFjdC5cbiAqXG4gKiBUaGUgc2luZ2xlIHNvdXJjZSBvZiB0cnV0aCBmb3IgdGhlIHdpcmUgc2hhcGVzIGV4Y2hhbmdlZCBiZXR3ZWVuIHRoZSB3ZWJcbiAqIGJhY2tlbmQgKGB3ZWIvYCkgYW5kIHRoZSBlZGl0b3IgZXh0ZW5zaW9uIChgZXh0ZW5zaW9uL2ApLiBCb3RoIGltcG9ydCB0aGlzXG4gKiBmaWxlIGRpcmVjdGx5IHNvIGEgY29udHJhY3QgY2hhbmdlIGNhbiBuZXZlciBkcmlmdCBiZXR3ZWVuIHRoZSB0d28gaGFsdmVzLlxuICpcbiAqIERlc2lnbiBydWxlIChtb2R1bGFyIGF1dGgpOiB0aGUgZXh0ZW5zaW9uIE5FVkVSIHRhbGtzIHRvIHRoZSB3ZWIgYXV0aFxuICogcHJvdmlkZXIgKGJldHRlci1hdXRoL0NsZXJrL2V0Yy4pIGRpcmVjdGx5LiBJdCB1c2VzIG91ciBvd24gb3BhcXVlLXRva2VuXG4gKiBsYXllciBiZWxvdyAoYC9hcGkvZXh0L2F1dGgvKmApLiBTd2FwcGluZyB0aGUgd2ViIHByb3ZpZGVyIGxhdGVyIHRvdWNoZXNcbiAqIG9ubHkgdGhlIGJyb3dzZXIgc2lnbi1pbiBwYWdlLCBuZXZlciBhbnl0aGluZyBpbiBoZXJlLlxuICovXG5cbi8qKiBBUEkgdmVyc2lvbiBwcmVmaXggZm9yIGV2ZXJ5IGV4dGVuc2lvbi1mYWNpbmcgcm91dGUuICovXG5leHBvcnQgY29uc3QgQVBJX1ZFUlNJT04gPSBcInYxXCIgYXMgY29uc3Q7XG5cbi8qKiBXaGVyZSBhIHNwb25zb3IgbGluZSBpcyBiZWluZyByZW5kZXJlZC4gRHJpdmVzIHBlci1zdXJmYWNlIGJpbGxpbmcgYW5kXG4gKiAgbGV0cyB0aGUgYmFja2VuZCBzZWdtZW50IGRlbGl2ZXJ5IGJ5IGNsaWVudCB0eXBlLiAqL1xuZXhwb3J0IHR5cGUgU3VyZmFjZSA9XG4gIHwgXCJjY193ZWJ2aWV3XCIgLy8gQ2xhdWRlIENvZGUgVlMgQ29kZS9DdXJzb3IgcGFuZWwgKHJpY2ggb3ZlcmxheSlcbiAgfCBcImNjX2NsaV9zdGF0dXNsaW5lXCIgLy8gQ2xhdWRlIENvZGUgdGVybWluYWwgc3RhdHVzLWJhciBPU0MtOCBsaW5rXG4gIHwgXCJjY19jbGlfc3Bpbm5lclwiIC8vIENsYXVkZSBDb2RlIHRlcm1pbmFsIHRoaW5raW5nLXZlcmIgKENDID49IDIuMS4xNDMpXG4gIHwgXCJjb2RleF9jbGlcIiAvLyBDb2RleCBDTEkgc3RhcnR1cCBiYW5uZXIgKFBBVEggd3JhcHBlcilcbiAgfCBcImNvZGV4X3dlYnZpZXdcIjsgLy8gQ29kZXggVlMgQ29kZSBwYW5lbFxuXG5leHBvcnQgY29uc3QgQUxMX1NVUkZBQ0VTOiByZWFkb25seSBTdXJmYWNlW10gPSBbXG4gIFwiY2Nfd2Vidmlld1wiLFxuICBcImNjX2NsaV9zdGF0dXNsaW5lXCIsXG4gIFwiY2NfY2xpX3NwaW5uZXJcIixcbiAgXCJjb2RleF9jbGlcIixcbiAgXCJjb2RleF93ZWJ2aWV3XCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTdXJmYWNlKHJhdzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IFN1cmZhY2UgfCB1bmRlZmluZWQge1xuICByZXR1cm4gcmF3ICYmIChBTExfU1VSRkFDRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHJhdylcbiAgICA/IChyYXcgYXMgU3VyZmFjZSlcbiAgICA6IHVuZGVmaW5lZDtcbn1cblxuLyoqIEEgc2luZ2xlIHNlcnZlZCBzcG9uc29yIGNyZWF0aXZlICh3ZSBjYWxsIHRoZW0gXCJzcG9uc29yc1wiLCBub3QgXCJhZHNcIikuICovXG5leHBvcnQgaW50ZXJmYWNlIFNwb25zb3Ige1xuICAvKiogU3RhYmxlIGlkIG9mIHRoaXMgc2VydmVkIGltcHJlc3Npb24tZWxpZ2libGUgY3JlYXRpdmUuICovXG4gIHNwb25zb3JJZDogc3RyaW5nO1xuICBjYW1wYWlnbklkOiBzdHJpbmc7XG4gIC8qKiBUaGUgb25lLWxpbmUgdGV4dCBzaG93biBpbiB0aGUgc3Bpbm5lci9zdGF0dXMgc3VyZmFjZSAoM1x1MjAxMzYwIGNoYXJzKS4gKi9cbiAgdGV4dDogc3RyaW5nO1xuICAvKiogQnJhbmQgbmFtZSBmb3IgdGhlIGxlYWRlcmJvYXJkIChvcHRpb25hbCkuICovXG4gIGJyYW5kPzogc3RyaW5nO1xuICAvKiogQWJzb2x1dGUgaHR0cHMgaWNvbiBVUkwgKG9wdGlvbmFsOyBzdXJmYWNlcyBmYWxsIGJhY2sgdG8gYSBnbHlwaCkuICovXG4gIGljb25Vcmw/OiBzdHJpbmc7XG4gIC8qKiBBYnNvbHV0ZSBodHRwcyBsYW5kaW5nIFVSTCBvcGVuZWQgb24gY2xpY2suICovXG4gIGNsaWNrVXJsOiBzdHJpbmc7XG4gIC8qKiBPcGFxdWUgcGVyLXNlcnZlIHRva2VuIHRoZSBjbGllbnQgZWNob2VzIGJhY2sgb24gZXZlcnkgbWV0cmljIGJlYWNvbiBzb1xuICAgKiAgdGhlIGJhY2tlbmQgY2FuIGJpbmQgYW4gZXZlbnQgdG8gZXhhY3RseSB0aGlzIHNlcnZlIChhbnRpLXNwb29mKS4gKi9cbiAgc2Vzc2lvblRva2VuOiBzdHJpbmc7XG4gIC8qKiBUcnVlIHdoZW4gdGhpcyBjYW1lIGZyb20gdGhlIHNpZ25lZC1vdXQgREVNTyBpbnZlbnRvcnk6IGl0IHJlbmRlcnNcbiAgICogIGlkZW50aWNhbGx5IGFuZCB0aGUgY2xpY2sgb3BlbnMgdGhlIHJlYWwgVVJMLCBidXQgbWV0cmljcyByb3V0ZSB0byB0aGVcbiAgICogIGRlbW8gc2luayAoYWR2ZXJ0aXNlciBjaGFyZ2VkLCBubyB1c2VyIGNyZWRpdGVkKS4gKi9cbiAgZGVtbz86IGJvb2xlYW47XG59XG5cbi8qKiBEaXNwbGF5LW9ubHkgZWFybmluZ3MgZm9yIHRoZSBzdGF0dXMgYmFyICh0aGUgdXNlcidzIDUwJSBzaGFyZSkuICovXG5leHBvcnQgaW50ZXJmYWNlIEJhbGFuY2VzIHtcbiAgbGlmZXRpbWVVc2Q6IHN0cmluZzsgLy8gZm9ybWF0dGVkIGRlY2ltYWwgc3RyaW5nLCBlLmcuIFwiNy4xMVwiXG4gIHRvZGF5VXNkOiBzdHJpbmc7XG4gIGxhc3RVcGRhdGVkTXM6IG51bWJlcjtcbn1cblxuLyoqIEdFVCAvdjEvcG9ydGZvbGlvIHJlc3BvbnNlLiBUaGUgZXh0ZW5zaW9uIGRyYWlucyBgc3BvbnNvcnNgIGluIG9yZGVyLFxuICogIHJvdGF0aW5nIGV2ZXJ5IGByb3RhdGlvbkludGVydmFsTXNgLCByZWZldGNoaW5nIHdoZW4gdGhlIHF1ZXVlIGVtcHRpZXMgb3JcbiAqICBgdHRsTXNgIGVsYXBzZXMuICovXG5leHBvcnQgaW50ZXJmYWNlIFBvcnRmb2xpb1Jlc3BvbnNlIHtcbiAgc3BvbnNvcnM6IFNwb25zb3JbXTtcbiAgLyoqIEhvdyBsb25nIHRoZSBjbGllbnQgc2hvdWxkIGNhY2hlIHRoaXMgcmVzcG9uc2UgYmVmb3JlIHJlZmV0Y2hpbmcuICovXG4gIHR0bE1zOiBudW1iZXI7XG4gIC8qKiBNaW5pbXVtIGdhcCBiZXR3ZWVuIG9uLWRpc2sgcm90YXRpb25zIChmbG9vcmVkIHNlcnZlci1zaWRlIHRvIHByb3RlY3RcbiAgICogIHRoZSBob3N0IGZyb20gYSBob3N0aWxlL2J1Z2d5IHZhbHVlIHJld3JpdGluZyBDQydzIDQuNiBNQiBidW5kbGUpLiAqL1xuICByb3RhdGlvbkludGVydmFsTXM6IG51bWJlcjtcbiAgLyoqIEN1bXVsYXRpdmUgdmlzaWJsZSB0aW1lIGEgc3BvbnNvciBtdXN0IGFjY3J1ZSBiZWZvcmUgaXQgYmlsbHMgYXMgYVxuICAgKiAgdmlld2FibGUgaW1wcmVzc2lvbi4gKi9cbiAgdmlld1RocmVzaG9sZE1zOiBudW1iZXI7XG4gIC8qKiBTaWduZWQtaW4gb25seTsgbnVsbCBmb3IgZGVtby9hbm9ueW1vdXMgZmV0Y2hlcy4gKi9cbiAgYmFsYW5jZXM6IEJhbGFuY2VzIHwgbnVsbDtcbn1cblxuLyoqIEJpbGxhYmxlIGxpZmVjeWNsZSBldmVudHMuIGBpbXByZXNzaW9uYCA9IGZpcnN0IHBhaW50OyBgdmlld2FibGVgID1cbiAqICBjcm9zc2VkIHRoZSB2aWV3IHRocmVzaG9sZDsgYHZpZXdfdGlja2AgPSBwZXJpb2RpYyBoZWFydGJlYXQgd2hpbGVcbiAqICB2aXNpYmxlOyBgY2xpY2tgID0gYW5jaG9yIG9wZW5lZDsgYGVycm9yX2ltcHJlc3Npb25gID0gc2FmZXR5LW5ldCBmaXJlIHNvXG4gKiAgYSBzdHVjay1idXQtdmlzaWJsZSBzcG9uc29yIHN0aWxsIGJpbGxzIG9uY2UuICovXG5leHBvcnQgdHlwZSBNZXRyaWNFdmVudCA9XG4gIHwgXCJpbXByZXNzaW9uXCJcbiAgfCBcInZpZXdhYmxlXCJcbiAgfCBcInZpZXdfdGlja1wiXG4gIHwgXCJ2aWV3X3RocmVzaG9sZF9tZXRcIlxuICB8IFwiY2xpY2tcIlxuICB8IFwiZXJyb3JfaW1wcmVzc2lvblwiO1xuXG5leHBvcnQgY29uc3QgQklMTEFCTEVfRVZFTlRTOiByZWFkb25seSBNZXRyaWNFdmVudFtdID0gW1xuICBcImltcHJlc3Npb25cIixcbiAgXCJ2aWV3YWJsZVwiLFxuICBcInZpZXdfdGlja1wiLFxuICBcInZpZXdfdGhyZXNob2xkX21ldFwiLFxuICBcImNsaWNrXCIsXG4gIFwiZXJyb3JfaW1wcmVzc2lvblwiLFxuXTtcblxuLyoqIFBPU1QgL3YxL21ldHJpY3MgYm9keS4gU2VudCB3aXRoIGEgQmVhcmVyIHRva2VuIHdoZW4gc2lnbmVkIGluLCBlbHNlIGl0XG4gKiAgcm91dGVzIHRvIHRoZSBkZW1vIHNpbmsuIGBub25jZWAgZGVkdXBlcyByZXRyaWVzOyBgc2Vzc2lvblRva2VuYCBiaW5kcyB0aGVcbiAqICBldmVudCB0byBhIHNwZWNpZmljIHNlcnZlLiAqL1xuZXhwb3J0IGludGVyZmFjZSBNZXRyaWNCZWFjb24ge1xuICBldmVudDogTWV0cmljRXZlbnQ7XG4gIHNwb25zb3JJZDogc3RyaW5nO1xuICBjYW1wYWlnbklkOiBzdHJpbmc7XG4gIHN1cmZhY2U6IFN1cmZhY2U7XG4gIC8qKiBTdGFibGUgYW5vbnltb3VzIGRldmljZSBpZCAobWludGVkIGNsaWVudC1zaWRlLCBwZXJzaXN0ZWQgbG9jYWxseSkuICovXG4gIGNsaWVudElkOiBzdHJpbmc7XG4gIC8qKiBQZXItc2VydmUgdG9rZW4gZnJvbSB0aGUgU3BvbnNvci4gKi9cbiAgc2Vzc2lvblRva2VuOiBzdHJpbmc7XG4gIC8qKiBVVUlEIHY0LCB1bmlxdWUgcGVyIGV2ZW50OyBiYWNrZW5kIGlnbm9yZXMgZHVwbGljYXRlcy4gKi9cbiAgbm9uY2U6IHN0cmluZztcbiAgLyoqIElTTyB0aW1lc3RhbXAgKGNsaWVudCBjbG9jazsgYmFja2VuZCBzdGFtcHMgaXRzIG93biB0b28pLiAqL1xuICB0czogc3RyaW5nO1xuICAvKiogQ3VtdWxhdGl2ZSB2aXNpYmxlIG1zIGF0IHRoZSBtb21lbnQgb2YgdGhlIGV2ZW50IChmb3Igdmlldy9jbGljayBmbG9vcnMpLiAqL1xuICB2aXNpYmxlTXM/OiBudW1iZXI7XG4gIC8qKiBDbGllbnQgZW52aXJvbm1lbnQgZmluZ2VycHJpbnQgZm9yIHRyYWZmaWMgc2VnbWVudGF0aW9uIChvcy9hcmNoL2VkaXRvcikuICovXG4gIGNsaWVudD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG4vKiogR0VUIC92MS9lYXJuaW5ncyByZXNwb25zZSAoc2lnbmVkLWluKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRWFybmluZ3NSZXNwb25zZSB7XG4gIGxpZmV0aW1lVXNkOiBzdHJpbmc7XG4gIHRvZGF5VXNkOiBzdHJpbmc7XG59XG5cbi8vIC0tLSBFeHRlbnNpb24gYXV0aCAob3VyIG93biB0b2tlbiBsYXllcjsgcHJvdmlkZXItYWdub3N0aWMpIC0tLS0tLS0tLS0tLS0tLVxuXG4vKiogUE9TVCAvdjEvZXh0L2F1dGgvc3RhcnQgcmVzcG9uc2UuIFRoZSBleHRlbnNpb24gb3BlbnMgYGF1dGhVcmxgIGluIHRoZVxuICogIHN5c3RlbSBicm93c2VyIGFuZCBwb2xscyB3aXRoIGBzdGF0ZWAuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhTdGFydFJlc3BvbnNlIHtcbiAgc3RhdGU6IHN0cmluZztcbiAgYXV0aFVybDogc3RyaW5nO1xuICAvKiogSG93IGxvbmcgdGhlIGNsaWVudCBzaG91bGQgcG9sbCBiZWZvcmUgZ2l2aW5nIHVwIChzZWNvbmRzKS4gKi9cbiAgZXhwaXJlc0luU2VjOiBudW1iZXI7XG59XG5cbi8qKiBHRVQgL3YxL2V4dC9hdXRoL3BvbGw/c3RhdGU9IHJlc3BvbnNlLiAqL1xuZXhwb3J0IGludGVyZmFjZSBFeHRBdXRoUG9sbFJlc3BvbnNlIHtcbiAgc3RhdHVzOiBcInBlbmRpbmdcIiB8IFwiY29tcGxldGVcIiB8IFwiZXhwaXJlZFwiO1xuICBhY2Nlc3NUb2tlbj86IHN0cmluZztcbiAgcmVmcmVzaFRva2VuPzogc3RyaW5nO1xufVxuXG4vKiogUE9TVCAvdjEvZXh0L2F1dGgvcmVmcmVzaCBib2R5ICsgcmVzcG9uc2UuIFRoZSByZWZyZXNoIHRva2VuIFJPVEFURVM6XG4gKiAgdGhlIHJlc3BvbnNlIGFsd2F5cyBjYXJyaWVzIGEgZnJlc2ggb25lIHRvIHBlcnNpc3QuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhSZWZyZXNoUmVxdWVzdCB7XG4gIHJlZnJlc2hUb2tlbjogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBFeHRBdXRoUmVmcmVzaFJlc3BvbnNlIHtcbiAgYWNjZXNzVG9rZW46IHN0cmluZztcbiAgcmVmcmVzaFRva2VuOiBzdHJpbmc7XG59XG5cbi8qKiBSb3V0ZSBidWlsZGVycyBzbyBjYWxsZXJzIG5ldmVyIGhhbmQtY29uY2F0ZW5hdGUgcGF0aHMuIFBhdGhzIGFyZSByZWxhdGl2ZVxuICogIHRvIHRoZSBiYWNrZW5kIGJhc2UgVVJMIGFuZCBpbmNsdWRlIHRoZSBOZXh0LmpzIGAvYXBpYCBtb3VudC4gKi9cbmNvbnN0IFAgPSBgL2FwaS8ke0FQSV9WRVJTSU9OfWAgYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCByb3V0ZXMgPSB7XG4gIHBvcnRmb2xpbzogKHN1cmZhY2U6IFN1cmZhY2UsIGNsaWVudElkOiBzdHJpbmcpID0+XG4gICAgYCR7UH0vcG9ydGZvbGlvP3N1cmZhY2U9JHtlbmNvZGVVUklDb21wb25lbnQoc3VyZmFjZSl9JmNsaWVudF9pZD0ke2VuY29kZVVSSUNvbXBvbmVudChjbGllbnRJZCl9YCxcbiAgbWV0cmljczogKCkgPT4gYCR7UH0vbWV0cmljc2AsXG4gIGVhcm5pbmdzOiAoKSA9PiBgJHtQfS9lYXJuaW5nc2AsXG4gIGF1dGhTdGFydDogKCkgPT4gYCR7UH0vZXh0L2F1dGgvc3RhcnRgLFxuICBhdXRoUG9sbDogKHN0YXRlOiBzdHJpbmcpID0+XG4gICAgYCR7UH0vZXh0L2F1dGgvcG9sbD9zdGF0ZT0ke2VuY29kZVVSSUNvbXBvbmVudChzdGF0ZSl9YCxcbiAgYXV0aFJlZnJlc2g6ICgpID0+IGAke1B9L2V4dC9hdXRoL3JlZnJlc2hgLFxuICBhdXRoU2lnbm91dDogKCkgPT4gYCR7UH0vZXh0L2F1dGgvc2lnbm91dGAsXG59IGFzIGNvbnN0O1xuIiwgImltcG9ydCB7IGRsb2cgfSBmcm9tIFwiLi9sb2dcIjtcblxuLyoqIEVycm9yIGNhcnJ5aW5nIHRoZSBIVFRQIHN0YXR1cyBzbyBjYWxsZXJzIGNhbiBicmFuY2ggb24gNDAxIGV0Yy4gKi9cbmV4cG9ydCBjbGFzcyBIdHRwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSBzdGF0dXM6IG51bWJlcixcbiAgICBwdWJsaWMgcmVhZG9ubHkgYm9keVRleHQ6IHN0cmluZyxcbiAgKSB7XG4gICAgc3VwZXIoYEhUVFAgJHtzdGF0dXN9YCk7XG4gIH1cbn1cblxuY29uc3QgREVGQVVMVF9USU1FT1VUX01TID0gMTBfMDAwO1xuXG4vKipcbiAqIE1pbmltYWwgSlNPTiBmZXRjaCB3aXRoIGEgaGFyZCB0aW1lb3V0LiBUaGUgZXh0ZW5zaW9uIGhvc3Qgc2hpcHMgTm9kZSAyMCssXG4gKiBzbyBnbG9iYWwgZmV0Y2gvQWJvcnRDb250cm9sbGVyIGFyZSBhdmFpbGFibGUgd2l0aG91dCBkZXBlbmRlbmNpZXMuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEpzb248VD4oXG4gIHVybDogc3RyaW5nLFxuICBpbml0PzogUmVxdWVzdEluaXQgJiB7IHRpbWVvdXRNcz86IG51bWJlciB9LFxuKTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IGN0bCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgdCA9IHNldFRpbWVvdXQoXG4gICAgKCkgPT4gY3RsLmFib3J0KCksXG4gICAgaW5pdD8udGltZW91dE1zID8/IERFRkFVTFRfVElNRU9VVF9NUyxcbiAgKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIC4uLmluaXQsXG4gICAgICBzaWduYWw6IGN0bC5zaWduYWwsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAuLi4oaW5pdD8uaGVhZGVycyA/PyB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgSHR0cEVycm9yKHJlcy5zdGF0dXMsIHRleHQpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpIGFzIFQ7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoIShlIGluc3RhbmNlb2YgSHR0cEVycm9yKSkgZGxvZyhcImh0dHBcIiwgXCJmZXRjaCBmYWlsZWRcIiwgeyB1cmwsIGU6IFN0cmluZyhlKSB9KTtcbiAgICB0aHJvdyBlO1xuICB9IGZpbmFsbHkge1xuICAgIGNsZWFyVGltZW91dCh0KTtcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHZzY29kZSBmcm9tIFwidnNjb2RlXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEV4dEF1dGhQb2xsUmVzcG9uc2UsXG4gIEV4dEF1dGhSZWZyZXNoUmVzcG9uc2UsXG4gIEV4dEF1dGhTdGFydFJlc3BvbnNlLFxufSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyBmZXRjaEpzb24sIEh0dHBFcnJvciB9IGZyb20gXCIuL2h0dHBcIjtcbmltcG9ydCB7IGRsb2cgfSBmcm9tIFwiLi9sb2dcIjtcblxuY29uc3QgU0VDUkVUX0tFWSA9IFwibWVhbndoaWxlLnRva2Vucy52MVwiO1xuXG5pbnRlcmZhY2UgU3RvcmVkVG9rZW5zIHtcbiAgYWNjZXNzVG9rZW46IHN0cmluZztcbiAgcmVmcmVzaFRva2VuOiBzdHJpbmc7XG59XG5cbi8qKlxuICogRXh0ZW5zaW9uLXNpZGUgYXV0aCBhZ2FpbnN0IG91ciBvcGFxdWUgdG9rZW4gbGF5ZXIuIFRoZSBmbG93IGlzXG4gKiBzdGFydCBcdTIxOTIgb3BlbiBicm93c2VyIFx1MjE5MiBwb2xsIFx1MjE5MiBzdG9yZTsgdG9rZW5zIGxpdmUgT05MWSBpbiBWUyBDb2RlXG4gKiBTZWNyZXRTdG9yYWdlIChuZXZlciBvbiBkaXNrKSwgYW5kIHRoZSByZWZyZXNoIHRva2VuIHJvdGF0ZXMgb24gZXZlcnkgdXNlLlxuICovXG5leHBvcnQgY2xhc3MgQXV0aFNlcnZpY2Uge1xuICBwcml2YXRlIHRva2VuczogU3RvcmVkVG9rZW5zIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVmcmVzaGluZzogUHJvbWlzZTxib29sZWFuPiB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2VjcmV0czogdnNjb2RlLlNlY3JldFN0b3JhZ2UsXG4gICAgcHJpdmF0ZSByZWFkb25seSBiYXNlOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjbGllbnRJZDogc3RyaW5nLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5zZWNyZXRzLmdldChTRUNSRVRfS0VZKTtcbiAgICAgIGlmIChyYXcpIHRoaXMudG9rZW5zID0gSlNPTi5wYXJzZShyYXcpIGFzIFN0b3JlZFRva2VucztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMudG9rZW5zID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBnZXQgc2lnbmVkSW4oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zICE9PSBudWxsO1xuICB9XG5cbiAgZ2V0IGFjY2Vzc1Rva2VuKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnRva2Vucz8uYWNjZXNzVG9rZW4gPz8gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGVyc2lzdCh0OiBTdG9yZWRUb2tlbnMgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy50b2tlbnMgPSB0O1xuICAgIGlmICh0KSBhd2FpdCB0aGlzLnNlY3JldHMuc3RvcmUoU0VDUkVUX0tFWSwgSlNPTi5zdHJpbmdpZnkodCkpO1xuICAgIGVsc2UgYXdhaXQgdGhpcy5zZWNyZXRzLmRlbGV0ZShTRUNSRVRfS0VZKTtcbiAgfVxuXG4gIC8qKiBGdWxsIGludGVyYWN0aXZlIHNpZ24taW4uIFJldHVybnMgdHJ1ZSB3aGVuIHRva2VucyB3ZXJlIG9idGFpbmVkLiAqL1xuICBhc3luYyBzaWduSW4ocHJvZ3Jlc3M/OiAobXNnOiBzdHJpbmcpID0+IHZvaWQpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBzdGFydCA9IGF3YWl0IGZldGNoSnNvbjxFeHRBdXRoU3RhcnRSZXNwb25zZT4oXG4gICAgICB0aGlzLmJhc2UgKyByb3V0ZXMuYXV0aFN0YXJ0KCksXG4gICAgICB7IG1ldGhvZDogXCJQT1NUXCIsIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgY2xpZW50SWQ6IHRoaXMuY2xpZW50SWQgfSkgfSxcbiAgICApO1xuICAgIGRsb2coXCJhdXRoXCIsIFwic3RhcnQgb2tcIiwgeyBzdGF0ZTogc3RhcnQuc3RhdGUuc2xpY2UoMCwgNikgKyBcIlx1MjAyNlwiIH0pO1xuICAgIHByb2dyZXNzPy4oXCJPcGVuaW5nIGJyb3dzZXJcdTIwMjZcIik7XG4gICAgYXdhaXQgdnNjb2RlLmVudi5vcGVuRXh0ZXJuYWwodnNjb2RlLlVyaS5wYXJzZShzdGFydC5hdXRoVXJsKSk7XG5cbiAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyBzdGFydC5leHBpcmVzSW5TZWMgKiAxMDAwO1xuICAgIHByb2dyZXNzPy4oXCJXYWl0aW5nIGZvciB5b3UgdG8gZmluaXNoIHNpZ25pbmcgaW5cdTIwMjZcIik7XG4gICAgd2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMjAwMCkpO1xuICAgICAgbGV0IHBvbGw6IEV4dEF1dGhQb2xsUmVzcG9uc2U7XG4gICAgICB0cnkge1xuICAgICAgICBwb2xsID0gYXdhaXQgZmV0Y2hKc29uPEV4dEF1dGhQb2xsUmVzcG9uc2U+KFxuICAgICAgICAgIHRoaXMuYmFzZSArIHJvdXRlcy5hdXRoUG9sbChzdGFydC5zdGF0ZSksXG4gICAgICAgICk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRsb2coXCJhdXRoXCIsIFwicG9sbCBlcnJvciAocmV0cnlpbmcpXCIsIHsgZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChwb2xsLnN0YXR1cyA9PT0gXCJjb21wbGV0ZVwiICYmIHBvbGwuYWNjZXNzVG9rZW4gJiYgcG9sbC5yZWZyZXNoVG9rZW4pIHtcbiAgICAgICAgYXdhaXQgdGhpcy5wZXJzaXN0KHtcbiAgICAgICAgICBhY2Nlc3NUb2tlbjogcG9sbC5hY2Nlc3NUb2tlbixcbiAgICAgICAgICByZWZyZXNoVG9rZW46IHBvbGwucmVmcmVzaFRva2VuLFxuICAgICAgICB9KTtcbiAgICAgICAgZGxvZyhcImF1dGhcIiwgXCJzaWduLWluIGNvbXBsZXRlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChwb2xsLnN0YXR1cyA9PT0gXCJleHBpcmVkXCIpIGJyZWFrO1xuICAgIH1cbiAgICBkbG9nKFwiYXV0aFwiLCBcInNpZ24taW4gZXhwaXJlZC9hYmFuZG9uZWRcIik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqIFJvdGF0ZSB0aGUgcmVmcmVzaCB0b2tlbi4gU2luZ2xlLWZsaWdodCBzbyBjb25jdXJyZW50IDQwMXMgcmVmcmVzaCBvbmNlLiAqL1xuICBhc3luYyByZWZyZXNoKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghdGhpcy50b2tlbnMpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodGhpcy5yZWZyZXNoaW5nKSByZXR1cm4gdGhpcy5yZWZyZXNoaW5nO1xuICAgIHRoaXMucmVmcmVzaGluZyA9IChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2hKc29uPEV4dEF1dGhSZWZyZXNoUmVzcG9uc2U+KFxuICAgICAgICAgIHRoaXMuYmFzZSArIHJvdXRlcy5hdXRoUmVmcmVzaCgpLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHJlZnJlc2hUb2tlbjogdGhpcy50b2tlbnM/LnJlZnJlc2hUb2tlbiB9KSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3Qoe1xuICAgICAgICAgIGFjY2Vzc1Rva2VuOiByLmFjY2Vzc1Rva2VuLFxuICAgICAgICAgIHJlZnJlc2hUb2tlbjogci5yZWZyZXNoVG9rZW4sXG4gICAgICAgIH0pO1xuICAgICAgICBkbG9nKFwiYXV0aFwiLCBcInJlZnJlc2ggb2tcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBJbnZhbGlkL3Jldm9rZWQgcmVmcmVzaCB0b2tlbiBcdTIxOTIgZnVsbHkgc2lnbmVkIG91dC5cbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBIdHRwRXJyb3IgJiYgKGUuc3RhdHVzID09PSA0MDEgfHwgZS5zdGF0dXMgPT09IDQwMCkpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3QobnVsbCk7XG4gICAgICAgIH1cbiAgICAgICAgZGxvZyhcImF1dGhcIiwgXCJyZWZyZXNoIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGhpcy5yZWZyZXNoaW5nID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KSgpO1xuICAgIHJldHVybiB0aGlzLnJlZnJlc2hpbmc7XG4gIH1cblxuICBhc3luYyBzaWduT3V0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJ0ID0gdGhpcy50b2tlbnM/LnJlZnJlc2hUb2tlbjtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3QobnVsbCk7XG4gICAgaWYgKCFydCkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmZXRjaEpzb24odGhpcy5iYXNlICsgcm91dGVzLmF1dGhTaWdub3V0KCksIHtcbiAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyByZWZyZXNoVG9rZW46IHJ0IH0pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGxvZyhcImF1dGhcIiwgXCJzaWdub3V0IGJlYWNvbiBmYWlsZWQgKGxvY2FsIHN0YXRlIGNsZWFyZWQpXCIsIHtcbiAgICAgICAgZTogU3RyaW5nKGUpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJ1biBhbiBhdXRoZW50aWNhdGVkIHJlcXVlc3Q7IG9uIDQwMSwgcmVmcmVzaCBvbmNlIGFuZCByZXRyeS4gRmFsbHMgYmFja1xuICAgKiB0byBhbiBhbm9ueW1vdXMgY2FsbCB3aGVuIHNpZ25lZCBvdXQgKHBvcnRmb2xpbyBzdXBwb3J0cyBib3RoKS5cbiAgICovXG4gIGFzeW5jIHdpdGhBdXRoPFQ+KGZuOiAoYmVhcmVyOiBzdHJpbmcgfCBudWxsKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gICAgaWYgKCF0aGlzLnRva2VucykgcmV0dXJuIGZuKG51bGwpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgZm4odGhpcy50b2tlbnMuYWNjZXNzVG9rZW4pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgSHR0cEVycm9yICYmIGUuc3RhdHVzID09PSA0MDEpIHtcbiAgICAgICAgY29uc3Qgb2sgPSBhd2FpdCB0aGlzLnJlZnJlc2goKTtcbiAgICAgICAgcmV0dXJuIGZuKG9rID8gKHRoaXMudG9rZW5zPy5hY2Nlc3NUb2tlbiA/PyBudWxsKSA6IG51bGwpO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBhcmNoLCBwbGF0Zm9ybSB9IGZyb20gXCJub2RlOm9zXCI7XG5pbXBvcnQgKiBhcyB2c2NvZGUgZnJvbSBcInZzY29kZVwiO1xuaW1wb3J0IHR5cGUge1xuICBNZXRyaWNCZWFjb24sXG4gIE1ldHJpY0V2ZW50LFxuICBTcG9uc29yLFxuICBTdXJmYWNlLFxufSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aFwiO1xuaW1wb3J0IHsgZmV0Y2hKc29uIH0gZnJvbSBcIi4vaHR0cFwiO1xuaW1wb3J0IHsgZXZlbnROb25jZSB9IGZyb20gXCIuL2lkc1wiO1xuaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG5jb25zdCBNQVhfUVVFVUUgPSAyMDA7XG5jb25zdCBGTFVTSF9JTlRFUlZBTF9NUyA9IDE1XzAwMDtcblxuLyoqXG4gKiBGaXJlLWFuZC1mb3JnZXQgYmVhY29uIHNlbmRlciB3aXRoIGEgc21hbGwgaW4tbWVtb3J5IHJldHJ5IHF1ZXVlLiBMb3NpbmcgYVxuICogYmVhY29uIGNvc3RzIGNlbnRzLCBzbyB0aGUgZmFpbHVyZSBtb2RlIGlzIFwiZHJvcCBvbGRlc3RcIiwgbmV2ZXIgXCJibG9jayB0aGVcbiAqIGVkaXRvclwiIG9yIFwiZ3JvdyB1bmJvdW5kZWRcIi5cbiAqL1xuZXhwb3J0IGNsYXNzIE1ldHJpY3NDbGllbnQge1xuICBwcml2YXRlIHF1ZXVlOiBNZXRyaWNCZWFjb25bXSA9IFtdO1xuICBwcml2YXRlIHRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRJbnRlcnZhbD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50SWQ6IHN0cmluZyxcbiAgKSB7fVxuXG4gIHN0YXJ0KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnRpbWVyKSByZXR1cm47XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKCgpID0+IHZvaWQgdGhpcy5mbHVzaCgpLCBGTFVTSF9JTlRFUlZBTF9NUyk7XG4gIH1cblxuICBkaXNwb3NlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnRpbWVyKSBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIHZvaWQgdGhpcy5mbHVzaCgpO1xuICB9XG5cbiAgLyoqIEJ1aWxkICsgZW5xdWV1ZSBhIGJlYWNvbiBmb3IgYSBzZXJ2ZWQgc3BvbnNvci4gKi9cbiAgZW1pdChcbiAgICBldmVudDogTWV0cmljRXZlbnQsXG4gICAgc3BvbnNvcjogU3BvbnNvcixcbiAgICBzdXJmYWNlOiBTdXJmYWNlLFxuICAgIHZpc2libGVNcz86IG51bWJlcixcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5lbnF1ZXVlKHtcbiAgICAgIGV2ZW50LFxuICAgICAgc3BvbnNvcklkOiBzcG9uc29yLnNwb25zb3JJZCxcbiAgICAgIGNhbXBhaWduSWQ6IHNwb25zb3IuY2FtcGFpZ25JZCxcbiAgICAgIHN1cmZhY2UsXG4gICAgICBjbGllbnRJZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIHNlc3Npb25Ub2tlbjogc3BvbnNvci5zZXNzaW9uVG9rZW4sXG4gICAgICBub25jZTogZXZlbnROb25jZSgpLFxuICAgICAgdHM6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIC4uLih2aXNpYmxlTXMgIT09IHVuZGVmaW5lZCA/IHsgdmlzaWJsZU1zIH0gOiB7fSksXG4gICAgICBjbGllbnQ6IHtcbiAgICAgICAgb3M6IHBsYXRmb3JtKCksXG4gICAgICAgIGFyY2g6IGFyY2goKSxcbiAgICAgICAgZWRpdG9yOiB2c2NvZGUuZW52LmFwcE5hbWUsXG4gICAgICAgIGV4dFZlcnNpb246IHZzY29kZS5leHRlbnNpb25zLmdldEV4dGVuc2lvbihcbiAgICAgICAgICBcInNoYXduZXNxdWl2ZWwubWVhbndoaWxlXCIsXG4gICAgICAgICk/LnBhY2thZ2VKU09OPy52ZXJzaW9uLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBFbnF1ZXVlIGEgcHJlLWJ1aWx0IGJlYWNvbiAodXNlZCBieSB0aGUgbG9vcGJhY2sgZm9yIHdlYnZpZXcgZXZlbnRzKS4gKi9cbiAgZW5xdWV1ZShiZWFjb246IE1ldHJpY0JlYWNvbik6IHZvaWQge1xuICAgIHRoaXMucXVldWUucHVzaChiZWFjb24pO1xuICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCA+IE1BWF9RVUVVRSkgdGhpcy5xdWV1ZS5zaGlmdCgpO1xuICAgIC8vIENsaWNrcyBhcmUgcHJlY2lvdXMgXHUyMDE0IHB1c2ggdGhlbSBvdXQgaW1tZWRpYXRlbHkuXG4gICAgaWYgKGJlYWNvbi5ldmVudCA9PT0gXCJjbGlja1wiIHx8IGJlYWNvbi5ldmVudCA9PT0gXCJ2aWV3X3RocmVzaG9sZF9tZXRcIikge1xuICAgICAgdm9pZCB0aGlzLmZsdXNoKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwZW5kaW5nOiBQcm9taXNlPHZvaWQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgLyoqIERyYWluIHRoZSBxdWV1ZS4gQXdhaXRpbmcgdGhpcyBhbHdheXMgY292ZXJzIGFueSBpbi1mbGlnaHQgZHJhaW4gdG9vLFxuICAgKiAgc28gY2FsbGVycyAoZGlzcG9zZSwgdGVzdHMpIGdldCBhIHJlYWwgY29tcGxldGlvbiBzaWduYWwuICovXG4gIGZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnBlbmRpbmcpIHJldHVybiB0aGlzLnBlbmRpbmc7XG4gICAgaWYgKHRoaXMucXVldWUubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgdGhpcy5wZW5kaW5nID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHdoaWxlICh0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBiZWFjb24gPSB0aGlzLnF1ZXVlWzBdO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmF1dGgud2l0aEF1dGgoKGJlYXJlcikgPT5cbiAgICAgICAgICAgICAgZmV0Y2hKc29uKHRoaXMuYmFzZSArIHJvdXRlcy5tZXRyaWNzKCksIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJlYWNvbiksXG4gICAgICAgICAgICAgICAgaGVhZGVyczogYmVhcmVyID8geyBhdXRob3JpemF0aW9uOiBgQmVhcmVyICR7YmVhcmVyfWAgfSA6IHt9LFxuICAgICAgICAgICAgICAgIHRpbWVvdXRNczogNjAwMCxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5xdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIExlYXZlIHRoZSBxdWV1ZSBpbnRhY3Q7IHRoZSBuZXh0IGludGVydmFsIHJldHJpZXMuIE5vbmNlcyBtYWtlXG4gICAgICAgICAgICAvLyBzZXJ2ZXItc2lkZSBkdXBsaWNhdGVzIGltcG9zc2libGUuXG4gICAgICAgICAgICBkbG9nKFwibWV0cmljc1wiLCBcImZsdXNoIGZhaWxlZDsgd2lsbCByZXRyeVwiLCB7XG4gICAgICAgICAgICAgIGU6IFN0cmluZyhlKSxcbiAgICAgICAgICAgICAgcXVldWVkOiB0aGlzLnF1ZXVlLmxlbmd0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLnBlbmRpbmcgPSBudWxsO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZztcbiAgfVxufVxuIiwgImltcG9ydCB7IHJhbmRvbUJ5dGVzLCByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IG1lYW53aGlsZURpciB9IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG4vKipcbiAqIFN0YWJsZSBhbm9ueW1vdXMgZGV2aWNlIGlkLiBNaW50ZWQgb25jZSwgcGVyc2lzdGVkIGluIH4vLm1lYW53aGlsZSwgYW5kXG4gKiByZXVzZWQgYWNyb3NzIGVkaXRvciByZXN0YXJ0cyBzbyBpbXByZXNzaW9ucyBmcm9tIG9uZSBtYWNoaW5lIGFnZ3JlZ2F0ZS5cbiAqIE5vdCBkZXJpdmVkIGZyb20gYW55IGhhcmR3YXJlIGlkZW50aWZpZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXZpY2VJZCgpOiBzdHJpbmcge1xuICBjb25zdCBmaWxlID0gam9pbihtZWFud2hpbGVEaXIoKSwgXCJkZXZpY2UuanNvblwiKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoZmlsZSwgXCJ1dGY4XCIpKSBhcyB7IGNsaWVudElkPzogc3RyaW5nIH07XG4gICAgaWYgKGogJiYgdHlwZW9mIGouY2xpZW50SWQgPT09IFwic3RyaW5nXCIgJiYgai5jbGllbnRJZC5sZW5ndGggPj0gOCkge1xuICAgICAgcmV0dXJuIGouY2xpZW50SWQ7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiBtaW50IGJlbG93ICovXG4gIH1cbiAgY29uc3QgaWQgPSBgZGV2XyR7cmFuZG9tQnl0ZXMoMTIpLnRvU3RyaW5nKFwiYmFzZTY0dXJsXCIpfWA7XG4gIHRyeSB7XG4gICAgd3JpdGVGaWxlU3luYyhmaWxlLCBKU09OLnN0cmluZ2lmeSh7IGNsaWVudElkOiBpZCB9LCBudWxsLCAyKSArIFwiXFxuXCIsIHtcbiAgICAgIG1vZGU6IDBvNjAwLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvKiBzdGlsbCB1c2FibGUgaW4tbWVtb3J5IGZvciB0aGlzIHNlc3Npb24gKi9cbiAgfVxuICByZXR1cm4gaWQ7XG59XG5cbi8qKiBVbmlxdWUgcGVyLWV2ZW50IG5vbmNlIGZvciBtZXRyaWMgZGVkdXBlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50Tm9uY2UoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbVVVSUQoKTtcbn1cbiIsICJpbXBvcnQgeyB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFBvcnRmb2xpb1Jlc3BvbnNlLFxuICBTcG9uc29yLFxuICBTdXJmYWNlLFxufSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aFwiO1xuaW1wb3J0IHsgbWVhbndoaWxlRGlyIH0gZnJvbSBcIi4vY29uZmlnXCI7XG5pbXBvcnQgeyBmZXRjaEpzb24gfSBmcm9tIFwiLi9odHRwXCI7XG5pbXBvcnQgeyBkbG9nIH0gZnJvbSBcIi4vbG9nXCI7XG5cbi8qKiBPbi1kaXNrIGNhY2hlIGNvbnN1bWVkIGJ5IHRoZSBDTEkgc3VyZmFjZXMgKHN0YXR1c2xpbmUgc2NyaXB0LCB3cmFwcGVycykuXG4gKiAgVG9rZW5zIG5ldmVyIGFwcGVhciBoZXJlIFx1MjAxNCBvbmx5IGRpc3BsYXlhYmxlIHNwb25zb3IgZGF0YS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3BvbnNvckNhY2hlRmlsZSB7XG4gIHVwZGF0ZWRBdE1zOiBudW1iZXI7XG4gIHR0bE1zOiBudW1iZXI7XG4gIHJvdGF0aW9uSW50ZXJ2YWxNczogbnVtYmVyO1xuICB2aWV3VGhyZXNob2xkTXM6IG51bWJlcjtcbiAgc3BvbnNvcnM6IFNwb25zb3JbXTtcbn1cblxuZXhwb3J0IGNvbnN0IFNQT05TT1JfQ0FDSEVfRklMRSA9IFwic3BvbnNvcnMuanNvblwiO1xuXG4vKipcbiAqIEZldGNoZXMgYW5kIGNhY2hlcyB0aGUgc3BvbnNvciBwb3J0Zm9saW8uIE9uZSBzZXJ2aWNlIGluc3RhbmNlIHNlcnZlcyBldmVyeVxuICogc3VyZmFjZTogd2Vidmlld3MgcHVsbCBmcm9tIG1lbW9yeSB2aWEgdGhlIGxvb3BiYWNrLCBDTEkgc2NyaXB0cyByZWFkIHRoZVxuICogSlNPTiBjYWNoZSB0aGlzIHdyaXRlcyBhZnRlciBlYWNoIHJlZnJlc2guXG4gKi9cbmV4cG9ydCBjbGFzcyBQb3J0Zm9saW9TZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjdXJyZW50OiBQb3J0Zm9saW9SZXNwb25zZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGZldGNoZWRBdE1zID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50SWQ6IHN0cmluZyxcbiAgKSB7fVxuXG4gIGdldCBwb3J0Zm9saW8oKTogUG9ydGZvbGlvUmVzcG9uc2UgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50O1xuICB9XG5cbiAgZ2V0IHN0YWxlKCk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5jdXJyZW50KSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSAtIHRoaXMuZmV0Y2hlZEF0TXMgPiB0aGlzLmN1cnJlbnQudHRsTXM7XG4gIH1cblxuICAvKiogVGhlIHNwb25zb3IgZm9yIFwibm93XCI6IHRpbWUtc2xvdCByb3RhdGlvbiB0aHJvdWdoIHRoZSBxdWV1ZSBzbyBldmVyeVxuICAgKiAgc3VyZmFjZSBzaG93cyB0aGUgc2FtZSBsaW5lIGF0IHRoZSBzYW1lIG1vbWVudCB3aXRob3V0IGNvb3JkaW5hdGlvbi4gKi9cbiAgY3VycmVudFNwb25zb3IoKTogU3BvbnNvciB8IG51bGwge1xuICAgIGNvbnN0IHAgPSB0aGlzLmN1cnJlbnQ7XG4gICAgaWYgKCFwIHx8IHAuc3BvbnNvcnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBzbG90ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gTWF0aC5tYXgocC5yb3RhdGlvbkludGVydmFsTXMsIDUwMDApKTtcbiAgICByZXR1cm4gcC5zcG9uc29yc1tzbG90ICUgcC5zcG9uc29ycy5sZW5ndGhdO1xuICB9XG5cbiAgYXN5bmMgcmVmcmVzaChzdXJmYWNlOiBTdXJmYWNlID0gXCJjY193ZWJ2aWV3XCIpOiBQcm9taXNlPFBvcnRmb2xpb1Jlc3BvbnNlIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwID0gYXdhaXQgdGhpcy5hdXRoLndpdGhBdXRoKChiZWFyZXIpID0+XG4gICAgICAgIGZldGNoSnNvbjxQb3J0Zm9saW9SZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLnBvcnRmb2xpbyhzdXJmYWNlLCB0aGlzLmNsaWVudElkKSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBoZWFkZXJzOiBiZWFyZXIgPyB7IGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtiZWFyZXJ9YCB9IDoge30sXG4gICAgICAgICAgfSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICB0aGlzLmN1cnJlbnQgPSBwO1xuICAgICAgdGhpcy5mZXRjaGVkQXRNcyA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLndyaXRlQ2xpQ2FjaGUocCk7XG4gICAgICBkbG9nKFwicG9ydGZvbGlvXCIsIFwicmVmcmVzaGVkXCIsIHtcbiAgICAgICAgbjogcC5zcG9uc29ycy5sZW5ndGgsXG4gICAgICAgIHNpZ25lZEluOiB0aGlzLmF1dGguc2lnbmVkSW4sXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBwO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRsb2coXCJwb3J0Zm9saW9cIiwgXCJyZWZyZXNoIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBNaXJyb3IgdGhlIGxhdGVzdCBwb3J0Zm9saW8gZm9yIG91dC1vZi1wcm9jZXNzIENMSSBzdXJmYWNlcy4gKi9cbiAgcHJpdmF0ZSB3cml0ZUNsaUNhY2hlKHA6IFBvcnRmb2xpb1Jlc3BvbnNlKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZTogU3BvbnNvckNhY2hlRmlsZSA9IHtcbiAgICAgIHVwZGF0ZWRBdE1zOiBEYXRlLm5vdygpLFxuICAgICAgdHRsTXM6IHAudHRsTXMsXG4gICAgICByb3RhdGlvbkludGVydmFsTXM6IHAucm90YXRpb25JbnRlcnZhbE1zLFxuICAgICAgdmlld1RocmVzaG9sZE1zOiBwLnZpZXdUaHJlc2hvbGRNcyxcbiAgICAgIHNwb25zb3JzOiBwLnNwb25zb3JzLFxuICAgIH07XG4gICAgdHJ5IHtcbiAgICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICAgIGpvaW4obWVhbndoaWxlRGlyKCksIFNQT05TT1JfQ0FDSEVfRklMRSksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGZpbGUsIG51bGwsIDIpICsgXCJcXG5cIixcbiAgICAgICAgeyBtb2RlOiAwbzYwMCB9LFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwicG9ydGZvbGlvXCIsIFwiY2xpIGNhY2hlIHdyaXRlIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgeyByYW5kb21CeXRlcyB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jLCB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB0eXBlIHsgSW5jb21pbmdNZXNzYWdlLCBTZXJ2ZXIsIFNlcnZlclJlc3BvbnNlIH0gZnJvbSBcIm5vZGU6aHR0cFwiO1xuaW1wb3J0IHsgY3JlYXRlU2VydmVyIH0gZnJvbSBcIm5vZGU6aHR0cFwiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCAqIGFzIHZzY29kZSBmcm9tIFwidnNjb2RlXCI7XG5pbXBvcnQgdHlwZSB7IE1ldHJpY0V2ZW50LCBTdXJmYWNlIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC9jb250cmFjdFwiO1xuaW1wb3J0IHsgQUxMX1NVUkZBQ0VTLCBCSUxMQUJMRV9FVkVOVFMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi9jb25maWdcIjtcbmltcG9ydCB7IGRsb2cgfSBmcm9tIFwiLi9sb2dcIjtcbmltcG9ydCB0eXBlIHsgTWV0cmljc0NsaWVudCB9IGZyb20gXCIuL21ldHJpY3NcIjtcbmltcG9ydCB7IGV2ZW50Tm9uY2UgfSBmcm9tIFwiLi9pZHNcIjtcbmltcG9ydCB0eXBlIHsgUG9ydGZvbGlvU2VydmljZSB9IGZyb20gXCIuL3BvcnRmb2xpb1wiO1xuXG4vKipcbiAqIExvY2FsIGJyaWRnZSBiZXR3ZWVuIHBhdGNoZWQgd2VidmlldyBidW5kbGVzIGFuZCB0aGUgZXh0ZW5zaW9uIGhvc3QuXG4gKlxuICogV2VidmlldyBKUyBjYW5ub3QgcmVhY2ggdGhlIGJhY2tlbmQgKENTUCkgb3IgdGhlIGZpbGVzeXN0ZW0sIHNvIGl0IHRhbGtzIHRvXG4gKiAxMjcuMC4wLjE6PHBvcnQ+IGluc3RlYWQuIFRoZSBwb3J0ICsgdG9rZW4gYXJlIHBlcnNpc3RlZCBpblxuICogfi8ubWVhbndoaWxlL2xvb3BiYWNrLmpzb247IHRoZSB3ZWJ2aWV3IHBhdGNoZXIgKE0xZSkgaW5saW5lcyBib3RoIGludG8gdGhlXG4gKiBpbmplY3RlZCBzbmlwcGV0LiBCaW5kaW5nIHByZWZlcnMgdGhlIHBlcnNpc3RlZCBwb3J0IHNvIGEgcGF0Y2hlZCBidW5kbGVcbiAqIGtlZXBzIHdvcmtpbmcgYWNyb3NzIGVkaXRvciByZXN0YXJ0cyB3aXRob3V0IHJlLXBhdGNoaW5nLlxuICovXG5cbmNvbnN0IEJBU0VfUE9SVCA9IDQ4NzU3O1xuY29uc3QgUE9SVF9BVFRFTVBUUyA9IDEwO1xuY29uc3QgRElTQ09WRVJZX0ZJTEUgPSBcImxvb3BiYWNrLmpzb25cIjtcblxuaW50ZXJmYWNlIERpc2NvdmVyeSB7XG4gIHBvcnQ6IG51bWJlcjtcbiAgdG9rZW46IHN0cmluZztcbiAgcGlkOiBudW1iZXI7XG4gIHN0YXJ0ZWRBdE1zOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBXZWJ2aWV3TWV0cmljQm9keSB7XG4gIGV2ZW50Pzogc3RyaW5nO1xuICBzcG9uc29ySWQ/OiBzdHJpbmc7XG4gIGNhbXBhaWduSWQ/OiBzdHJpbmc7XG4gIHN1cmZhY2U/OiBzdHJpbmc7XG4gIHNlc3Npb25Ub2tlbj86IHN0cmluZztcbiAgdmlzaWJsZU1zPzogbnVtYmVyO1xuICBjbGlja1VybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIExvb3BiYWNrIHtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IFNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwb3J0ID0gMDtcbiAgdG9rZW4gPSBcIlwiO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcG9ydGZvbGlvOiBQb3J0Zm9saW9TZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbWV0cmljczogTWV0cmljc0NsaWVudCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNsaWVudElkOiBzdHJpbmcsXG4gICkge31cblxuICBwcml2YXRlIGRpc2NvdmVyeVBhdGgoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gam9pbihtZWFud2hpbGVEaXIoKSwgRElTQ09WRVJZX0ZJTEUpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkUGVyc2lzdGVkKCk6IERpc2NvdmVyeSB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBqID0gSlNPTi5wYXJzZShcbiAgICAgICAgcmVhZEZpbGVTeW5jKHRoaXMuZGlzY292ZXJ5UGF0aCgpLCBcInV0ZjhcIiksXG4gICAgICApIGFzIERpc2NvdmVyeTtcbiAgICAgIHJldHVybiBqICYmIHR5cGVvZiBqLnBvcnQgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mIGoudG9rZW4gPT09IFwic3RyaW5nXCJcbiAgICAgICAgPyBqXG4gICAgICAgIDogbnVsbDtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHBlcnNpc3RlZCA9IHRoaXMubG9hZFBlcnNpc3RlZCgpO1xuICAgIHRoaXMudG9rZW4gPSBwZXJzaXN0ZWQ/LnRva2VuIHx8IHJhbmRvbUJ5dGVzKDE2KS50b1N0cmluZyhcImJhc2U2NHVybFwiKTtcblxuICAgIGNvbnN0IGNhbmRpZGF0ZXM6IG51bWJlcltdID0gW107XG4gICAgaWYgKHBlcnNpc3RlZD8ucG9ydCkgY2FuZGlkYXRlcy5wdXNoKHBlcnNpc3RlZC5wb3J0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IFBPUlRfQVRURU1QVFM7IGkrKykge1xuICAgICAgY29uc3QgcCA9IEJBU0VfUE9SVCArIGk7XG4gICAgICBpZiAoIWNhbmRpZGF0ZXMuaW5jbHVkZXMocCkpIGNhbmRpZGF0ZXMucHVzaChwKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHBvcnQgb2YgY2FuZGlkYXRlcykge1xuICAgICAgY29uc3Qgb2sgPSBhd2FpdCB0aGlzLnRyeUxpc3Rlbihwb3J0KTtcbiAgICAgIGlmIChvaykge1xuICAgICAgICB0aGlzLnBvcnQgPSBwb3J0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0aGlzLnBvcnQpIHtcbiAgICAgIGRsb2coXCJsb29wYmFja1wiLCBcIm5vIHBvcnQgYXZhaWxhYmxlOyB3ZWJ2aWV3IHN1cmZhY2UgZGlzYWJsZWRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZDogRGlzY292ZXJ5ID0ge1xuICAgICAgcG9ydDogdGhpcy5wb3J0LFxuICAgICAgdG9rZW46IHRoaXMudG9rZW4sXG4gICAgICBwaWQ6IHByb2Nlc3MucGlkLFxuICAgICAgc3RhcnRlZEF0TXM6IERhdGUubm93KCksXG4gICAgfTtcbiAgICB0cnkge1xuICAgICAgd3JpdGVGaWxlU3luYyh0aGlzLmRpc2NvdmVyeVBhdGgoKSwgSlNPTi5zdHJpbmdpZnkoZCwgbnVsbCwgMikgKyBcIlxcblwiLCB7XG4gICAgICAgIG1vZGU6IDBvNjAwLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGxvZyhcImxvb3BiYWNrXCIsIFwiZGlzY292ZXJ5IHdyaXRlIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICB9XG4gICAgZGxvZyhcImxvb3BiYWNrXCIsIFwibGlzdGVuaW5nXCIsIHsgcG9ydDogdGhpcy5wb3J0IH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB0cnlMaXN0ZW4ocG9ydDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBzcnYgPSBjcmVhdGVTZXJ2ZXIoKHJlcSwgcmVzKSA9PiB2b2lkIHRoaXMucm91dGUocmVxLCByZXMpKTtcbiAgICAgIHNydi5vbmNlKFwiZXJyb3JcIiwgKCkgPT4gcmVzb2x2ZShmYWxzZSkpO1xuICAgICAgc3J2Lmxpc3Rlbihwb3J0LCBcIjEyNy4wLjAuMVwiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc2VydmVyID0gc3J2O1xuICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBkaXNwb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuc2VydmVyPy5jbG9zZSgpO1xuICAgIHRoaXMuc2VydmVyID0gbnVsbDtcbiAgfVxuXG4gIC8vIC0tLSByb3V0aW5nIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIHByaXZhdGUgYXN5bmMgcm91dGUoXG4gICAgcmVxOiBJbmNvbWluZ01lc3NhZ2UsXG4gICAgcmVzOiBTZXJ2ZXJSZXNwb25zZSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsIHx8IFwiL1wiLCBgaHR0cDovLzEyNy4wLjAuMToke3RoaXMucG9ydH1gKTtcbiAgICAvLyBDT1JTIGZpcnN0OiB3ZWJ2aWV3IG9yaWdpbnMgYXJlIG9wYXF1ZSAodnNjb2RlLXdlYnZpZXc6Ly9cdTIwMjYpLlxuICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIiwgXCIqXCIpO1xuICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCIsIFwiR0VULCBQT1NULCBPUFRJT05TXCIpO1xuICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCIsIFwiY29udGVudC10eXBlXCIpO1xuICAgIGlmIChyZXEubWV0aG9kID09PSBcIk9QVElPTlNcIikge1xuICAgICAgcmVzLndyaXRlSGVhZCgyMDQpLmVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodXJsLnBhdGhuYW1lID09PSBcIi9oZWFsdGhcIikge1xuICAgICAgdGhpcy5qc29uKHJlcywgMjAwLCB7IG9rOiB0cnVlIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJ0XCIpICE9PSB0aGlzLnRva2VuKSB7XG4gICAgICB0aGlzLmpzb24ocmVzLCA0MDMsIHsgZXJyb3I6IFwiYmFkIHRva2VuXCIgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGlmIChyZXEubWV0aG9kID09PSBcIkdFVFwiICYmIHVybC5wYXRobmFtZSA9PT0gXCIvdjEvc3BvbnNvcnNcIikge1xuICAgICAgICBjb25zdCBwID0gdGhpcy5wb3J0Zm9saW8ucG9ydGZvbGlvO1xuICAgICAgICB0aGlzLmpzb24ocmVzLCAyMDAsIHtcbiAgICAgICAgICBzcG9uc29yczogcD8uc3BvbnNvcnMgPz8gW10sXG4gICAgICAgICAgcm90YXRpb25JbnRlcnZhbE1zOiBwPy5yb3RhdGlvbkludGVydmFsTXMgPz8gMzBfMDAwLFxuICAgICAgICAgIHZpZXdUaHJlc2hvbGRNczogcD8udmlld1RocmVzaG9sZE1zID8/IDNfMDAwLFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5tZXRob2QgPT09IFwiUE9TVFwiICYmIHVybC5wYXRobmFtZSA9PT0gXCIvdjEvbWV0cmljc1wiKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSAoYXdhaXQgdGhpcy5yZWFkSnNvbihyZXEpKSBhcyBXZWJ2aWV3TWV0cmljQm9keTtcbiAgICAgICAgY29uc3QgYWNjZXB0ZWQgPSB0aGlzLmZvcndhcmRNZXRyaWMoYm9keSk7XG4gICAgICAgIHRoaXMuanNvbihyZXMsIGFjY2VwdGVkID8gMjAwIDogNDAwLCB7IG9rOiBhY2NlcHRlZCB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5tZXRob2QgPT09IFwiUE9TVFwiICYmIHVybC5wYXRobmFtZSA9PT0gXCIvdjEvY2xpY2tcIikge1xuICAgICAgICBjb25zdCBib2R5ID0gKGF3YWl0IHRoaXMucmVhZEpzb24ocmVxKSkgYXMgV2Vidmlld01ldHJpY0JvZHk7XG4gICAgICAgIGNvbnN0IG9wZW5lZCA9IGF3YWl0IHRoaXMuaGFuZGxlQ2xpY2soYm9keSk7XG4gICAgICAgIHRoaXMuanNvbihyZXMsIG9wZW5lZCA/IDIwMCA6IDQwMCwgeyBvazogb3BlbmVkIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmpzb24ocmVzLCA0MDQsIHsgZXJyb3I6IFwibm90IGZvdW5kXCIgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGxvZyhcImxvb3BiYWNrXCIsIFwicm91dGUgZXJyb3JcIiwgeyBwYXRoOiB1cmwucGF0aG5hbWUsIGU6IFN0cmluZyhlKSB9KTtcbiAgICAgIHRoaXMuanNvbihyZXMsIDUwMCwgeyBlcnJvcjogXCJpbnRlcm5hbFwiIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZm9yd2FyZE1ldHJpYyhib2R5OiBXZWJ2aWV3TWV0cmljQm9keSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGV2ZW50ID0gYm9keS5ldmVudCBhcyBNZXRyaWNFdmVudDtcbiAgICBjb25zdCBzdXJmYWNlID0gYm9keS5zdXJmYWNlIGFzIFN1cmZhY2U7XG4gICAgaWYgKCFCSUxMQUJMRV9FVkVOVFMuaW5jbHVkZXMoZXZlbnQpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFBTExfU1VSRkFDRVMuaW5jbHVkZXMoc3VyZmFjZSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIWJvZHkuc3BvbnNvcklkIHx8ICFib2R5LmNhbXBhaWduSWQpIHJldHVybiBmYWxzZTtcbiAgICB0aGlzLm1ldHJpY3MuZW5xdWV1ZSh7XG4gICAgICBldmVudCxcbiAgICAgIHNwb25zb3JJZDogYm9keS5zcG9uc29ySWQsXG4gICAgICBjYW1wYWlnbklkOiBib2R5LmNhbXBhaWduSWQsXG4gICAgICBzdXJmYWNlLFxuICAgICAgY2xpZW50SWQ6IHRoaXMuY2xpZW50SWQsXG4gICAgICBzZXNzaW9uVG9rZW46IGJvZHkuc2Vzc2lvblRva2VuID8/IFwiXCIsXG4gICAgICBub25jZTogZXZlbnROb25jZSgpLFxuICAgICAgdHM6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIC4uLih0eXBlb2YgYm9keS52aXNpYmxlTXMgPT09IFwibnVtYmVyXCJcbiAgICAgICAgPyB7IHZpc2libGVNczogYm9keS52aXNpYmxlTXMgfVxuICAgICAgICA6IHt9KSxcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlQ2xpY2soYm9keTogV2Vidmlld01ldHJpY0JvZHkpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCByYXcgPSAoYm9keS5jbGlja1VybCB8fCBcIlwiKS50cmltKCk7XG4gICAgaWYgKCEvXmh0dHBzOlxcL1xcLy9pLnRlc3QocmF3KSkgcmV0dXJuIGZhbHNlO1xuICAgIHRoaXMuZm9yd2FyZE1ldHJpYyh7IC4uLmJvZHksIGV2ZW50OiBcImNsaWNrXCIgfSk7XG4gICAgYXdhaXQgdnNjb2RlLmVudi5vcGVuRXh0ZXJuYWwodnNjb2RlLlVyaS5wYXJzZShyYXcpKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIC0tLSBoZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBwcml2YXRlIGpzb24ocmVzOiBTZXJ2ZXJSZXNwb25zZSwgc3RhdHVzOiBudW1iZXIsIGJvZHk6IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBidWYgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgIFwiY29udGVudC10eXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgXCJjb250ZW50LWxlbmd0aFwiOiBidWYubGVuZ3RoLFxuICAgIH0pO1xuICAgIHJlcy5lbmQoYnVmKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVhZEpzb24ocmVxOiBJbmNvbWluZ01lc3NhZ2UpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgY2h1bmtzOiBCdWZmZXJbXSA9IFtdO1xuICAgICAgbGV0IHNpemUgPSAwO1xuICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoYzogQnVmZmVyKSA9PiB7XG4gICAgICAgIHNpemUgKz0gYy5sZW5ndGg7XG4gICAgICAgIGlmIChzaXplID4gNjQgKiAxMDI0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcImJvZHkgdG9vIGxhcmdlXCIpKTtcbiAgICAgICAgICByZXEuZGVzdHJveSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjaHVua3MucHVzaChjKTtcbiAgICAgIH0pO1xuICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKFwidXRmOFwiKSkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJlcS5vbihcImVycm9yXCIsIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUNBLElBQUFBLGtCQUE2QjtBQUM3QixJQUFBQyxrQkFBd0I7QUFDeEIsSUFBQUMsb0JBQXFCOzs7QUNHZCxJQUFNLGFBQXVCLENBQUM7QUFFOUIsSUFBTSxNQUFNO0FBQUEsRUFD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QUFBQSxRQUNULGNBQWMsR0FBRztBQUFBLFFBQ2pCLFVBQVUsR0FBRztBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0EsUUFBTSxxQkFBcUIsTUFBTSxFQUFFO0FBQ25DLFFBQU0sK0JBQStCLFdBQVcsV0FBVyxHQUFHLFVBQVU7QUFHeEUsUUFBTSxRQUFRLE1BQU07QUFDcEIsUUFBTSxRQUFRLE1BQU07QUFBQSxJQUNsQixHQUFHLElBQUk7QUFBQSxJQUNQLEVBQUUsU0FBUyxFQUFFLGVBQWUsVUFBVSxLQUFLLFdBQVcsR0FBRyxFQUFFO0FBQUEsRUFDN0Q7QUFDQSxRQUFNLFFBQ0osS0FBSztBQUFBLEtBQ0YsV0FBVyxNQUFNLFdBQVcsSUFBSSxXQUFXLE9BQU8sV0FBVyxLQUFLO0FBQUEsRUFDckUsSUFBSTtBQUVOLFFBQU0sMkJBQTJCLFVBQVUsTUFBTTtBQUFBLElBQy9DLFFBQVEsT0FBTztBQUFBLElBQ2YsT0FBTyxNQUFNO0FBQUEsSUFDYjtBQUFBLEVBQ0YsQ0FBQztBQUdELFFBQU0sWUFBWSxNQUFNLEtBQUssUUFBUTtBQUNyQyxRQUFNLG1CQUFtQixhQUFhLEtBQUssUUFBUTtBQUNuRCxRQUFNLEtBQUssUUFBUTtBQUNuQixRQUFNLGtCQUFrQixDQUFDLEtBQUssUUFBUTtBQUV0QyxPQUFLLFFBQVE7QUFDYixVQUFRLFFBQVE7QUFFaEIsVUFBUSxJQUFJLGFBQWEsSUFBSSxlQUFlO0FBQUEsRUFBSyxRQUFRLFdBQVc7QUFDcEUsVUFBUSxLQUFLLGFBQWEsSUFBSSxJQUFJLENBQUM7QUFDckM7QUFFQSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU07QUFDbEIsVUFBUSxNQUFNLG9CQUFvQixDQUFDO0FBQ25DLFVBQVEsS0FBSyxDQUFDO0FBQ2hCLENBQUM7IiwKICAibmFtZXMiOiBbImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX29zIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9vcyIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfY3J5cHRvIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiXQp9Cg==
