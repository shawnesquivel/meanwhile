"use strict";

// test/cli-live.ts
var import_node_child_process2 = require("node:child_process");
var import_node_fs7 = require("node:fs");
var import_node_os4 = require("node:os");
var import_node_path7 = require("node:path");

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

// src/adapters/claude-cli.ts
var import_node_child_process = require("node:child_process");
var import_node_fs3 = require("node:fs");
var import_node_os2 = require("node:os");
var import_node_path3 = require("node:path");

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
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
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

// src/adapters/settings-edit.ts
var STATUSLINE_MARKER = ".meanwhile/statusline.mjs";
function parse(src) {
  const trimmed = src.trim();
  if (trimmed === "") return {};
  const j = JSON.parse(trimmed);
  if (j === null || typeof j !== "object" || Array.isArray(j)) {
    throw new Error("settings.json is not an object");
  }
  return j;
}
function stringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}
function isOurStatusLine(v) {
  return typeof v === "object" && v !== null && typeof v.command === "string" && v.command.includes(STATUSLINE_MARKER);
}
function applySponsorSettings(src, opts) {
  const obj = parse(src);
  const conflicts = [];
  const prev = {
    hadStatusLine: "statusLine" in obj,
    statusLine: obj.statusLine,
    hadSpinnerVerbs: "spinnerVerbs" in obj,
    spinnerVerbs: obj.spinnerVerbs
  };
  let changed = false;
  const existing = obj.statusLine;
  if (existing !== void 0 && !isOurStatusLine(existing)) {
    conflicts.push("statusline_foreign");
  } else {
    const want = {
      type: "command",
      command: opts.statuslineCommand,
      padding: 0
    };
    if (JSON.stringify(existing) !== JSON.stringify(want)) {
      obj.statusLine = want;
      changed = true;
    }
  }
  if (opts.verbs !== null) {
    const hasForeign = prev.hadSpinnerVerbs && !opts.overwriteForeignVerbs;
    if (hasForeign) {
      conflicts.push("spinnerverbs_foreign");
    } else if (JSON.stringify(obj.spinnerVerbs) !== JSON.stringify(opts.verbs)) {
      obj.spinnerVerbs = opts.verbs;
      changed = true;
    }
  }
  return { next: stringify(obj), prev, changed, conflicts };
}
function revertSponsorSettings(src, prev) {
  const obj = parse(src);
  if (isOurStatusLine(obj.statusLine)) {
    if (prev.hadStatusLine && !isOurStatusLine(prev.statusLine)) {
      obj.statusLine = prev.statusLine;
    } else {
      delete obj.statusLine;
    }
  }
  if (prev.hadSpinnerVerbs) obj.spinnerVerbs = prev.spinnerVerbs;
  else delete obj.spinnerVerbs;
  return stringify(obj);
}

// src/adapters/claude-cli.ts
var STATE_FILE = "claude-cli-state.json";
var SCRIPT_NAME = "statusline.mjs";
var MIN_VERBS_VERSION = [2, 1, 143];
function settingsPath() {
  return (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".claude", "settings.json");
}
function statePath() {
  return (0, import_node_path3.join)(meanwhileDir(), STATE_FILE);
}
function scriptPath() {
  return (0, import_node_path3.join)(meanwhileDir(), SCRIPT_NAME);
}
function parseVersion(s) {
  const m = s.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}
var CLAUDE_CANDIDATES = [
  "claude",
  (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".local", "bin", "claude"),
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude"
];
function claudeVersion() {
  const tryOne = (bin) => new Promise((resolve) => {
    (0, import_node_child_process.execFile)(bin, ["--version"], { timeout: 8e3 }, (err, stdout) => {
      resolve(err ? null : String(stdout).trim() || null);
    });
  });
  return (async () => {
    for (const bin of CLAUDE_CANDIDATES) {
      const v = await tryOne(bin);
      if (v) return v;
    }
    return null;
  })();
}
var ClaudeCliAdapter = class {
  constructor() {
    this.id = "claude_cli";
  }
  async detect() {
    if (this.versionCache === void 0) {
      this.versionCache = await claudeVersion();
    }
    const v = this.versionCache ? parseVersion(this.versionCache) : null;
    return {
      settingsPath: settingsPath(),
      settingsDirExists: (0, import_node_fs3.existsSync)((0, import_node_path3.join)((0, import_node_os2.homedir)(), ".claude")),
      version: this.versionCache ?? null,
      verbsSupported: v !== null && gte(v, MIN_VERBS_VERSION)
    };
  }
  isPatched() {
    return (0, import_node_fs3.existsSync)(statePath());
  }
  loadState() {
    try {
      return JSON.parse((0, import_node_fs3.readFileSync)(statePath(), "utf8"));
    } catch {
      return null;
    }
  }
  /** Install/refresh the statusline script asset (idempotent). */
  installScript(extensionDistDir) {
    const asset = (0, import_node_path3.join)(extensionDistDir, "adapters", "statusline.asset.mjs");
    (0, import_node_fs3.copyFileSync)(asset, scriptPath());
    (0, import_node_fs3.chmodSync)(scriptPath(), 493);
  }
  /** Spinner verbs derived from the sponsor queue (text only — the spinner
   *  is not clickable). Claude Code appends its own ellipsis/timer. */
  verbsFrom(sponsors) {
    const verbs = sponsors.map((s) => s.brand ? `${s.text} \u2014 ${s.brand}` : s.text).map((t) => t.slice(0, 60));
    return verbs.length > 0 ? verbs : [];
  }
  /**
   * Apply (or re-apply) the patch. Safe to call on every portfolio refresh:
   * it rewrites settings.json only when the desired state actually differs.
   */
  async patch(opts) {
    const det = await this.detect();
    if (!det.settingsDirExists) {
      dlog("cc-cli", "no ~/.claude \u2014 skipping");
      return { ok: false, conflicts: ["no_claude_dir"] };
    }
    (0, import_node_fs3.mkdirSync)(meanwhileDir(), { recursive: true });
    this.installScript(opts.extensionDistDir);
    const sp = settingsPath();
    const src = (0, import_node_fs3.existsSync)(sp) ? (0, import_node_fs3.readFileSync)(sp, "utf8") : "{}";
    const backupDir = (0, import_node_path3.join)(meanwhileDir(), "backups");
    (0, import_node_fs3.mkdirSync)(backupDir, { recursive: true });
    const origBackup = (0, import_node_path3.join)(backupDir, "claude-settings.orig.json");
    if (!(0, import_node_fs3.existsSync)(origBackup)) (0, import_node_fs3.writeFileSync)(origBackup, src);
    (0, import_node_fs3.writeFileSync)((0, import_node_path3.join)(backupDir, "claude-settings.last.json"), src);
    const prior = this.loadState();
    const verbs = det.verbsSupported ? this.verbsFrom(opts.sponsors) : null;
    let result;
    try {
      result = applySponsorSettings(src, {
        statuslineCommand: `node "${scriptPath()}"`,
        verbs: verbs && verbs.length > 0 ? verbs : null,
        // If we patched before, the current spinnerVerbs value is ours and
        // may be rewritten freely; otherwise an existing value is the user's.
        overwriteForeignVerbs: prior?.verbsApplied === true
      });
    } catch (e) {
      dlog("cc-cli", "settings parse failed; refusing to touch", {
        e: String(e)
      });
      return { ok: false, conflicts: ["settings_unparseable"] };
    }
    if (result.changed) (0, import_node_fs3.writeFileSync)(sp, result.next);
    const state = {
      prev: prior?.prev ?? result.prev,
      verbsApplied: prior?.verbsApplied === true || verbs !== null && verbs.length > 0 && !result.conflicts.includes("spinnerverbs_foreign"),
      appliedAtMs: Date.now()
    };
    (0, import_node_fs3.writeFileSync)(statePath(), JSON.stringify(state, null, 2) + "\n");
    dlog("cc-cli", "patched", {
      changed: result.changed,
      conflicts: result.conflicts,
      verbs: verbs?.length ?? 0
    });
    return { ok: true, conflicts: result.conflicts };
  }
  /** Revert our keys to their pre-patch values and drop the state file. */
  restore() {
    const state = this.loadState();
    const sp = settingsPath();
    if (!state) {
      return { ok: true, detail: "nothing to restore" };
    }
    try {
      const src = (0, import_node_fs3.existsSync)(sp) ? (0, import_node_fs3.readFileSync)(sp, "utf8") : "{}";
      const next = revertSponsorSettings(src, state.prev);
      (0, import_node_fs3.writeFileSync)(sp, next);
      (0, import_node_fs3.unlinkSync)(statePath());
      try {
        (0, import_node_fs3.unlinkSync)(scriptPath());
      } catch {
      }
      dlog("cc-cli", "restored");
      return { ok: true };
    } catch (e) {
      dlog("cc-cli", "restore failed", { e: String(e) });
      return { ok: false, detail: String(e) };
    }
  }
};

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

// src/cli-events.ts
var import_node_fs5 = require("node:fs");
var import_node_path5 = require("node:path");

// src/ids.ts
var import_node_crypto = require("node:crypto");
var import_node_fs4 = require("node:fs");
var import_node_path4 = require("node:path");
function deviceId() {
  const file = (0, import_node_path4.join)(meanwhileDir(), "device.json");
  try {
    const j = JSON.parse((0, import_node_fs4.readFileSync)(file, "utf8"));
    if (j && typeof j.clientId === "string" && j.clientId.length >= 8) {
      return j.clientId;
    }
  } catch {
  }
  const id = `dev_${(0, import_node_crypto.randomBytes)(12).toString("base64url")}`;
  try {
    (0, import_node_fs4.writeFileSync)(file, JSON.stringify({ clientId: id }, null, 2) + "\n", {
      mode: 384
    });
  } catch {
  }
  return id;
}
function eventNonce() {
  return (0, import_node_crypto.randomUUID)();
}

// src/cli-events.ts
var EVENTS_FILE = "cli-events.jsonl";
function drainCliEvents(metrics, clientId) {
  const file = (0, import_node_path5.join)(meanwhileDir(), EVENTS_FILE);
  if (!(0, import_node_fs5.existsSync)(file)) return 0;
  const tmp = file + ".draining";
  try {
    (0, import_node_fs5.renameSync)(file, tmp);
  } catch {
    return 0;
  }
  let drained = 0;
  try {
    const lines = (0, import_node_fs5.readFileSync)(tmp, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let j;
      try {
        j = JSON.parse(t);
      } catch {
        continue;
      }
      const event = j.event;
      const surface = j.surface;
      if (!BILLABLE_EVENTS.includes(event)) continue;
      if (!ALL_SURFACES.includes(surface)) continue;
      if (!j.sponsorId || !j.campaignId) continue;
      metrics.enqueue({
        event,
        sponsorId: j.sponsorId,
        campaignId: j.campaignId,
        surface,
        clientId,
        sessionToken: j.sessionToken ?? "",
        nonce: eventNonce(),
        ts: j.ts || (/* @__PURE__ */ new Date()).toISOString(),
        ...typeof j.visibleMs === "number" ? { visibleMs: j.visibleMs } : {}
      });
      drained++;
    }
  } finally {
    try {
      (0, import_node_fs5.unlinkSync)(tmp);
    } catch {
    }
  }
  if (drained > 0) dlog("cli-events", "drained", { drained });
  return drained;
}

// src/metrics.ts
var import_node_os3 = require("node:os");
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
        os: (0, import_node_os3.platform)(),
        arch: (0, import_node_os3.arch)(),
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
var import_node_fs6 = require("node:fs");
var import_node_path6 = require("node:path");
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
      (0, import_node_fs6.writeFileSync)(
        (0, import_node_path6.join)(meanwhileDir(), SPONSOR_CACHE_FILE),
        JSON.stringify(file, null, 2) + "\n",
        { mode: 384 }
      );
    } catch (e) {
      dlog("portfolio", "cli cache write failed", { e: String(e) });
    }
  }
};

// test/cli-live.ts
var BASE = (process.env.MEANWHILE_BASE || "http://127.0.0.1:3100").replace(/\/+$/, "");
var SETTINGS = (0, import_node_path7.join)((0, import_node_os4.homedir)(), ".claude", "settings.json");
var MW = (0, import_node_path7.join)((0, import_node_os4.homedir)(), ".meanwhile");
var failures = 0;
var check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " \u2014 " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
async function main() {
  setDebug(true);
  const clientId = deviceId();
  const auth = new AuthService(new MemorySecrets(), BASE, clientId);
  const portfolio = new PortfolioService(auth, BASE, clientId);
  const metrics = new MetricsClient(auth, BASE, clientId);
  const originalRaw = (0, import_node_fs7.existsSync)(SETTINGS) ? (0, import_node_fs7.readFileSync)(SETTINGS, "utf8") : "{}";
  const original = JSON.parse(originalRaw || "{}");
  const p = await portfolio.refresh("cc_cli_statusline");
  check("portfolio fetched", (p?.sponsors.length ?? 0) > 0);
  const adapter = new ClaudeCliAdapter();
  const det = await adapter.detect();
  console.log("  detect:", JSON.stringify(det));
  const res = await adapter.patch({
    extensionDistDir: (0, import_node_path7.join)(process.cwd(), "dist"),
    sponsors: p?.sponsors ?? []
  });
  check("patch ok", res.ok, res);
  check("no conflicts on this machine", res.conflicts.length === 0, res.conflicts);
  const patched = JSON.parse((0, import_node_fs7.readFileSync)(SETTINGS, "utf8"));
  check(
    "statusLine installed",
    typeof patched.statusLine?.command === "string" && patched.statusLine.command.includes(".meanwhile/statusline.mjs"),
    patched.statusLine
  );
  check(
    "spinnerVerbs installed (CC >= 2.1.143)",
    !det.verbsSupported || Array.isArray(patched.spinnerVerbs) && patched.spinnerVerbs.length > 0,
    patched.spinnerVerbs
  );
  for (const k of Object.keys(original)) {
    check(
      `original key preserved: ${k}`,
      JSON.stringify(patched[k]) === JSON.stringify(original[k]) || k === "statusLine" || k === "spinnerVerbs"
    );
  }
  check("byte-exact backup exists", (0, import_node_fs7.existsSync)((0, import_node_path7.join)(MW, "backups", "claude-settings.orig.json")));
  const out = (0, import_node_child_process2.execFileSync)("node", [(0, import_node_path7.join)(MW, "statusline.mjs")], {
    input: JSON.stringify({ cwd: process.cwd(), model: { id: "test" } }),
    encoding: "utf8",
    timeout: 5e3
  });
  check("statusline prints a line", out.length > 0, out);
  check("statusline is OSC-8 linked", out.includes("\x1B]8;;https://"), JSON.stringify(out.slice(0, 40)));
  const shownSponsor = (p?.sponsors ?? []).some((s) => out.includes(s.text.slice(0, 20)));
  check("statusline shows a live sponsor", shownSponsor, out);
  (0, import_node_child_process2.execFileSync)("node", [(0, import_node_path7.join)(MW, "statusline.mjs")], { input: "{}", encoding: "utf8", timeout: 5e3 });
  const eventsRaw = (0, import_node_fs7.existsSync)((0, import_node_path7.join)(MW, "cli-events.jsonl")) ? (0, import_node_fs7.readFileSync)((0, import_node_path7.join)(MW, "cli-events.jsonl"), "utf8").trim() : "";
  const eventLines = eventsRaw === "" ? [] : eventsRaw.split("\n");
  check("exactly one impression per slot", eventLines.length === 1, eventLines);
  const drained = drainCliEvents(metrics, clientId);
  check("drained the impression", drained === 1, drained);
  await metrics.flush();
  check("events file consumed", !(0, import_node_fs7.existsSync)((0, import_node_path7.join)(MW, "cli-events.jsonl")));
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  const restored = JSON.parse((0, import_node_fs7.readFileSync)(SETTINGS, "utf8"));
  check("settings parse-equal to original", JSON.stringify(restored) === JSON.stringify(original), restored);
  check("statusline script removed", !(0, import_node_fs7.existsSync)((0, import_node_path7.join)(MW, "statusline.mjs")));
  let version = "";
  try {
    version = (0, import_node_child_process2.execFileSync)("claude", ["--version"], { encoding: "utf8", timeout: 1e4 }).trim();
  } catch {
  }
  check("claude --version still works", version.length > 0, version);
  metrics.dispose();
  console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("cli-live crashed:", e);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vdGVzdC9jbGktbGl2ZS50cyIsICIuLi90ZXN0L3ZzY29kZS1zdHViLnRzIiwgIi4uL3NyYy9hZGFwdGVycy9jbGF1ZGUtY2xpLnRzIiwgIi4uL3NyYy9jb25maWcudHMiLCAiLi4vc3JjL2xvZy50cyIsICIuLi9zcmMvYWRhcHRlcnMvc2V0dGluZ3MtZWRpdC50cyIsICIuLi8uLi9zaGFyZWQvY29udHJhY3QudHMiLCAiLi4vc3JjL2h0dHAudHMiLCAiLi4vc3JjL2F1dGgudHMiLCAiLi4vc3JjL2NsaS1ldmVudHMudHMiLCAiLi4vc3JjL2lkcy50cyIsICIuLi9zcmMvbWV0cmljcy50cyIsICIuLi9zcmMvcG9ydGZvbGlvLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG5pbXBvcnQgeyBleGVjRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gXCJub2RlOm9zXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgTWVtb3J5U2VjcmV0cyB9IGZyb20gXCIuL3ZzY29kZS1zdHViXCI7XG5pbXBvcnQgeyBDbGF1ZGVDbGlBZGFwdGVyIH0gZnJvbSBcIi4uL3NyYy9hZGFwdGVycy9jbGF1ZGUtY2xpXCI7XG5pbXBvcnQgeyBBdXRoU2VydmljZSB9IGZyb20gXCIuLi9zcmMvYXV0aFwiO1xuaW1wb3J0IHsgZHJhaW5DbGlFdmVudHMgfSBmcm9tIFwiLi4vc3JjL2NsaS1ldmVudHNcIjtcbmltcG9ydCB7IGRldmljZUlkIH0gZnJvbSBcIi4uL3NyYy9pZHNcIjtcbmltcG9ydCB7IHNldERlYnVnIH0gZnJvbSBcIi4uL3NyYy9sb2dcIjtcbmltcG9ydCB7IE1ldHJpY3NDbGllbnQgfSBmcm9tIFwiLi4vc3JjL21ldHJpY3NcIjtcbmltcG9ydCB7IFBvcnRmb2xpb1NlcnZpY2UgfSBmcm9tIFwiLi4vc3JjL3BvcnRmb2xpb1wiO1xuXG4vKipcbiAqIExJVkUgTTFjIHRlc3QgYWdhaW5zdCB0aGUgcmVhbCB+Ly5jbGF1ZGUvc2V0dGluZ3MuanNvbiAod2l0aCByZXN0b3JlIGF0IHRoZVxuICogZW5kIGFuZCBieXRlLWV4YWN0IG9yaWdpbmFsIGJhY2tlZCB1cCBieSB0aGUgYWRhcHRlciBpdHNlbGYpLiBSdW4gd2l0aCB0aGVcbiAqIGJhY2tlbmQgdXA6IE1FQU5XSElMRV9CQVNFPWh0dHA6Ly8xMjcuMC4wLjE6MzEwMFxuICovXG5cbmNvbnN0IEJBU0UgPSAocHJvY2Vzcy5lbnYuTUVBTldISUxFX0JBU0UgfHwgXCJodHRwOi8vMTI3LjAuMC4xOjMxMDBcIikucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcbmNvbnN0IFNFVFRJTkdTID0gam9pbihob21lZGlyKCksIFwiLmNsYXVkZVwiLCBcInNldHRpbmdzLmpzb25cIik7XG5jb25zdCBNVyA9IGpvaW4oaG9tZWRpcigpLCBcIi5tZWFud2hpbGVcIik7XG5cbmxldCBmYWlsdXJlcyA9IDA7XG5jb25zdCBjaGVjayA9IChuYW1lOiBzdHJpbmcsIG9rOiBib29sZWFuLCBkZXRhaWw/OiB1bmtub3duKSA9PiB7XG4gIGNvbnNvbGUubG9nKGAke29rID8gXCJQQVNTXCIgOiBcIkZBSUxcIn0gICR7bmFtZX0ke29rID8gXCJcIiA6IFwiIFx1MjAxNCBcIiArIEpTT04uc3RyaW5naWZ5KGRldGFpbCl9YCk7XG4gIGlmICghb2spIGZhaWx1cmVzKys7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBtYWluKCkge1xuICBzZXREZWJ1Zyh0cnVlKTtcbiAgY29uc3QgY2xpZW50SWQgPSBkZXZpY2VJZCgpO1xuICBjb25zdCBhdXRoID0gbmV3IEF1dGhTZXJ2aWNlKG5ldyBNZW1vcnlTZWNyZXRzKCkgYXMgbmV2ZXIsIEJBU0UsIGNsaWVudElkKTtcbiAgY29uc3QgcG9ydGZvbGlvID0gbmV3IFBvcnRmb2xpb1NlcnZpY2UoYXV0aCwgQkFTRSwgY2xpZW50SWQpO1xuICBjb25zdCBtZXRyaWNzID0gbmV3IE1ldHJpY3NDbGllbnQoYXV0aCwgQkFTRSwgY2xpZW50SWQpO1xuXG4gIGNvbnN0IG9yaWdpbmFsUmF3ID0gZXhpc3RzU3luYyhTRVRUSU5HUykgPyByZWFkRmlsZVN5bmMoU0VUVElOR1MsIFwidXRmOFwiKSA6IFwie31cIjtcbiAgY29uc3Qgb3JpZ2luYWwgPSBKU09OLnBhcnNlKG9yaWdpbmFsUmF3IHx8IFwie31cIik7XG5cbiAgLy8gMSkgZnJlc2ggZGVtbyBwb3J0Zm9saW8gXHUyMTkyIGNhY2hlIGZvciB0aGUgc3RhdHVzbGluZSBzY3JpcHRcbiAgY29uc3QgcCA9IGF3YWl0IHBvcnRmb2xpby5yZWZyZXNoKFwiY2NfY2xpX3N0YXR1c2xpbmVcIik7XG4gIGNoZWNrKFwicG9ydGZvbGlvIGZldGNoZWRcIiwgKHA/LnNwb25zb3JzLmxlbmd0aCA/PyAwKSA+IDApO1xuXG4gIC8vIDIpIHBhdGNoIHRoZSByZWFsIHNldHRpbmdzXG4gIGNvbnN0IGFkYXB0ZXIgPSBuZXcgQ2xhdWRlQ2xpQWRhcHRlcigpO1xuICBjb25zdCBkZXQgPSBhd2FpdCBhZGFwdGVyLmRldGVjdCgpO1xuICBjb25zb2xlLmxvZyhcIiAgZGV0ZWN0OlwiLCBKU09OLnN0cmluZ2lmeShkZXQpKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgYWRhcHRlci5wYXRjaCh7XG4gICAgZXh0ZW5zaW9uRGlzdERpcjogam9pbihwcm9jZXNzLmN3ZCgpLCBcImRpc3RcIiksXG4gICAgc3BvbnNvcnM6IHA/LnNwb25zb3JzID8/IFtdLFxuICB9KTtcbiAgY2hlY2soXCJwYXRjaCBva1wiLCByZXMub2ssIHJlcyk7XG4gIGNoZWNrKFwibm8gY29uZmxpY3RzIG9uIHRoaXMgbWFjaGluZVwiLCByZXMuY29uZmxpY3RzLmxlbmd0aCA9PT0gMCwgcmVzLmNvbmZsaWN0cyk7XG5cbiAgY29uc3QgcGF0Y2hlZCA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKFNFVFRJTkdTLCBcInV0ZjhcIikpO1xuICBjaGVjayhcbiAgICBcInN0YXR1c0xpbmUgaW5zdGFsbGVkXCIsXG4gICAgdHlwZW9mIHBhdGNoZWQuc3RhdHVzTGluZT8uY29tbWFuZCA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgcGF0Y2hlZC5zdGF0dXNMaW5lLmNvbW1hbmQuaW5jbHVkZXMoXCIubWVhbndoaWxlL3N0YXR1c2xpbmUubWpzXCIpLFxuICAgIHBhdGNoZWQuc3RhdHVzTGluZSxcbiAgKTtcbiAgY2hlY2soXG4gICAgXCJzcGlubmVyVmVyYnMgaW5zdGFsbGVkIChDQyA+PSAyLjEuMTQzKVwiLFxuICAgICFkZXQudmVyYnNTdXBwb3J0ZWQgfHwgKEFycmF5LmlzQXJyYXkocGF0Y2hlZC5zcGlubmVyVmVyYnMpICYmIHBhdGNoZWQuc3Bpbm5lclZlcmJzLmxlbmd0aCA+IDApLFxuICAgIHBhdGNoZWQuc3Bpbm5lclZlcmJzLFxuICApO1xuICBmb3IgKGNvbnN0IGsgb2YgT2JqZWN0LmtleXMob3JpZ2luYWwpKSB7XG4gICAgY2hlY2soXG4gICAgICBgb3JpZ2luYWwga2V5IHByZXNlcnZlZDogJHtrfWAsXG4gICAgICBKU09OLnN0cmluZ2lmeShwYXRjaGVkW2tdKSA9PT0gSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxba10pIHx8XG4gICAgICAgIGsgPT09IFwic3RhdHVzTGluZVwiIHx8XG4gICAgICAgIGsgPT09IFwic3Bpbm5lclZlcmJzXCIsXG4gICAgKTtcbiAgfVxuICBjaGVjayhcImJ5dGUtZXhhY3QgYmFja3VwIGV4aXN0c1wiLCBleGlzdHNTeW5jKGpvaW4oTVcsIFwiYmFja3Vwc1wiLCBcImNsYXVkZS1zZXR0aW5ncy5vcmlnLmpzb25cIikpKTtcblxuICAvLyAzKSBydW4gdGhlIHN0YXR1c2xpbmUgc2NyaXB0IGV4YWN0bHkgYXMgQ2xhdWRlIENvZGUgZG9lc1xuICBjb25zdCBvdXQgPSBleGVjRmlsZVN5bmMoXCJub2RlXCIsIFtqb2luKE1XLCBcInN0YXR1c2xpbmUubWpzXCIpXSwge1xuICAgIGlucHV0OiBKU09OLnN0cmluZ2lmeSh7IGN3ZDogcHJvY2Vzcy5jd2QoKSwgbW9kZWw6IHsgaWQ6IFwidGVzdFwiIH0gfSksXG4gICAgZW5jb2Rpbmc6IFwidXRmOFwiLFxuICAgIHRpbWVvdXQ6IDUwMDAsXG4gIH0pO1xuICBjaGVjayhcInN0YXR1c2xpbmUgcHJpbnRzIGEgbGluZVwiLCBvdXQubGVuZ3RoID4gMCwgb3V0KTtcbiAgY2hlY2soXCJzdGF0dXNsaW5lIGlzIE9TQy04IGxpbmtlZFwiLCBvdXQuaW5jbHVkZXMoXCJcXHUwMDFiXTg7O2h0dHBzOi8vXCIpLCBKU09OLnN0cmluZ2lmeShvdXQuc2xpY2UoMCwgNDApKSk7XG4gIGNvbnN0IHNob3duU3BvbnNvciA9IChwPy5zcG9uc29ycyA/PyBbXSkuc29tZSgocykgPT4gb3V0LmluY2x1ZGVzKHMudGV4dC5zbGljZSgwLCAyMCkpKTtcbiAgY2hlY2soXCJzdGF0dXNsaW5lIHNob3dzIGEgbGl2ZSBzcG9uc29yXCIsIHNob3duU3BvbnNvciwgb3V0KTtcblxuICAvLyByZS1ydW4gaW4gdGhlIHNhbWUgcm90YXRpb24gc2xvdCBcdTIxOTIgbm8gZHVwbGljYXRlIGV2ZW50XG4gIGV4ZWNGaWxlU3luYyhcIm5vZGVcIiwgW2pvaW4oTVcsIFwic3RhdHVzbGluZS5tanNcIildLCB7IGlucHV0OiBcInt9XCIsIGVuY29kaW5nOiBcInV0ZjhcIiwgdGltZW91dDogNTAwMCB9KTtcbiAgY29uc3QgZXZlbnRzUmF3ID0gZXhpc3RzU3luYyhqb2luKE1XLCBcImNsaS1ldmVudHMuanNvbmxcIikpXG4gICAgPyByZWFkRmlsZVN5bmMoam9pbihNVywgXCJjbGktZXZlbnRzLmpzb25sXCIpLCBcInV0ZjhcIikudHJpbSgpXG4gICAgOiBcIlwiO1xuICBjb25zdCBldmVudExpbmVzID0gZXZlbnRzUmF3ID09PSBcIlwiID8gW10gOiBldmVudHNSYXcuc3BsaXQoXCJcXG5cIik7XG4gIGNoZWNrKFwiZXhhY3RseSBvbmUgaW1wcmVzc2lvbiBwZXIgc2xvdFwiLCBldmVudExpbmVzLmxlbmd0aCA9PT0gMSwgZXZlbnRMaW5lcyk7XG5cbiAgLy8gNCkgZHJhaW4gXHUyMTkyIGZsdXNoIHRvIGJhY2tlbmQgKGFub24gXHUyMTkyIGRlbW8gc2luaylcbiAgY29uc3QgZHJhaW5lZCA9IGRyYWluQ2xpRXZlbnRzKG1ldHJpY3MsIGNsaWVudElkKTtcbiAgY2hlY2soXCJkcmFpbmVkIHRoZSBpbXByZXNzaW9uXCIsIGRyYWluZWQgPT09IDEsIGRyYWluZWQpO1xuICBhd2FpdCBtZXRyaWNzLmZsdXNoKCk7XG4gIGNoZWNrKFwiZXZlbnRzIGZpbGUgY29uc3VtZWRcIiwgIWV4aXN0c1N5bmMoam9pbihNVywgXCJjbGktZXZlbnRzLmpzb25sXCIpKSk7XG5cbiAgLy8gNSkgcmVzdG9yZSBhbmQgdmVyaWZ5IHRoZSBvcmlnaW5hbCBjYW1lIGJhY2tcbiAgY29uc3QgciA9IGFkYXB0ZXIucmVzdG9yZSgpO1xuICBjaGVjayhcInJlc3RvcmUgb2tcIiwgci5vaywgcik7XG4gIGNvbnN0IHJlc3RvcmVkID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoU0VUVElOR1MsIFwidXRmOFwiKSk7XG4gIGNoZWNrKFwic2V0dGluZ3MgcGFyc2UtZXF1YWwgdG8gb3JpZ2luYWxcIiwgSlNPTi5zdHJpbmdpZnkocmVzdG9yZWQpID09PSBKU09OLnN0cmluZ2lmeShvcmlnaW5hbCksIHJlc3RvcmVkKTtcbiAgY2hlY2soXCJzdGF0dXNsaW5lIHNjcmlwdCByZW1vdmVkXCIsICFleGlzdHNTeW5jKGpvaW4oTVcsIFwic3RhdHVzbGluZS5tanNcIikpKTtcblxuICAvLyA2KSBjbGF1ZGUgQ0xJIHN0aWxsIGhlYWx0aHlcbiAgbGV0IHZlcnNpb24gPSBcIlwiO1xuICB0cnkge1xuICAgIHZlcnNpb24gPSBleGVjRmlsZVN5bmMoXCJjbGF1ZGVcIiwgW1wiLS12ZXJzaW9uXCJdLCB7IGVuY29kaW5nOiBcInV0ZjhcIiwgdGltZW91dDogMTAwMDAgfSkudHJpbSgpO1xuICB9IGNhdGNoIHtcbiAgICAvKiBQQVRIIG1heSBkaWZmZXI7IG5vbi1mYXRhbCAqL1xuICB9XG4gIGNoZWNrKFwiY2xhdWRlIC0tdmVyc2lvbiBzdGlsbCB3b3Jrc1wiLCB2ZXJzaW9uLmxlbmd0aCA+IDAsIHZlcnNpb24pO1xuXG4gIG1ldHJpY3MuZGlzcG9zZSgpO1xuICBjb25zb2xlLmxvZyhmYWlsdXJlcyA9PT0gMCA/IFwiXFxuQUxMIFBBU1NcIiA6IGBcXG4ke2ZhaWx1cmVzfSBGQUlMVVJFU2ApO1xuICBwcm9jZXNzLmV4aXQoZmFpbHVyZXMgPT09IDAgPyAwIDogMSk7XG59XG5cbm1haW4oKS5jYXRjaCgoZSkgPT4ge1xuICBjb25zb2xlLmVycm9yKFwiY2xpLWxpdmUgY3Jhc2hlZDpcIiwgZSk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuIiwgIi8qKlxuICogTWluaW1hbCBgdnNjb2RlYCBtb2R1bGUgc3R1YiBzbyB0aGUgc2VydmljZSBsYXllciAoYXV0aC9wb3J0Zm9saW8vbWV0cmljcy9cbiAqIGxvb3BiYWNrKSBjYW4gcnVuIGhlYWRsZXNzIGluIHBsYWluIE5vZGUgZm9yIGludGVncmF0aW9uIHRlc3RzLiBPbmx5IHRoZVxuICogQVBJcyB0aG9zZSBtb2R1bGVzIGFjdHVhbGx5IHRvdWNoIGFyZSBpbXBsZW1lbnRlZC5cbiAqL1xuXG5leHBvcnQgY29uc3Qgb3BlbmVkVXJsczogc3RyaW5nW10gPSBbXTtcblxuZXhwb3J0IGNvbnN0IGVudiA9IHtcbiAgYXBwTmFtZTogXCJoYXJuZXNzXCIsXG4gIG9wZW5FeHRlcm5hbDogYXN5bmMgKHVyaTogeyB0b1N0cmluZygpOiBzdHJpbmcgfSkgPT4ge1xuICAgIG9wZW5lZFVybHMucHVzaCh1cmkudG9TdHJpbmcoKSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG59O1xuXG5leHBvcnQgY29uc3QgVXJpID0ge1xuICBwYXJzZTogKHM6IHN0cmluZykgPT4gKHsgdG9TdHJpbmc6ICgpID0+IHMgfSksXG59O1xuXG5leHBvcnQgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgZ2V0RXh0ZW5zaW9uOiAoX2lkOiBzdHJpbmcpID0+ICh7IHBhY2thZ2VKU09OOiB7IHZlcnNpb246IFwiMC4wLjAtdGVzdFwiIH0gfSksXG59O1xuXG4vKiogSW4tbWVtb3J5IFNlY3JldFN0b3JhZ2UgbG9va2FsaWtlLiAqL1xuZXhwb3J0IGNsYXNzIE1lbW9yeVNlY3JldHMge1xuICBwcml2YXRlIG0gPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBhc3luYyBnZXQoazogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gdGhpcy5tLmdldChrKTtcbiAgfVxuICBhc3luYyBzdG9yZShrOiBzdHJpbmcsIHY6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubS5zZXQoaywgdik7XG4gIH1cbiAgYXN5bmMgZGVsZXRlKGs6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubS5kZWxldGUoayk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHdvcmtzcGFjZSA9IHtcbiAgZ2V0Q29uZmlndXJhdGlvbjogKCkgPT4gKHsgZ2V0OiAoX2s6IHN0cmluZykgPT4gdW5kZWZpbmVkIH0pLFxufTtcblxuZXhwb3J0IGNvbnN0IHdpbmRvdyA9IHtcbiAgc2hvd0luZm9ybWF0aW9uTWVzc2FnZTogKC4uLl9hOiB1bmtub3duW10pID0+IHVuZGVmaW5lZCxcbiAgc2hvd1dhcm5pbmdNZXNzYWdlOiAoLi4uX2E6IHVua25vd25bXSkgPT4gdW5kZWZpbmVkLFxufTtcbiIsICJpbXBvcnQgeyBleGVjRmlsZSB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7XG4gIGNobW9kU3luYyxcbiAgY29weUZpbGVTeW5jLFxuICBleGlzdHNTeW5jLFxuICBta2RpclN5bmMsXG4gIHJlYWRGaWxlU3luYyxcbiAgdW5saW5rU3luYyxcbiAgd3JpdGVGaWxlU3luYyxcbn0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHsgU3BvbnNvciB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IG1lYW53aGlsZURpciB9IGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IGRsb2cgfSBmcm9tIFwiLi4vbG9nXCI7XG5pbXBvcnQge1xuICBhcHBseVNwb25zb3JTZXR0aW5ncyxcbiAgcmV2ZXJ0U3BvbnNvclNldHRpbmdzLFxuICB0eXBlIFByZXZWYWx1ZXMsXG59IGZyb20gXCIuL3NldHRpbmdzLWVkaXRcIjtcblxuLyoqXG4gKiBDbGF1ZGUgQ29kZSBDTEkgYWRhcHRlci4gVHdvIHN1Yi1zdXJmYWNlcywgYm90aCBkcml2ZW4gZnJvbVxuICogfi8uY2xhdWRlL3NldHRpbmdzLmpzb246XG4gKlxuICogICBzdGF0dXNsaW5lIFx1MjAxNCBhIGNsaWNrYWJsZSBPU0MtOCBzcG9uc29yIGxpbmUgcmVuZGVyZWQgYnkgb3VyIHNjcmlwdFxuICogICAgICAgICAgICAgICAgKGV2ZXJ5IENsYXVkZSBDb2RlIHZlcnNpb24gdGhhdCBzdXBwb3J0cyBzdGF0dXNMaW5lKVxuICogICBzcGlubmVyICAgIFx1MjAxNCB0aGUgdGhpbmtpbmctdmVyYiBvdmVycmlkZSAoQ2xhdWRlIENvZGUgPj0gMi4xLjE0MylcbiAqXG4gKiBQYXRjaGluZyBvbmx5IHVwc2VydHMgdGhlIHR3byBrZXlzOyByZXN0b3JlIHB1dHMgYmFjayBleGFjdGx5IHdoYXQgd2FzXG4gKiB0aGVyZSBiZWZvcmUuIEEgYnl0ZS1leGFjdCBiYWNrdXAgb2YgdGhlIGZpcnN0LXNlZW4gc2V0dGluZ3MuanNvbiBpcyBrZXB0XG4gKiBhcyBhIGJlbHQtYW5kLXN1c3BlbmRlcnMgZXNjYXBlIGhhdGNoLlxuICovXG5cbmNvbnN0IFNUQVRFX0ZJTEUgPSBcImNsYXVkZS1jbGktc3RhdGUuanNvblwiO1xuY29uc3QgU0NSSVBUX05BTUUgPSBcInN0YXR1c2xpbmUubWpzXCI7XG5jb25zdCBNSU5fVkVSQlNfVkVSU0lPTjogW251bWJlciwgbnVtYmVyLCBudW1iZXJdID0gWzIsIDEsIDE0M107XG5cbmludGVyZmFjZSBQYXRjaFN0YXRlIHtcbiAgcHJldjogUHJldlZhbHVlcztcbiAgdmVyYnNBcHBsaWVkOiBib29sZWFuO1xuICBhcHBsaWVkQXRNczogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENsYXVkZUNsaURldGVjdGlvbiB7XG4gIHNldHRpbmdzUGF0aDogc3RyaW5nO1xuICBzZXR0aW5nc0RpckV4aXN0czogYm9vbGVhbjtcbiAgdmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgdmVyYnNTdXBwb3J0ZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHNldHRpbmdzUGF0aCgpOiBzdHJpbmcge1xuICByZXR1cm4gam9pbihob21lZGlyKCksIFwiLmNsYXVkZVwiLCBcInNldHRpbmdzLmpzb25cIik7XG59XG5cbmZ1bmN0aW9uIHN0YXRlUGF0aCgpOiBzdHJpbmcge1xuICByZXR1cm4gam9pbihtZWFud2hpbGVEaXIoKSwgU1RBVEVfRklMRSk7XG59XG5cbmZ1bmN0aW9uIHNjcmlwdFBhdGgoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGpvaW4obWVhbndoaWxlRGlyKCksIFNDUklQVF9OQU1FKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VWZXJzaW9uKHM6IHN0cmluZyk6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSB8IG51bGwge1xuICBjb25zdCBtID0gcy5tYXRjaCgvKFxcZCspXFwuKFxcZCspXFwuKFxcZCspLyk7XG4gIHJldHVybiBtID8gW051bWJlcihtWzFdKSwgTnVtYmVyKG1bMl0pLCBOdW1iZXIobVszXSldIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZ3RlKGE6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSwgYjogW251bWJlciwgbnVtYmVyLCBudW1iZXJdKTogYm9vbGVhbiB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgaWYgKGFbaV0gPiBiW2ldKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoYVtpXSA8IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuY29uc3QgQ0xBVURFX0NBTkRJREFURVMgPSBbXG4gIFwiY2xhdWRlXCIsXG4gIGpvaW4oaG9tZWRpcigpLCBcIi5sb2NhbFwiLCBcImJpblwiLCBcImNsYXVkZVwiKSxcbiAgXCIvb3B0L2hvbWVicmV3L2Jpbi9jbGF1ZGVcIixcbiAgXCIvdXNyL2xvY2FsL2Jpbi9jbGF1ZGVcIixcbl07XG5cbmZ1bmN0aW9uIGNsYXVkZVZlcnNpb24oKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGNvbnN0IHRyeU9uZSA9IChiaW46IHN0cmluZykgPT5cbiAgICBuZXcgUHJvbWlzZTxzdHJpbmcgfCBudWxsPigocmVzb2x2ZSkgPT4ge1xuICAgICAgZXhlY0ZpbGUoYmluLCBbXCItLXZlcnNpb25cIl0sIHsgdGltZW91dDogODAwMCB9LCAoZXJyLCBzdGRvdXQpID0+IHtcbiAgICAgICAgcmVzb2x2ZShlcnIgPyBudWxsIDogU3RyaW5nKHN0ZG91dCkudHJpbSgpIHx8IG51bGwpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIHJldHVybiAoYXN5bmMgKCkgPT4ge1xuICAgIGZvciAoY29uc3QgYmluIG9mIENMQVVERV9DQU5ESURBVEVTKSB7XG4gICAgICBjb25zdCB2ID0gYXdhaXQgdHJ5T25lKGJpbik7XG4gICAgICBpZiAodikgcmV0dXJuIHY7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9KSgpO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhdWRlQ2xpQWRhcHRlciB7XG4gIHJlYWRvbmx5IGlkID0gXCJjbGF1ZGVfY2xpXCI7XG4gIHByaXZhdGUgdmVyc2lvbkNhY2hlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkO1xuXG4gIGFzeW5jIGRldGVjdCgpOiBQcm9taXNlPENsYXVkZUNsaURldGVjdGlvbj4ge1xuICAgIGlmICh0aGlzLnZlcnNpb25DYWNoZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZlcnNpb25DYWNoZSA9IGF3YWl0IGNsYXVkZVZlcnNpb24oKTtcbiAgICB9XG4gICAgY29uc3QgdiA9IHRoaXMudmVyc2lvbkNhY2hlID8gcGFyc2VWZXJzaW9uKHRoaXMudmVyc2lvbkNhY2hlKSA6IG51bGw7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNldHRpbmdzUGF0aDogc2V0dGluZ3NQYXRoKCksXG4gICAgICBzZXR0aW5nc0RpckV4aXN0czogZXhpc3RzU3luYyhqb2luKGhvbWVkaXIoKSwgXCIuY2xhdWRlXCIpKSxcbiAgICAgIHZlcnNpb246IHRoaXMudmVyc2lvbkNhY2hlID8/IG51bGwsXG4gICAgICB2ZXJic1N1cHBvcnRlZDogdiAhPT0gbnVsbCAmJiBndGUodiwgTUlOX1ZFUkJTX1ZFUlNJT04pLFxuICAgIH07XG4gIH1cblxuICBpc1BhdGNoZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGV4aXN0c1N5bmMoc3RhdGVQYXRoKCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkU3RhdGUoKTogUGF0Y2hTdGF0ZSB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoc3RhdGVQYXRoKCksIFwidXRmOFwiKSkgYXMgUGF0Y2hTdGF0ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBJbnN0YWxsL3JlZnJlc2ggdGhlIHN0YXR1c2xpbmUgc2NyaXB0IGFzc2V0IChpZGVtcG90ZW50KS4gKi9cbiAgcHJpdmF0ZSBpbnN0YWxsU2NyaXB0KGV4dGVuc2lvbkRpc3REaXI6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGFzc2V0ID0gam9pbihleHRlbnNpb25EaXN0RGlyLCBcImFkYXB0ZXJzXCIsIFwic3RhdHVzbGluZS5hc3NldC5tanNcIik7XG4gICAgY29weUZpbGVTeW5jKGFzc2V0LCBzY3JpcHRQYXRoKCkpO1xuICAgIGNobW9kU3luYyhzY3JpcHRQYXRoKCksIDBvNzU1KTtcbiAgfVxuXG4gIC8qKiBTcGlubmVyIHZlcmJzIGRlcml2ZWQgZnJvbSB0aGUgc3BvbnNvciBxdWV1ZSAodGV4dCBvbmx5IFx1MjAxNCB0aGUgc3Bpbm5lclxuICAgKiAgaXMgbm90IGNsaWNrYWJsZSkuIENsYXVkZSBDb2RlIGFwcGVuZHMgaXRzIG93biBlbGxpcHNpcy90aW1lci4gKi9cbiAgcHJpdmF0ZSB2ZXJic0Zyb20oc3BvbnNvcnM6IFNwb25zb3JbXSk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCB2ZXJicyA9IHNwb25zb3JzXG4gICAgICAubWFwKChzKSA9PiAocy5icmFuZCA/IGAke3MudGV4dH0gXHUyMDE0ICR7cy5icmFuZH1gIDogcy50ZXh0KSlcbiAgICAgIC5tYXAoKHQpID0+IHQuc2xpY2UoMCwgNjApKTtcbiAgICByZXR1cm4gdmVyYnMubGVuZ3RoID4gMCA/IHZlcmJzIDogW107XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgKG9yIHJlLWFwcGx5KSB0aGUgcGF0Y2guIFNhZmUgdG8gY2FsbCBvbiBldmVyeSBwb3J0Zm9saW8gcmVmcmVzaDpcbiAgICogaXQgcmV3cml0ZXMgc2V0dGluZ3MuanNvbiBvbmx5IHdoZW4gdGhlIGRlc2lyZWQgc3RhdGUgYWN0dWFsbHkgZGlmZmVycy5cbiAgICovXG4gIGFzeW5jIHBhdGNoKG9wdHM6IHtcbiAgICBleHRlbnNpb25EaXN0RGlyOiBzdHJpbmc7XG4gICAgc3BvbnNvcnM6IFNwb25zb3JbXTtcbiAgfSk6IFByb21pc2U8eyBvazogYm9vbGVhbjsgY29uZmxpY3RzOiBzdHJpbmdbXSB9PiB7XG4gICAgY29uc3QgZGV0ID0gYXdhaXQgdGhpcy5kZXRlY3QoKTtcbiAgICBpZiAoIWRldC5zZXR0aW5nc0RpckV4aXN0cykge1xuICAgICAgZGxvZyhcImNjLWNsaVwiLCBcIm5vIH4vLmNsYXVkZSBcdTIwMTQgc2tpcHBpbmdcIik7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGNvbmZsaWN0czogW1wibm9fY2xhdWRlX2RpclwiXSB9O1xuICAgIH1cblxuICAgIG1rZGlyU3luYyhtZWFud2hpbGVEaXIoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgdGhpcy5pbnN0YWxsU2NyaXB0KG9wdHMuZXh0ZW5zaW9uRGlzdERpcik7XG5cbiAgICBjb25zdCBzcCA9IHNldHRpbmdzUGF0aCgpO1xuICAgIGNvbnN0IHNyYyA9IGV4aXN0c1N5bmMoc3ApID8gcmVhZEZpbGVTeW5jKHNwLCBcInV0ZjhcIikgOiBcInt9XCI7XG5cbiAgICAvLyBGaXJzdC1ldmVyIHBhdGNoOiBrZWVwIGEgYnl0ZS1leGFjdCBjb3B5IG9mIHRoZSBvcmlnaW5hbC5cbiAgICBjb25zdCBiYWNrdXBEaXIgPSBqb2luKG1lYW53aGlsZURpcigpLCBcImJhY2t1cHNcIik7XG4gICAgbWtkaXJTeW5jKGJhY2t1cERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgY29uc3Qgb3JpZ0JhY2t1cCA9IGpvaW4oYmFja3VwRGlyLCBcImNsYXVkZS1zZXR0aW5ncy5vcmlnLmpzb25cIik7XG4gICAgaWYgKCFleGlzdHNTeW5jKG9yaWdCYWNrdXApKSB3cml0ZUZpbGVTeW5jKG9yaWdCYWNrdXAsIHNyYyk7XG4gICAgd3JpdGVGaWxlU3luYyhqb2luKGJhY2t1cERpciwgXCJjbGF1ZGUtc2V0dGluZ3MubGFzdC5qc29uXCIpLCBzcmMpO1xuXG4gICAgY29uc3QgcHJpb3IgPSB0aGlzLmxvYWRTdGF0ZSgpO1xuICAgIGNvbnN0IHZlcmJzID0gZGV0LnZlcmJzU3VwcG9ydGVkID8gdGhpcy52ZXJic0Zyb20ob3B0cy5zcG9uc29ycykgOiBudWxsO1xuXG4gICAgbGV0IHJlc3VsdDtcbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gYXBwbHlTcG9uc29yU2V0dGluZ3Moc3JjLCB7XG4gICAgICAgIHN0YXR1c2xpbmVDb21tYW5kOiBgbm9kZSBcIiR7c2NyaXB0UGF0aCgpfVwiYCxcbiAgICAgICAgdmVyYnM6IHZlcmJzICYmIHZlcmJzLmxlbmd0aCA+IDAgPyB2ZXJicyA6IG51bGwsXG4gICAgICAgIC8vIElmIHdlIHBhdGNoZWQgYmVmb3JlLCB0aGUgY3VycmVudCBzcGlubmVyVmVyYnMgdmFsdWUgaXMgb3VycyBhbmRcbiAgICAgICAgLy8gbWF5IGJlIHJld3JpdHRlbiBmcmVlbHk7IG90aGVyd2lzZSBhbiBleGlzdGluZyB2YWx1ZSBpcyB0aGUgdXNlcidzLlxuICAgICAgICBvdmVyd3JpdGVGb3JlaWduVmVyYnM6IHByaW9yPy52ZXJic0FwcGxpZWQgPT09IHRydWUsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwiY2MtY2xpXCIsIFwic2V0dGluZ3MgcGFyc2UgZmFpbGVkOyByZWZ1c2luZyB0byB0b3VjaFwiLCB7XG4gICAgICAgIGU6IFN0cmluZyhlKSxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBjb25mbGljdHM6IFtcInNldHRpbmdzX3VucGFyc2VhYmxlXCJdIH07XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdC5jaGFuZ2VkKSB3cml0ZUZpbGVTeW5jKHNwLCByZXN1bHQubmV4dCk7XG5cbiAgICAvLyBQcmVzZXJ2ZSB0aGUgT1JJR0lOQUwgcHJldiBhY3Jvc3MgcmUtcGF0Y2hlcyBzbyByZXN0b3JlIGFsd2F5cyByZXZlcnRzXG4gICAgLy8gdG8gdGhlIHRydWUgcHJlLU1lYW53aGlsZSBzdGF0ZS5cbiAgICBjb25zdCBzdGF0ZTogUGF0Y2hTdGF0ZSA9IHtcbiAgICAgIHByZXY6IHByaW9yPy5wcmV2ID8/IHJlc3VsdC5wcmV2LFxuICAgICAgdmVyYnNBcHBsaWVkOlxuICAgICAgICBwcmlvcj8udmVyYnNBcHBsaWVkID09PSB0cnVlIHx8XG4gICAgICAgICh2ZXJicyAhPT0gbnVsbCAmJlxuICAgICAgICAgIHZlcmJzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICAhcmVzdWx0LmNvbmZsaWN0cy5pbmNsdWRlcyhcInNwaW5uZXJ2ZXJic19mb3JlaWduXCIpKSxcbiAgICAgIGFwcGxpZWRBdE1zOiBEYXRlLm5vdygpLFxuICAgIH07XG4gICAgd3JpdGVGaWxlU3luYyhzdGF0ZVBhdGgoKSwgSlNPTi5zdHJpbmdpZnkoc3RhdGUsIG51bGwsIDIpICsgXCJcXG5cIik7XG5cbiAgICBkbG9nKFwiY2MtY2xpXCIsIFwicGF0Y2hlZFwiLCB7XG4gICAgICBjaGFuZ2VkOiByZXN1bHQuY2hhbmdlZCxcbiAgICAgIGNvbmZsaWN0czogcmVzdWx0LmNvbmZsaWN0cyxcbiAgICAgIHZlcmJzOiB2ZXJicz8ubGVuZ3RoID8/IDAsXG4gICAgfSk7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIGNvbmZsaWN0czogcmVzdWx0LmNvbmZsaWN0cyB9O1xuICB9XG5cbiAgLyoqIFJldmVydCBvdXIga2V5cyB0byB0aGVpciBwcmUtcGF0Y2ggdmFsdWVzIGFuZCBkcm9wIHRoZSBzdGF0ZSBmaWxlLiAqL1xuICByZXN0b3JlKCk6IHsgb2s6IGJvb2xlYW47IGRldGFpbD86IHN0cmluZyB9IHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMubG9hZFN0YXRlKCk7XG4gICAgY29uc3Qgc3AgPSBzZXR0aW5nc1BhdGgoKTtcbiAgICBpZiAoIXN0YXRlKSB7XG4gICAgICByZXR1cm4geyBvazogdHJ1ZSwgZGV0YWlsOiBcIm5vdGhpbmcgdG8gcmVzdG9yZVwiIH07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzcmMgPSBleGlzdHNTeW5jKHNwKSA/IHJlYWRGaWxlU3luYyhzcCwgXCJ1dGY4XCIpIDogXCJ7fVwiO1xuICAgICAgY29uc3QgbmV4dCA9IHJldmVydFNwb25zb3JTZXR0aW5ncyhzcmMsIHN0YXRlLnByZXYpO1xuICAgICAgd3JpdGVGaWxlU3luYyhzcCwgbmV4dCk7XG4gICAgICB1bmxpbmtTeW5jKHN0YXRlUGF0aCgpKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHVubGlua1N5bmMoc2NyaXB0UGF0aCgpKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBzY3JpcHQgbWF5IGFscmVhZHkgYmUgZ29uZSAqL1xuICAgICAgfVxuICAgICAgZGxvZyhcImNjLWNsaVwiLCBcInJlc3RvcmVkXCIpO1xuICAgICAgcmV0dXJuIHsgb2s6IHRydWUgfTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwiY2MtY2xpXCIsIFwicmVzdG9yZSBmYWlsZWRcIiwgeyBlOiBTdHJpbmcoZSkgfSk7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGRldGFpbDogU3RyaW5nKGUpIH07XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0ICogYXMgdnNjb2RlIGZyb20gXCJ2c2NvZGVcIjtcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IGV4aXN0c1N5bmMsIG1rZGlyU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcblxuLyoqXG4gKiBFZmZlY3RpdmUgZXh0ZW5zaW9uIGNvbmZpZ3VyYXRpb24sIHJlc29sdmVkIGZyb20gKGhpZ2hlc3QgcHJlY2VkZW5jZSBmaXJzdCk6XG4gKiAgIDEuIFZTIENvZGUgc2V0dGluZ3MgKGBtZWFud2hpbGUuKmApXG4gKiAgIDIuIH4vLm1lYW53aGlsZS9jb25maWcuanNvbiAgKHBvd2VyLXVzZXIgLyBoZWFkbGVzcyBvdmVycmlkZSlcbiAqICAgMy4gZW52aXJvbm1lbnQgKE1FQU5XSElMRV9CQVNFLCBNRUFOV0hJTEVfREVCVUcpXG4gKiAgIDQuIGNvbXBpbGVkLWluIGRlZmF1bHRzXG4gKlxuICogUmVhZHMgYXJlIGJlc3QtZWZmb3J0OiBhIG1pc3NpbmcvYnJva2VuIGZpbGUgb3Igc2V0dGluZyBmYWxscyB0aHJvdWdoIHRvIHRoZVxuICogbmV4dCBzb3VyY2Ugc28gYWN0aXZhdGlvbiBjYW4gbmV2ZXIgYmUgYnJva2VuIGJ5IGNvbmZpZy5cbiAqL1xuXG5jb25zdCBERUZBVUxUX0JBQ0tFTkRfQkFTRSA9IFwiaHR0cDovLzEyNy4wLjAuMTozMDAwXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVhbndoaWxlQ29uZmlnIHtcbiAgYmFja2VuZEJhc2VVcmw6IHN0cmluZztcbiAgZGVidWc6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZWFud2hpbGVEaXIoKTogc3RyaW5nIHtcbiAgY29uc3QgZGlyID0gam9pbihob21lZGlyKCksIFwiLm1lYW53aGlsZVwiKTtcbiAgdHJ5IHtcbiAgICBpZiAoIWV4aXN0c1N5bmMoZGlyKSkgbWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8qIGJlc3QtZWZmb3J0ICovXG4gIH1cbiAgcmV0dXJuIGRpcjtcbn1cblxuaW50ZXJmYWNlIEZpbGVDb25maWcge1xuICBiYWNrZW5kQmFzZVVybD86IHN0cmluZztcbiAgZGVidWc/OiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiByZWFkRmlsZUNvbmZpZygpOiBGaWxlQ29uZmlnIHtcbiAgdHJ5IHtcbiAgICBjb25zdCByYXcgPSByZWFkRmlsZVN5bmMoam9pbihtZWFud2hpbGVEaXIoKSwgXCJjb25maWcuanNvblwiKSwgXCJ1dGY4XCIpO1xuICAgIGNvbnN0IGogPSBKU09OLnBhcnNlKHJhdykgYXMgRmlsZUNvbmZpZztcbiAgICByZXR1cm4gaiAmJiB0eXBlb2YgaiA9PT0gXCJvYmplY3RcIiA/IGogOiB7fTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyaW1TbGFzaGVzKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkQ29uZmlnKCk6IE1lYW53aGlsZUNvbmZpZyB7XG4gIGNvbnN0IHNldHRpbmdzID0gdnNjb2RlLndvcmtzcGFjZS5nZXRDb25maWd1cmF0aW9uKFwibWVhbndoaWxlXCIpO1xuICBjb25zdCBmaWxlID0gcmVhZEZpbGVDb25maWcoKTtcblxuICBjb25zdCBzZXR0aW5nQmFzZSA9IChzZXR0aW5ncy5nZXQ8c3RyaW5nPihcImJhY2tlbmRCYXNlVXJsXCIpIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgZmlsZUJhc2UgPSAoZmlsZS5iYWNrZW5kQmFzZVVybCB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IGVudkJhc2UgPSAocHJvY2Vzcy5lbnYuTUVBTldISUxFX0JBU0UgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCBiYWNrZW5kQmFzZVVybCA9IHRyaW1TbGFzaGVzKFxuICAgIHNldHRpbmdCYXNlIHx8IGZpbGVCYXNlIHx8IGVudkJhc2UgfHwgREVGQVVMVF9CQUNLRU5EX0JBU0UsXG4gICk7XG5cbiAgY29uc3QgZGVidWcgPVxuICAgIHNldHRpbmdzLmdldDxib29sZWFuPihcImRlYnVnXCIpID09PSB0cnVlIHx8XG4gICAgZmlsZS5kZWJ1ZyA9PT0gdHJ1ZSB8fFxuICAgIHByb2Nlc3MuZW52Lk1FQU5XSElMRV9ERUJVRyA9PT0gXCIxXCI7XG5cbiAgcmV0dXJuIHsgYmFja2VuZEJhc2VVcmwsIGRlYnVnIH07XG59XG4iLCAiaW1wb3J0IHsgYXBwZW5kRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IG1lYW53aGlsZURpciB9IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG4vKipcbiAqIEJlc3QtZWZmb3J0IGRlYnVnIGxvZ2dpbmcuIE9mZiB1bmxlc3MgYGRlYnVnYCBpcyBlbmFibGVkIGluIGNvbmZpZzsgZXZlblxuICogdGhlbiwgYSB3cml0ZSBmYWlsdXJlIG11c3QgbmV2ZXIgc3VyZmFjZSB0byB0aGUgdXNlciBcdTIwMTQgbG9nZ2luZyBpcyBhXG4gKiBkaWFnbm9zdGljIGFpZCwgbm90IGEgZmVhdHVyZSBwYXRoLlxuICovXG5cbmxldCBkZWJ1Z0VuYWJsZWQgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNldERlYnVnKG9uOiBib29sZWFuKTogdm9pZCB7XG4gIGRlYnVnRW5hYmxlZCA9IG9uO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGxvZyhzY29wZTogc3RyaW5nLCBldmVudDogc3RyaW5nLCBkYXRhPzogdW5rbm93bik6IHZvaWQge1xuICBpZiAoIWRlYnVnRW5hYmxlZCkgcmV0dXJuO1xuICB0cnkge1xuICAgIGNvbnN0IGxpbmUgPVxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICB0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNjb3BlLFxuICAgICAgICBldmVudCxcbiAgICAgICAgLi4uKGRhdGEgIT09IHVuZGVmaW5lZCA/IHsgZGF0YSB9IDoge30pLFxuICAgICAgfSkgKyBcIlxcblwiO1xuICAgIGFwcGVuZEZpbGVTeW5jKGpvaW4obWVhbndoaWxlRGlyKCksIFwiZGVidWcubG9nXCIpLCBsaW5lLCBcInV0ZjhcIik7XG4gIH0gY2F0Y2gge1xuICAgIC8qIG5ldmVyIGJyZWFrIG9uIGxvZ2dpbmcgKi9cbiAgfVxufVxuIiwgIi8qKlxuICogUHVyZSBlZGl0IGxvZ2ljIGZvciB+Ly5jbGF1ZGUvc2V0dGluZ3MuanNvbi4gTm8gZmlsZXN5c3RlbSBhY2Nlc3MgaGVyZSBcdTIwMTRcbiAqIHRoZSBhZGFwdGVyIG93bnMgSU8sIGJhY2t1cHMsIGFuZCBwb2xpY3k7IHRoZXNlIGZ1bmN0aW9ucyBvd24gY29ycmVjdG5lc3NcbiAqIG9mIHRoZSBKU09OIHRyYW5zZm9ybXMgYW5kIGFyZSB1bml0LXRlc3RlZCBpbiBpc29sYXRpb24uXG4gKlxuICogQ2xhdWRlIENvZGUgcmVhZHMgdHdvIGtleXMgd2UgY2FyZSBhYm91dDpcbiAqICAgLSBzdGF0dXNMaW5lOiAgIHsgdHlwZTogXCJjb21tYW5kXCIsIGNvbW1hbmQ6IHN0cmluZywgcGFkZGluZz86IG51bWJlciB9XG4gKiAgIC0gc3Bpbm5lclZlcmJzOiBzdHJpbmdbXSAgICh0aGlua2luZy12ZXJiIG92ZXJyaWRlLCBDQyA+PSAyLjEuMTQzKVxuICovXG5cbi8qKiBNYXJrZXIgdGhhdCBpZGVudGlmaWVzIGEgc3RhdHVzTGluZSBjb21tYW5kIGFzIG91cnMuICovXG5leHBvcnQgY29uc3QgU1RBVFVTTElORV9NQVJLRVIgPSBcIi5tZWFud2hpbGUvc3RhdHVzbGluZS5tanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2VmFsdWVzIHtcbiAgaGFkU3RhdHVzTGluZTogYm9vbGVhbjtcbiAgc3RhdHVzTGluZT86IHVua25vd247XG4gIGhhZFNwaW5uZXJWZXJiczogYm9vbGVhbjtcbiAgc3Bpbm5lclZlcmJzPzogdW5rbm93bjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHBseU9wdGlvbnMge1xuICAvKiogQWJzb2x1dGUgY29tbWFuZCB0byBydW4gZm9yIHRoZSBzdGF0dXMgbGluZS4gKi9cbiAgc3RhdHVzbGluZUNvbW1hbmQ6IHN0cmluZztcbiAgLyoqIFNwaW5uZXIgdmVyYnMgdG8gaW5zdGFsbCwgb3IgbnVsbCB0byBsZWF2ZSB0aGUga2V5IHVudG91Y2hlZC4gKi9cbiAgdmVyYnM6IHN0cmluZ1tdIHwgbnVsbDtcbiAgLyoqIE92ZXJ3cml0ZSBhIHByZS1leGlzdGluZyBmb3JlaWduIHNwaW5uZXJWZXJicyB2YWx1ZS4gVGhlIGFkYXB0ZXIgcGFzc2VzXG4gICAqICB0cnVlIG9ubHkgd2hlbiBpdHMgcGF0Y2gtc3RhdGUgcHJvdmVzIHRoZSBjdXJyZW50IHZhbHVlIGlzIG91cnMuICovXG4gIG92ZXJ3cml0ZUZvcmVpZ25WZXJiczogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHBseVJlc3VsdCB7XG4gIG5leHQ6IHN0cmluZztcbiAgcHJldjogUHJldlZhbHVlcztcbiAgY2hhbmdlZDogYm9vbGVhbjtcbiAgY29uZmxpY3RzOiAoXCJzdGF0dXNsaW5lX2ZvcmVpZ25cIiB8IFwic3Bpbm5lcnZlcmJzX2ZvcmVpZ25cIilbXTtcbn1cblxudHlwZSBTZXR0aW5nc09iamVjdCA9IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuXG5mdW5jdGlvbiBwYXJzZShzcmM6IHN0cmluZyk6IFNldHRpbmdzT2JqZWN0IHtcbiAgY29uc3QgdHJpbW1lZCA9IHNyYy50cmltKCk7XG4gIGlmICh0cmltbWVkID09PSBcIlwiKSByZXR1cm4ge307XG4gIGNvbnN0IGogPSBKU09OLnBhcnNlKHRyaW1tZWQpIGFzIHVua25vd247XG4gIGlmIChqID09PSBudWxsIHx8IHR5cGVvZiBqICE9PSBcIm9iamVjdFwiIHx8IEFycmF5LmlzQXJyYXkoaikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJzZXR0aW5ncy5qc29uIGlzIG5vdCBhbiBvYmplY3RcIik7XG4gIH1cbiAgcmV0dXJuIGogYXMgU2V0dGluZ3NPYmplY3Q7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeShvYmo6IFNldHRpbmdzT2JqZWN0KTogc3RyaW5nIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgMikgKyBcIlxcblwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNPdXJTdGF0dXNMaW5lKHY6IHVua25vd24pOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJlxuICAgIHYgIT09IG51bGwgJiZcbiAgICB0eXBlb2YgKHYgYXMgeyBjb21tYW5kPzogdW5rbm93biB9KS5jb21tYW5kID09PSBcInN0cmluZ1wiICYmXG4gICAgKCh2IGFzIHsgY29tbWFuZDogc3RyaW5nIH0pLmNvbW1hbmQpLmluY2x1ZGVzKFNUQVRVU0xJTkVfTUFSS0VSKVxuICApO1xufVxuXG4vKipcbiAqIFVwc2VydCBvdXIgc3RhdHVzTGluZSArIHNwaW5uZXJWZXJicy4gTmV2ZXIgdG91Y2hlcyBhbnkgb3RoZXIga2V5LCBuZXZlclxuICogcmVvcmRlcnMgd2hhdCBKU09OLnN0cmluZ2lmeSB3b3VsZCBub3QsIGFuZCByZWZ1c2VzIHRvIGNsb2JiZXIgY29uZmlnIHRoZVxuICogdXNlciB3cm90ZSB0aGVtc2VsdmVzIChyZXBvcnRlZCB2aWEgYGNvbmZsaWN0c2ApLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlTcG9uc29yU2V0dGluZ3MoXG4gIHNyYzogc3RyaW5nLFxuICBvcHRzOiBBcHBseU9wdGlvbnMsXG4pOiBBcHBseVJlc3VsdCB7XG4gIGNvbnN0IG9iaiA9IHBhcnNlKHNyYyk7XG4gIGNvbnN0IGNvbmZsaWN0czogQXBwbHlSZXN1bHRbXCJjb25mbGljdHNcIl0gPSBbXTtcblxuICBjb25zdCBwcmV2OiBQcmV2VmFsdWVzID0ge1xuICAgIGhhZFN0YXR1c0xpbmU6IFwic3RhdHVzTGluZVwiIGluIG9iaixcbiAgICBzdGF0dXNMaW5lOiBvYmouc3RhdHVzTGluZSxcbiAgICBoYWRTcGlubmVyVmVyYnM6IFwic3Bpbm5lclZlcmJzXCIgaW4gb2JqLFxuICAgIHNwaW5uZXJWZXJiczogb2JqLnNwaW5uZXJWZXJicyxcbiAgfTtcblxuICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXG4gIC8vIHN0YXR1c0xpbmU6IG91cnMgaXMgaWRlbnRpZmllZCBieSB0aGUgbWFya2VyOyBhIGZvcmVpZ24gb25lIGlzIHRoZVxuICAvLyB1c2VyJ3Mgb3duIGNvbmZpZyBhbmQgc3RheXMuXG4gIGNvbnN0IGV4aXN0aW5nID0gb2JqLnN0YXR1c0xpbmU7XG4gIGlmIChleGlzdGluZyAhPT0gdW5kZWZpbmVkICYmICFpc091clN0YXR1c0xpbmUoZXhpc3RpbmcpKSB7XG4gICAgY29uZmxpY3RzLnB1c2goXCJzdGF0dXNsaW5lX2ZvcmVpZ25cIik7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgd2FudCA9IHtcbiAgICAgIHR5cGU6IFwiY29tbWFuZFwiLFxuICAgICAgY29tbWFuZDogb3B0cy5zdGF0dXNsaW5lQ29tbWFuZCxcbiAgICAgIHBhZGRpbmc6IDAsXG4gICAgfTtcbiAgICBpZiAoSlNPTi5zdHJpbmdpZnkoZXhpc3RpbmcpICE9PSBKU09OLnN0cmluZ2lmeSh3YW50KSkge1xuICAgICAgb2JqLnN0YXR1c0xpbmUgPSB3YW50O1xuICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgLy8gc3Bpbm5lclZlcmJzOiBhIHBsYWluIHN0cmluZ1tdIGNhcnJpZXMgbm8gb3duZXJzaGlwIG1hcmtlciwgc28gdGhlXG4gIC8vIGFkYXB0ZXIncyBwYXRjaC1zdGF0ZSBkZWNpZGVzIHdoZXRoZXIgYW4gZXhpc3RpbmcgdmFsdWUgaXMgb3Vycy5cbiAgaWYgKG9wdHMudmVyYnMgIT09IG51bGwpIHtcbiAgICBjb25zdCBoYXNGb3JlaWduID0gcHJldi5oYWRTcGlubmVyVmVyYnMgJiYgIW9wdHMub3ZlcndyaXRlRm9yZWlnblZlcmJzO1xuICAgIGlmIChoYXNGb3JlaWduKSB7XG4gICAgICBjb25mbGljdHMucHVzaChcInNwaW5uZXJ2ZXJic19mb3JlaWduXCIpO1xuICAgIH0gZWxzZSBpZiAoSlNPTi5zdHJpbmdpZnkob2JqLnNwaW5uZXJWZXJicykgIT09IEpTT04uc3RyaW5naWZ5KG9wdHMudmVyYnMpKSB7XG4gICAgICBvYmouc3Bpbm5lclZlcmJzID0gb3B0cy52ZXJicztcbiAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IG5leHQ6IHN0cmluZ2lmeShvYmopLCBwcmV2LCBjaGFuZ2VkLCBjb25mbGljdHMgfTtcbn1cblxuLyoqXG4gKiBSZXZlcnQgZXhhY3RseSB0aGUga2V5cyB3ZSBtYW5hZ2UgdG8gdGhlaXIgcHJlLXBhdGNoIHZhbHVlcy4gT3RoZXIga2V5cyBcdTIwMTRcbiAqIGluY2x1ZGluZyBvbmVzIENsYXVkZSBDb2RlIGl0c2VsZiByZXdyb3RlIHNpbmNlIHdlIHBhdGNoZWQgXHUyMDE0IGFyZSBwcmVzZXJ2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXZlcnRTcG9uc29yU2V0dGluZ3Moc3JjOiBzdHJpbmcsIHByZXY6IFByZXZWYWx1ZXMpOiBzdHJpbmcge1xuICBjb25zdCBvYmogPSBwYXJzZShzcmMpO1xuXG4gIGlmIChpc091clN0YXR1c0xpbmUob2JqLnN0YXR1c0xpbmUpKSB7XG4gICAgaWYgKHByZXYuaGFkU3RhdHVzTGluZSAmJiAhaXNPdXJTdGF0dXNMaW5lKHByZXYuc3RhdHVzTGluZSkpIHtcbiAgICAgIG9iai5zdGF0dXNMaW5lID0gcHJldi5zdGF0dXNMaW5lO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgb2JqLnN0YXR1c0xpbmU7XG4gICAgfVxuICB9XG5cbiAgaWYgKHByZXYuaGFkU3Bpbm5lclZlcmJzKSBvYmouc3Bpbm5lclZlcmJzID0gcHJldi5zcGlubmVyVmVyYnM7XG4gIGVsc2UgZGVsZXRlIG9iai5zcGlubmVyVmVyYnM7XG5cbiAgcmV0dXJuIHN0cmluZ2lmeShvYmopO1xufVxuIiwgIi8qKlxuICogTWVhbndoaWxlIFx1MjAxNCBzaGFyZWQgQVBJIGNvbnRyYWN0LlxuICpcbiAqIFRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciB0aGUgd2lyZSBzaGFwZXMgZXhjaGFuZ2VkIGJldHdlZW4gdGhlIHdlYlxuICogYmFja2VuZCAoYHdlYi9gKSBhbmQgdGhlIGVkaXRvciBleHRlbnNpb24gKGBleHRlbnNpb24vYCkuIEJvdGggaW1wb3J0IHRoaXNcbiAqIGZpbGUgZGlyZWN0bHkgc28gYSBjb250cmFjdCBjaGFuZ2UgY2FuIG5ldmVyIGRyaWZ0IGJldHdlZW4gdGhlIHR3byBoYWx2ZXMuXG4gKlxuICogRGVzaWduIHJ1bGUgKG1vZHVsYXIgYXV0aCk6IHRoZSBleHRlbnNpb24gTkVWRVIgdGFsa3MgdG8gdGhlIHdlYiBhdXRoXG4gKiBwcm92aWRlciAoYmV0dGVyLWF1dGgvQ2xlcmsvZXRjLikgZGlyZWN0bHkuIEl0IHVzZXMgb3VyIG93biBvcGFxdWUtdG9rZW5cbiAqIGxheWVyIGJlbG93IChgL2FwaS9leHQvYXV0aC8qYCkuIFN3YXBwaW5nIHRoZSB3ZWIgcHJvdmlkZXIgbGF0ZXIgdG91Y2hlc1xuICogb25seSB0aGUgYnJvd3NlciBzaWduLWluIHBhZ2UsIG5ldmVyIGFueXRoaW5nIGluIGhlcmUuXG4gKi9cblxuLyoqIEFQSSB2ZXJzaW9uIHByZWZpeCBmb3IgZXZlcnkgZXh0ZW5zaW9uLWZhY2luZyByb3V0ZS4gKi9cbmV4cG9ydCBjb25zdCBBUElfVkVSU0lPTiA9IFwidjFcIiBhcyBjb25zdDtcblxuLyoqIFdoZXJlIGEgc3BvbnNvciBsaW5lIGlzIGJlaW5nIHJlbmRlcmVkLiBEcml2ZXMgcGVyLXN1cmZhY2UgYmlsbGluZyBhbmRcbiAqICBsZXRzIHRoZSBiYWNrZW5kIHNlZ21lbnQgZGVsaXZlcnkgYnkgY2xpZW50IHR5cGUuICovXG5leHBvcnQgdHlwZSBTdXJmYWNlID1cbiAgfCBcImNjX3dlYnZpZXdcIiAvLyBDbGF1ZGUgQ29kZSBWUyBDb2RlL0N1cnNvciBwYW5lbCAocmljaCBvdmVybGF5KVxuICB8IFwiY2NfY2xpX3N0YXR1c2xpbmVcIiAvLyBDbGF1ZGUgQ29kZSB0ZXJtaW5hbCBzdGF0dXMtYmFyIE9TQy04IGxpbmtcbiAgfCBcImNjX2NsaV9zcGlubmVyXCIgLy8gQ2xhdWRlIENvZGUgdGVybWluYWwgdGhpbmtpbmctdmVyYiAoQ0MgPj0gMi4xLjE0MylcbiAgfCBcImNvZGV4X2NsaVwiIC8vIENvZGV4IENMSSBzdGFydHVwIGJhbm5lciAoUEFUSCB3cmFwcGVyKVxuICB8IFwiY29kZXhfd2Vidmlld1wiOyAvLyBDb2RleCBWUyBDb2RlIHBhbmVsXG5cbmV4cG9ydCBjb25zdCBBTExfU1VSRkFDRVM6IHJlYWRvbmx5IFN1cmZhY2VbXSA9IFtcbiAgXCJjY193ZWJ2aWV3XCIsXG4gIFwiY2NfY2xpX3N0YXR1c2xpbmVcIixcbiAgXCJjY19jbGlfc3Bpbm5lclwiLFxuICBcImNvZGV4X2NsaVwiLFxuICBcImNvZGV4X3dlYnZpZXdcIixcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN1cmZhY2UocmF3OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogU3VyZmFjZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiByYXcgJiYgKEFMTF9TVVJGQUNFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocmF3KVxuICAgID8gKHJhdyBhcyBTdXJmYWNlKVxuICAgIDogdW5kZWZpbmVkO1xufVxuXG4vKiogQSBzaW5nbGUgc2VydmVkIHNwb25zb3IgY3JlYXRpdmUgKHdlIGNhbGwgdGhlbSBcInNwb25zb3JzXCIsIG5vdCBcImFkc1wiKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3BvbnNvciB7XG4gIC8qKiBTdGFibGUgaWQgb2YgdGhpcyBzZXJ2ZWQgaW1wcmVzc2lvbi1lbGlnaWJsZSBjcmVhdGl2ZS4gKi9cbiAgc3BvbnNvcklkOiBzdHJpbmc7XG4gIGNhbXBhaWduSWQ6IHN0cmluZztcbiAgLyoqIFRoZSBvbmUtbGluZSB0ZXh0IHNob3duIGluIHRoZSBzcGlubmVyL3N0YXR1cyBzdXJmYWNlICgzXHUyMDEzNjAgY2hhcnMpLiAqL1xuICB0ZXh0OiBzdHJpbmc7XG4gIC8qKiBCcmFuZCBuYW1lIGZvciB0aGUgbGVhZGVyYm9hcmQgKG9wdGlvbmFsKS4gKi9cbiAgYnJhbmQ/OiBzdHJpbmc7XG4gIC8qKiBBYnNvbHV0ZSBodHRwcyBpY29uIFVSTCAob3B0aW9uYWw7IHN1cmZhY2VzIGZhbGwgYmFjayB0byBhIGdseXBoKS4gKi9cbiAgaWNvblVybD86IHN0cmluZztcbiAgLyoqIEFic29sdXRlIGh0dHBzIGxhbmRpbmcgVVJMIG9wZW5lZCBvbiBjbGljay4gKi9cbiAgY2xpY2tVcmw6IHN0cmluZztcbiAgLyoqIE9wYXF1ZSBwZXItc2VydmUgdG9rZW4gdGhlIGNsaWVudCBlY2hvZXMgYmFjayBvbiBldmVyeSBtZXRyaWMgYmVhY29uIHNvXG4gICAqICB0aGUgYmFja2VuZCBjYW4gYmluZCBhbiBldmVudCB0byBleGFjdGx5IHRoaXMgc2VydmUgKGFudGktc3Bvb2YpLiAqL1xuICBzZXNzaW9uVG9rZW46IHN0cmluZztcbiAgLyoqIFRydWUgd2hlbiB0aGlzIGNhbWUgZnJvbSB0aGUgc2lnbmVkLW91dCBERU1PIGludmVudG9yeTogaXQgcmVuZGVyc1xuICAgKiAgaWRlbnRpY2FsbHkgYW5kIHRoZSBjbGljayBvcGVucyB0aGUgcmVhbCBVUkwsIGJ1dCBtZXRyaWNzIHJvdXRlIHRvIHRoZVxuICAgKiAgZGVtbyBzaW5rIChhZHZlcnRpc2VyIGNoYXJnZWQsIG5vIHVzZXIgY3JlZGl0ZWQpLiAqL1xuICBkZW1vPzogYm9vbGVhbjtcbn1cblxuLyoqIERpc3BsYXktb25seSBlYXJuaW5ncyBmb3IgdGhlIHN0YXR1cyBiYXIgKHRoZSB1c2VyJ3MgNTAlIHNoYXJlKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmFsYW5jZXMge1xuICBsaWZldGltZVVzZDogc3RyaW5nOyAvLyBmb3JtYXR0ZWQgZGVjaW1hbCBzdHJpbmcsIGUuZy4gXCI3LjExXCJcbiAgdG9kYXlVc2Q6IHN0cmluZztcbiAgbGFzdFVwZGF0ZWRNczogbnVtYmVyO1xufVxuXG4vKiogR0VUIC92MS9wb3J0Zm9saW8gcmVzcG9uc2UuIFRoZSBleHRlbnNpb24gZHJhaW5zIGBzcG9uc29yc2AgaW4gb3JkZXIsXG4gKiAgcm90YXRpbmcgZXZlcnkgYHJvdGF0aW9uSW50ZXJ2YWxNc2AsIHJlZmV0Y2hpbmcgd2hlbiB0aGUgcXVldWUgZW1wdGllcyBvclxuICogIGB0dGxNc2AgZWxhcHNlcy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUG9ydGZvbGlvUmVzcG9uc2Uge1xuICBzcG9uc29yczogU3BvbnNvcltdO1xuICAvKiogSG93IGxvbmcgdGhlIGNsaWVudCBzaG91bGQgY2FjaGUgdGhpcyByZXNwb25zZSBiZWZvcmUgcmVmZXRjaGluZy4gKi9cbiAgdHRsTXM6IG51bWJlcjtcbiAgLyoqIE1pbmltdW0gZ2FwIGJldHdlZW4gb24tZGlzayByb3RhdGlvbnMgKGZsb29yZWQgc2VydmVyLXNpZGUgdG8gcHJvdGVjdFxuICAgKiAgdGhlIGhvc3QgZnJvbSBhIGhvc3RpbGUvYnVnZ3kgdmFsdWUgcmV3cml0aW5nIENDJ3MgNC42IE1CIGJ1bmRsZSkuICovXG4gIHJvdGF0aW9uSW50ZXJ2YWxNczogbnVtYmVyO1xuICAvKiogQ3VtdWxhdGl2ZSB2aXNpYmxlIHRpbWUgYSBzcG9uc29yIG11c3QgYWNjcnVlIGJlZm9yZSBpdCBiaWxscyBhcyBhXG4gICAqICB2aWV3YWJsZSBpbXByZXNzaW9uLiAqL1xuICB2aWV3VGhyZXNob2xkTXM6IG51bWJlcjtcbiAgLyoqIFNpZ25lZC1pbiBvbmx5OyBudWxsIGZvciBkZW1vL2Fub255bW91cyBmZXRjaGVzLiAqL1xuICBiYWxhbmNlczogQmFsYW5jZXMgfCBudWxsO1xufVxuXG4vKiogQmlsbGFibGUgbGlmZWN5Y2xlIGV2ZW50cy4gYGltcHJlc3Npb25gID0gZmlyc3QgcGFpbnQ7IGB2aWV3YWJsZWAgPVxuICogIGNyb3NzZWQgdGhlIHZpZXcgdGhyZXNob2xkOyBgdmlld190aWNrYCA9IHBlcmlvZGljIGhlYXJ0YmVhdCB3aGlsZVxuICogIHZpc2libGU7IGBjbGlja2AgPSBhbmNob3Igb3BlbmVkOyBgZXJyb3JfaW1wcmVzc2lvbmAgPSBzYWZldHktbmV0IGZpcmUgc29cbiAqICBhIHN0dWNrLWJ1dC12aXNpYmxlIHNwb25zb3Igc3RpbGwgYmlsbHMgb25jZS4gKi9cbmV4cG9ydCB0eXBlIE1ldHJpY0V2ZW50ID1cbiAgfCBcImltcHJlc3Npb25cIlxuICB8IFwidmlld2FibGVcIlxuICB8IFwidmlld190aWNrXCJcbiAgfCBcInZpZXdfdGhyZXNob2xkX21ldFwiXG4gIHwgXCJjbGlja1wiXG4gIHwgXCJlcnJvcl9pbXByZXNzaW9uXCI7XG5cbmV4cG9ydCBjb25zdCBCSUxMQUJMRV9FVkVOVFM6IHJlYWRvbmx5IE1ldHJpY0V2ZW50W10gPSBbXG4gIFwiaW1wcmVzc2lvblwiLFxuICBcInZpZXdhYmxlXCIsXG4gIFwidmlld190aWNrXCIsXG4gIFwidmlld190aHJlc2hvbGRfbWV0XCIsXG4gIFwiY2xpY2tcIixcbiAgXCJlcnJvcl9pbXByZXNzaW9uXCIsXG5dO1xuXG4vKiogUE9TVCAvdjEvbWV0cmljcyBib2R5LiBTZW50IHdpdGggYSBCZWFyZXIgdG9rZW4gd2hlbiBzaWduZWQgaW4sIGVsc2UgaXRcbiAqICByb3V0ZXMgdG8gdGhlIGRlbW8gc2luay4gYG5vbmNlYCBkZWR1cGVzIHJldHJpZXM7IGBzZXNzaW9uVG9rZW5gIGJpbmRzIHRoZVxuICogIGV2ZW50IHRvIGEgc3BlY2lmaWMgc2VydmUuICovXG5leHBvcnQgaW50ZXJmYWNlIE1ldHJpY0JlYWNvbiB7XG4gIGV2ZW50OiBNZXRyaWNFdmVudDtcbiAgc3BvbnNvcklkOiBzdHJpbmc7XG4gIGNhbXBhaWduSWQ6IHN0cmluZztcbiAgc3VyZmFjZTogU3VyZmFjZTtcbiAgLyoqIFN0YWJsZSBhbm9ueW1vdXMgZGV2aWNlIGlkIChtaW50ZWQgY2xpZW50LXNpZGUsIHBlcnNpc3RlZCBsb2NhbGx5KS4gKi9cbiAgY2xpZW50SWQ6IHN0cmluZztcbiAgLyoqIFBlci1zZXJ2ZSB0b2tlbiBmcm9tIHRoZSBTcG9uc29yLiAqL1xuICBzZXNzaW9uVG9rZW46IHN0cmluZztcbiAgLyoqIFVVSUQgdjQsIHVuaXF1ZSBwZXIgZXZlbnQ7IGJhY2tlbmQgaWdub3JlcyBkdXBsaWNhdGVzLiAqL1xuICBub25jZTogc3RyaW5nO1xuICAvKiogSVNPIHRpbWVzdGFtcCAoY2xpZW50IGNsb2NrOyBiYWNrZW5kIHN0YW1wcyBpdHMgb3duIHRvbykuICovXG4gIHRzOiBzdHJpbmc7XG4gIC8qKiBDdW11bGF0aXZlIHZpc2libGUgbXMgYXQgdGhlIG1vbWVudCBvZiB0aGUgZXZlbnQgKGZvciB2aWV3L2NsaWNrIGZsb29ycykuICovXG4gIHZpc2libGVNcz86IG51bWJlcjtcbiAgLyoqIENsaWVudCBlbnZpcm9ubWVudCBmaW5nZXJwcmludCBmb3IgdHJhZmZpYyBzZWdtZW50YXRpb24gKG9zL2FyY2gvZWRpdG9yKS4gKi9cbiAgY2xpZW50PzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbi8qKiBHRVQgL3YxL2Vhcm5pbmdzIHJlc3BvbnNlIChzaWduZWQtaW4pLiAqL1xuZXhwb3J0IGludGVyZmFjZSBFYXJuaW5nc1Jlc3BvbnNlIHtcbiAgbGlmZXRpbWVVc2Q6IHN0cmluZztcbiAgdG9kYXlVc2Q6IHN0cmluZztcbn1cblxuLy8gLS0tIEV4dGVuc2lvbiBhdXRoIChvdXIgb3duIHRva2VuIGxheWVyOyBwcm92aWRlci1hZ25vc3RpYykgLS0tLS0tLS0tLS0tLS0tXG5cbi8qKiBQT1NUIC92MS9leHQvYXV0aC9zdGFydCByZXNwb25zZS4gVGhlIGV4dGVuc2lvbiBvcGVucyBgYXV0aFVybGAgaW4gdGhlXG4gKiAgc3lzdGVtIGJyb3dzZXIgYW5kIHBvbGxzIHdpdGggYHN0YXRlYC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0QXV0aFN0YXJ0UmVzcG9uc2Uge1xuICBzdGF0ZTogc3RyaW5nO1xuICBhdXRoVXJsOiBzdHJpbmc7XG4gIC8qKiBIb3cgbG9uZyB0aGUgY2xpZW50IHNob3VsZCBwb2xsIGJlZm9yZSBnaXZpbmcgdXAgKHNlY29uZHMpLiAqL1xuICBleHBpcmVzSW5TZWM6IG51bWJlcjtcbn1cblxuLyoqIEdFVCAvdjEvZXh0L2F1dGgvcG9sbD9zdGF0ZT0gcmVzcG9uc2UuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhQb2xsUmVzcG9uc2Uge1xuICBzdGF0dXM6IFwicGVuZGluZ1wiIHwgXCJjb21wbGV0ZVwiIHwgXCJleHBpcmVkXCI7XG4gIGFjY2Vzc1Rva2VuPzogc3RyaW5nO1xuICByZWZyZXNoVG9rZW4/OiBzdHJpbmc7XG59XG5cbi8qKiBQT1NUIC92MS9leHQvYXV0aC9yZWZyZXNoIGJvZHkgKyByZXNwb25zZS4gVGhlIHJlZnJlc2ggdG9rZW4gUk9UQVRFUzpcbiAqICB0aGUgcmVzcG9uc2UgYWx3YXlzIGNhcnJpZXMgYSBmcmVzaCBvbmUgdG8gcGVyc2lzdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0QXV0aFJlZnJlc2hSZXF1ZXN0IHtcbiAgcmVmcmVzaFRva2VuOiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhSZWZyZXNoUmVzcG9uc2Uge1xuICBhY2Nlc3NUb2tlbjogc3RyaW5nO1xuICByZWZyZXNoVG9rZW46IHN0cmluZztcbn1cblxuLyoqIFJvdXRlIGJ1aWxkZXJzIHNvIGNhbGxlcnMgbmV2ZXIgaGFuZC1jb25jYXRlbmF0ZSBwYXRocy4gUGF0aHMgYXJlIHJlbGF0aXZlXG4gKiAgdG8gdGhlIGJhY2tlbmQgYmFzZSBVUkwgYW5kIGluY2x1ZGUgdGhlIE5leHQuanMgYC9hcGlgIG1vdW50LiAqL1xuY29uc3QgUCA9IGAvYXBpLyR7QVBJX1ZFUlNJT059YCBhcyBjb25zdDtcblxuZXhwb3J0IGNvbnN0IHJvdXRlcyA9IHtcbiAgcG9ydGZvbGlvOiAoc3VyZmFjZTogU3VyZmFjZSwgY2xpZW50SWQ6IHN0cmluZykgPT5cbiAgICBgJHtQfS9wb3J0Zm9saW8/c3VyZmFjZT0ke2VuY29kZVVSSUNvbXBvbmVudChzdXJmYWNlKX0mY2xpZW50X2lkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGNsaWVudElkKX1gLFxuICBtZXRyaWNzOiAoKSA9PiBgJHtQfS9tZXRyaWNzYCxcbiAgZWFybmluZ3M6ICgpID0+IGAke1B9L2Vhcm5pbmdzYCxcbiAgYXV0aFN0YXJ0OiAoKSA9PiBgJHtQfS9leHQvYXV0aC9zdGFydGAsXG4gIGF1dGhQb2xsOiAoc3RhdGU6IHN0cmluZykgPT5cbiAgICBgJHtQfS9leHQvYXV0aC9wb2xsP3N0YXRlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN0YXRlKX1gLFxuICBhdXRoUmVmcmVzaDogKCkgPT4gYCR7UH0vZXh0L2F1dGgvcmVmcmVzaGAsXG4gIGF1dGhTaWdub3V0OiAoKSA9PiBgJHtQfS9leHQvYXV0aC9zaWdub3V0YCxcbn0gYXMgY29uc3Q7XG4iLCAiaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG4vKiogRXJyb3IgY2FycnlpbmcgdGhlIEhUVFAgc3RhdHVzIHNvIGNhbGxlcnMgY2FuIGJyYW5jaCBvbiA0MDEgZXRjLiAqL1xuZXhwb3J0IGNsYXNzIEh0dHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IHN0YXR1czogbnVtYmVyLFxuICAgIHB1YmxpYyByZWFkb25seSBib2R5VGV4dDogc3RyaW5nLFxuICApIHtcbiAgICBzdXBlcihgSFRUUCAke3N0YXR1c31gKTtcbiAgfVxufVxuXG5jb25zdCBERUZBVUxUX1RJTUVPVVRfTVMgPSAxMF8wMDA7XG5cbi8qKlxuICogTWluaW1hbCBKU09OIGZldGNoIHdpdGggYSBoYXJkIHRpbWVvdXQuIFRoZSBleHRlbnNpb24gaG9zdCBzaGlwcyBOb2RlIDIwKyxcbiAqIHNvIGdsb2JhbCBmZXRjaC9BYm9ydENvbnRyb2xsZXIgYXJlIGF2YWlsYWJsZSB3aXRob3V0IGRlcGVuZGVuY2llcy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSnNvbjxUPihcbiAgdXJsOiBzdHJpbmcsXG4gIGluaXQ/OiBSZXF1ZXN0SW5pdCAmIHsgdGltZW91dE1zPzogbnVtYmVyIH0sXG4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3QgY3RsID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCB0ID0gc2V0VGltZW91dChcbiAgICAoKSA9PiBjdGwuYWJvcnQoKSxcbiAgICBpbml0Py50aW1lb3V0TXMgPz8gREVGQVVMVF9USU1FT1VUX01TLFxuICApO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgLi4uaW5pdCxcbiAgICAgIHNpZ25hbDogY3RsLnNpZ25hbCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIC4uLihpbml0Py5oZWFkZXJzID8/IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBIdHRwRXJyb3IocmVzLnN0YXR1cywgdGV4dCk7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCkgYXMgVDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmICghKGUgaW5zdGFuY2VvZiBIdHRwRXJyb3IpKSBkbG9nKFwiaHR0cFwiLCBcImZldGNoIGZhaWxlZFwiLCB7IHVybCwgZTogU3RyaW5nKGUpIH0pO1xuICAgIHRocm93IGU7XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHQpO1xuICB9XG59XG4iLCAiaW1wb3J0ICogYXMgdnNjb2RlIGZyb20gXCJ2c2NvZGVcIjtcbmltcG9ydCB0eXBlIHtcbiAgRXh0QXV0aFBvbGxSZXNwb25zZSxcbiAgRXh0QXV0aFJlZnJlc2hSZXNwb25zZSxcbiAgRXh0QXV0aFN0YXJ0UmVzcG9uc2UsXG59IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IHJvdXRlcyB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IGZldGNoSnNvbiwgSHR0cEVycm9yIH0gZnJvbSBcIi4vaHR0cFwiO1xuaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG5jb25zdCBTRUNSRVRfS0VZID0gXCJtZWFud2hpbGUudG9rZW5zLnYxXCI7XG5cbmludGVyZmFjZSBTdG9yZWRUb2tlbnMge1xuICBhY2Nlc3NUb2tlbjogc3RyaW5nO1xuICByZWZyZXNoVG9rZW46IHN0cmluZztcbn1cblxuLyoqXG4gKiBFeHRlbnNpb24tc2lkZSBhdXRoIGFnYWluc3Qgb3VyIG9wYXF1ZSB0b2tlbiBsYXllci4gVGhlIGZsb3cgaXNcbiAqIHN0YXJ0IFx1MjE5MiBvcGVuIGJyb3dzZXIgXHUyMTkyIHBvbGwgXHUyMTkyIHN0b3JlOyB0b2tlbnMgbGl2ZSBPTkxZIGluIFZTIENvZGVcbiAqIFNlY3JldFN0b3JhZ2UgKG5ldmVyIG9uIGRpc2spLCBhbmQgdGhlIHJlZnJlc2ggdG9rZW4gcm90YXRlcyBvbiBldmVyeSB1c2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBBdXRoU2VydmljZSB7XG4gIHByaXZhdGUgdG9rZW5zOiBTdG9yZWRUb2tlbnMgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZWZyZXNoaW5nOiBQcm9taXNlPGJvb2xlYW4+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBzZWNyZXRzOiB2c2NvZGUuU2VjcmV0U3RvcmFnZSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJhc2U6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNsaWVudElkOiBzdHJpbmcsXG4gICkge31cblxuICBhc3luYyBsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLnNlY3JldHMuZ2V0KFNFQ1JFVF9LRVkpO1xuICAgICAgaWYgKHJhdykgdGhpcy50b2tlbnMgPSBKU09OLnBhcnNlKHJhdykgYXMgU3RvcmVkVG9rZW5zO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy50b2tlbnMgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBzaWduZWRJbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnMgIT09IG51bGw7XG4gIH1cblxuICBnZXQgYWNjZXNzVG9rZW4oKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zPy5hY2Nlc3NUb2tlbiA/PyBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0KHQ6IFN0b3JlZFRva2VucyB8IG51bGwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnRva2VucyA9IHQ7XG4gICAgaWYgKHQpIGF3YWl0IHRoaXMuc2VjcmV0cy5zdG9yZShTRUNSRVRfS0VZLCBKU09OLnN0cmluZ2lmeSh0KSk7XG4gICAgZWxzZSBhd2FpdCB0aGlzLnNlY3JldHMuZGVsZXRlKFNFQ1JFVF9LRVkpO1xuICB9XG5cbiAgLyoqIEZ1bGwgaW50ZXJhY3RpdmUgc2lnbi1pbi4gUmV0dXJucyB0cnVlIHdoZW4gdG9rZW5zIHdlcmUgb2J0YWluZWQuICovXG4gIGFzeW5jIHNpZ25Jbihwcm9ncmVzcz86IChtc2c6IHN0cmluZykgPT4gdm9pZCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gYXdhaXQgZmV0Y2hKc29uPEV4dEF1dGhTdGFydFJlc3BvbnNlPihcbiAgICAgIHRoaXMuYmFzZSArIHJvdXRlcy5hdXRoU3RhcnQoKSxcbiAgICAgIHsgbWV0aG9kOiBcIlBPU1RcIiwgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBjbGllbnRJZDogdGhpcy5jbGllbnRJZCB9KSB9LFxuICAgICk7XG4gICAgZGxvZyhcImF1dGhcIiwgXCJzdGFydCBva1wiLCB7IHN0YXRlOiBzdGFydC5zdGF0ZS5zbGljZSgwLCA2KSArIFwiXHUyMDI2XCIgfSk7XG4gICAgcHJvZ3Jlc3M/LihcIk9wZW5pbmcgYnJvd3Nlclx1MjAyNlwiKTtcbiAgICBhd2FpdCB2c2NvZGUuZW52Lm9wZW5FeHRlcm5hbCh2c2NvZGUuVXJpLnBhcnNlKHN0YXJ0LmF1dGhVcmwpKTtcblxuICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIHN0YXJ0LmV4cGlyZXNJblNlYyAqIDEwMDA7XG4gICAgcHJvZ3Jlc3M/LihcIldhaXRpbmcgZm9yIHlvdSB0byBmaW5pc2ggc2lnbmluZyBpblx1MjAyNlwiKTtcbiAgICB3aGlsZSAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAyMDAwKSk7XG4gICAgICBsZXQgcG9sbDogRXh0QXV0aFBvbGxSZXNwb25zZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHBvbGwgPSBhd2FpdCBmZXRjaEpzb248RXh0QXV0aFBvbGxSZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLmF1dGhQb2xsKHN0YXJ0LnN0YXRlKSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGxvZyhcImF1dGhcIiwgXCJwb2xsIGVycm9yIChyZXRyeWluZylcIiwgeyBlOiBTdHJpbmcoZSkgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKHBvbGwuc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiYgcG9sbC5hY2Nlc3NUb2tlbiAmJiBwb2xsLnJlZnJlc2hUb2tlbikge1xuICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3Qoe1xuICAgICAgICAgIGFjY2Vzc1Rva2VuOiBwb2xsLmFjY2Vzc1Rva2VuLFxuICAgICAgICAgIHJlZnJlc2hUb2tlbjogcG9sbC5yZWZyZXNoVG9rZW4sXG4gICAgICAgIH0pO1xuICAgICAgICBkbG9nKFwiYXV0aFwiLCBcInNpZ24taW4gY29tcGxldGVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHBvbGwuc3RhdHVzID09PSBcImV4cGlyZWRcIikgYnJlYWs7XG4gICAgfVxuICAgIGRsb2coXCJhdXRoXCIsIFwic2lnbi1pbiBleHBpcmVkL2FiYW5kb25lZFwiKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKiogUm90YXRlIHRoZSByZWZyZXNoIHRva2VuLiBTaW5nbGUtZmxpZ2h0IHNvIGNvbmN1cnJlbnQgNDAxcyByZWZyZXNoIG9uY2UuICovXG4gIGFzeW5jIHJlZnJlc2goKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgaWYgKCF0aGlzLnRva2VucykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0aGlzLnJlZnJlc2hpbmcpIHJldHVybiB0aGlzLnJlZnJlc2hpbmc7XG4gICAgdGhpcy5yZWZyZXNoaW5nID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaEpzb248RXh0QXV0aFJlZnJlc2hSZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLmF1dGhSZWZyZXNoKCksXG4gICAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcmVmcmVzaFRva2VuOiB0aGlzLnRva2Vucz8ucmVmcmVzaFRva2VuIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdCh7XG4gICAgICAgICAgYWNjZXNzVG9rZW46IHIuYWNjZXNzVG9rZW4sXG4gICAgICAgICAgcmVmcmVzaFRva2VuOiByLnJlZnJlc2hUb2tlbixcbiAgICAgICAgfSk7XG4gICAgICAgIGRsb2coXCJhdXRoXCIsIFwicmVmcmVzaCBva1wiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIEludmFsaWQvcmV2b2tlZCByZWZyZXNoIHRva2VuIFx1MjE5MiBmdWxseSBzaWduZWQgb3V0LlxuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEh0dHBFcnJvciAmJiAoZS5zdGF0dXMgPT09IDQwMSB8fCBlLnN0YXR1cyA9PT0gNDAwKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChudWxsKTtcbiAgICAgICAgfVxuICAgICAgICBkbG9nKFwiYXV0aFwiLCBcInJlZnJlc2ggZmFpbGVkXCIsIHsgZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLnJlZnJlc2hpbmcgPSBudWxsO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHRoaXMucmVmcmVzaGluZztcbiAgfVxuXG4gIGFzeW5jIHNpZ25PdXQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcnQgPSB0aGlzLnRva2Vucz8ucmVmcmVzaFRva2VuO1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdChudWxsKTtcbiAgICBpZiAoIXJ0KSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZldGNoSnNvbih0aGlzLmJhc2UgKyByb3V0ZXMuYXV0aFNpZ25vdXQoKSwge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHJlZnJlc2hUb2tlbjogcnQgfSksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwiYXV0aFwiLCBcInNpZ25vdXQgYmVhY29uIGZhaWxlZCAobG9jYWwgc3RhdGUgY2xlYXJlZClcIiwge1xuICAgICAgICBlOiBTdHJpbmcoZSksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUnVuIGFuIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdDsgb24gNDAxLCByZWZyZXNoIG9uY2UgYW5kIHJldHJ5LiBGYWxscyBiYWNrXG4gICAqIHRvIGFuIGFub255bW91cyBjYWxsIHdoZW4gc2lnbmVkIG91dCAocG9ydGZvbGlvIHN1cHBvcnRzIGJvdGgpLlxuICAgKi9cbiAgYXN5bmMgd2l0aEF1dGg8VD4oZm46IChiZWFyZXI6IHN0cmluZyB8IG51bGwpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBpZiAoIXRoaXMudG9rZW5zKSByZXR1cm4gZm4obnVsbCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmbih0aGlzLnRva2Vucy5hY2Nlc3NUb2tlbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBIdHRwRXJyb3IgJiYgZS5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgICBjb25zdCBvayA9IGF3YWl0IHRoaXMucmVmcmVzaCgpO1xuICAgICAgICByZXR1cm4gZm4ob2sgPyAodGhpcy50b2tlbnM/LmFjY2Vzc1Rva2VuID8/IG51bGwpIDogbnVsbCk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYywgcmVuYW1lU3luYywgdW5saW5rU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHR5cGUgeyBNZXRyaWNFdmVudCwgU3VyZmFjZSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IEFMTF9TVVJGQUNFUywgQklMTEFCTEVfRVZFTlRTIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC9jb250cmFjdFwiO1xuaW1wb3J0IHsgbWVhbndoaWxlRGlyIH0gZnJvbSBcIi4vY29uZmlnXCI7XG5pbXBvcnQgeyBldmVudE5vbmNlIH0gZnJvbSBcIi4vaWRzXCI7XG5pbXBvcnQgeyBkbG9nIH0gZnJvbSBcIi4vbG9nXCI7XG5pbXBvcnQgdHlwZSB7IE1ldHJpY3NDbGllbnQgfSBmcm9tIFwiLi9tZXRyaWNzXCI7XG5cbmNvbnN0IEVWRU5UU19GSUxFID0gXCJjbGktZXZlbnRzLmpzb25sXCI7XG5cbmludGVyZmFjZSBDbGlFdmVudExpbmUge1xuICBldmVudD86IHN0cmluZztcbiAgc3BvbnNvcklkPzogc3RyaW5nO1xuICBjYW1wYWlnbklkPzogc3RyaW5nO1xuICBzZXNzaW9uVG9rZW4/OiBzdHJpbmc7XG4gIHN1cmZhY2U/OiBzdHJpbmc7XG4gIHZpc2libGVNcz86IG51bWJlcjtcbiAgdHM/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogRHJhaW4gaW1wcmVzc2lvbiBldmVudHMgd3JpdHRlbiBieSBvdXQtb2YtcHJvY2VzcyBDTEkgc3VyZmFjZXMgKHRoZVxuICogc3RhdHVzbGluZSBzY3JpcHQsIHRoZSBDb2RleCB3cmFwcGVyKS4gVGhlIGZpbGUgaXMgcmVuYW1lZCBiZWZvcmUgcmVhZGluZ1xuICogc28gY29uY3VycmVudCBhcHBlbmRzIGZyb20gYSBsaXZlIENMSSBzZXNzaW9uIGxhbmQgaW4gYSBmcmVzaCBmaWxlIGluc3RlYWRcbiAqIG9mIGJlaW5nIGxvc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcmFpbkNsaUV2ZW50cyhtZXRyaWNzOiBNZXRyaWNzQ2xpZW50LCBjbGllbnRJZDogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgZmlsZSA9IGpvaW4obWVhbndoaWxlRGlyKCksIEVWRU5UU19GSUxFKTtcbiAgaWYgKCFleGlzdHNTeW5jKGZpbGUpKSByZXR1cm4gMDtcblxuICBjb25zdCB0bXAgPSBmaWxlICsgXCIuZHJhaW5pbmdcIjtcbiAgdHJ5IHtcbiAgICByZW5hbWVTeW5jKGZpbGUsIHRtcCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiAwOyAvLyBhbm90aGVyIGRyYWluIHJhY2VkIHVzOyBmaW5lXG4gIH1cblxuICBsZXQgZHJhaW5lZCA9IDA7XG4gIHRyeSB7XG4gICAgY29uc3QgbGluZXMgPSByZWFkRmlsZVN5bmModG1wLCBcInV0ZjhcIikuc3BsaXQoXCJcXG5cIik7XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCB0ID0gbGluZS50cmltKCk7XG4gICAgICBpZiAoIXQpIGNvbnRpbnVlO1xuICAgICAgbGV0IGo6IENsaUV2ZW50TGluZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGogPSBKU09OLnBhcnNlKHQpIGFzIENsaUV2ZW50TGluZTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV2ZW50ID0gai5ldmVudCBhcyBNZXRyaWNFdmVudDtcbiAgICAgIGNvbnN0IHN1cmZhY2UgPSBqLnN1cmZhY2UgYXMgU3VyZmFjZTtcbiAgICAgIGlmICghQklMTEFCTEVfRVZFTlRTLmluY2x1ZGVzKGV2ZW50KSkgY29udGludWU7XG4gICAgICBpZiAoIUFMTF9TVVJGQUNFUy5pbmNsdWRlcyhzdXJmYWNlKSkgY29udGludWU7XG4gICAgICBpZiAoIWouc3BvbnNvcklkIHx8ICFqLmNhbXBhaWduSWQpIGNvbnRpbnVlO1xuICAgICAgbWV0cmljcy5lbnF1ZXVlKHtcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIHNwb25zb3JJZDogai5zcG9uc29ySWQsXG4gICAgICAgIGNhbXBhaWduSWQ6IGouY2FtcGFpZ25JZCxcbiAgICAgICAgc3VyZmFjZSxcbiAgICAgICAgY2xpZW50SWQsXG4gICAgICAgIHNlc3Npb25Ub2tlbjogai5zZXNzaW9uVG9rZW4gPz8gXCJcIixcbiAgICAgICAgbm9uY2U6IGV2ZW50Tm9uY2UoKSxcbiAgICAgICAgdHM6IGoudHMgfHwgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAuLi4odHlwZW9mIGoudmlzaWJsZU1zID09PSBcIm51bWJlclwiID8geyB2aXNpYmxlTXM6IGoudmlzaWJsZU1zIH0gOiB7fSksXG4gICAgICB9KTtcbiAgICAgIGRyYWluZWQrKztcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgdHJ5IHtcbiAgICAgIHVubGlua1N5bmModG1wKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIGFscmVhZHkgZ29uZSAqL1xuICAgIH1cbiAgfVxuICBpZiAoZHJhaW5lZCA+IDApIGRsb2coXCJjbGktZXZlbnRzXCIsIFwiZHJhaW5lZFwiLCB7IGRyYWluZWQgfSk7XG4gIHJldHVybiBkcmFpbmVkO1xufVxuIiwgImltcG9ydCB7IHJhbmRvbUJ5dGVzLCByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IG1lYW53aGlsZURpciB9IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG4vKipcbiAqIFN0YWJsZSBhbm9ueW1vdXMgZGV2aWNlIGlkLiBNaW50ZWQgb25jZSwgcGVyc2lzdGVkIGluIH4vLm1lYW53aGlsZSwgYW5kXG4gKiByZXVzZWQgYWNyb3NzIGVkaXRvciByZXN0YXJ0cyBzbyBpbXByZXNzaW9ucyBmcm9tIG9uZSBtYWNoaW5lIGFnZ3JlZ2F0ZS5cbiAqIE5vdCBkZXJpdmVkIGZyb20gYW55IGhhcmR3YXJlIGlkZW50aWZpZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXZpY2VJZCgpOiBzdHJpbmcge1xuICBjb25zdCBmaWxlID0gam9pbihtZWFud2hpbGVEaXIoKSwgXCJkZXZpY2UuanNvblwiKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoZmlsZSwgXCJ1dGY4XCIpKSBhcyB7IGNsaWVudElkPzogc3RyaW5nIH07XG4gICAgaWYgKGogJiYgdHlwZW9mIGouY2xpZW50SWQgPT09IFwic3RyaW5nXCIgJiYgai5jbGllbnRJZC5sZW5ndGggPj0gOCkge1xuICAgICAgcmV0dXJuIGouY2xpZW50SWQ7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiBtaW50IGJlbG93ICovXG4gIH1cbiAgY29uc3QgaWQgPSBgZGV2XyR7cmFuZG9tQnl0ZXMoMTIpLnRvU3RyaW5nKFwiYmFzZTY0dXJsXCIpfWA7XG4gIHRyeSB7XG4gICAgd3JpdGVGaWxlU3luYyhmaWxlLCBKU09OLnN0cmluZ2lmeSh7IGNsaWVudElkOiBpZCB9LCBudWxsLCAyKSArIFwiXFxuXCIsIHtcbiAgICAgIG1vZGU6IDBvNjAwLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvKiBzdGlsbCB1c2FibGUgaW4tbWVtb3J5IGZvciB0aGlzIHNlc3Npb24gKi9cbiAgfVxuICByZXR1cm4gaWQ7XG59XG5cbi8qKiBVbmlxdWUgcGVyLWV2ZW50IG5vbmNlIGZvciBtZXRyaWMgZGVkdXBlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50Tm9uY2UoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbVVVSUQoKTtcbn1cbiIsICJpbXBvcnQgeyBhcmNoLCBwbGF0Zm9ybSB9IGZyb20gXCJub2RlOm9zXCI7XG5pbXBvcnQgKiBhcyB2c2NvZGUgZnJvbSBcInZzY29kZVwiO1xuaW1wb3J0IHR5cGUge1xuICBNZXRyaWNCZWFjb24sXG4gIE1ldHJpY0V2ZW50LFxuICBTcG9uc29yLFxuICBTdXJmYWNlLFxufSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aFwiO1xuaW1wb3J0IHsgZmV0Y2hKc29uIH0gZnJvbSBcIi4vaHR0cFwiO1xuaW1wb3J0IHsgZXZlbnROb25jZSB9IGZyb20gXCIuL2lkc1wiO1xuaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG5jb25zdCBNQVhfUVVFVUUgPSAyMDA7XG5jb25zdCBGTFVTSF9JTlRFUlZBTF9NUyA9IDE1XzAwMDtcblxuLyoqXG4gKiBGaXJlLWFuZC1mb3JnZXQgYmVhY29uIHNlbmRlciB3aXRoIGEgc21hbGwgaW4tbWVtb3J5IHJldHJ5IHF1ZXVlLiBMb3NpbmcgYVxuICogYmVhY29uIGNvc3RzIGNlbnRzLCBzbyB0aGUgZmFpbHVyZSBtb2RlIGlzIFwiZHJvcCBvbGRlc3RcIiwgbmV2ZXIgXCJibG9jayB0aGVcbiAqIGVkaXRvclwiIG9yIFwiZ3JvdyB1bmJvdW5kZWRcIi5cbiAqL1xuZXhwb3J0IGNsYXNzIE1ldHJpY3NDbGllbnQge1xuICBwcml2YXRlIHF1ZXVlOiBNZXRyaWNCZWFjb25bXSA9IFtdO1xuICBwcml2YXRlIHRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRJbnRlcnZhbD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50SWQ6IHN0cmluZyxcbiAgKSB7fVxuXG4gIHN0YXJ0KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnRpbWVyKSByZXR1cm47XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKCgpID0+IHZvaWQgdGhpcy5mbHVzaCgpLCBGTFVTSF9JTlRFUlZBTF9NUyk7XG4gIH1cblxuICBkaXNwb3NlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnRpbWVyKSBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIHZvaWQgdGhpcy5mbHVzaCgpO1xuICB9XG5cbiAgLyoqIEJ1aWxkICsgZW5xdWV1ZSBhIGJlYWNvbiBmb3IgYSBzZXJ2ZWQgc3BvbnNvci4gKi9cbiAgZW1pdChcbiAgICBldmVudDogTWV0cmljRXZlbnQsXG4gICAgc3BvbnNvcjogU3BvbnNvcixcbiAgICBzdXJmYWNlOiBTdXJmYWNlLFxuICAgIHZpc2libGVNcz86IG51bWJlcixcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5lbnF1ZXVlKHtcbiAgICAgIGV2ZW50LFxuICAgICAgc3BvbnNvcklkOiBzcG9uc29yLnNwb25zb3JJZCxcbiAgICAgIGNhbXBhaWduSWQ6IHNwb25zb3IuY2FtcGFpZ25JZCxcbiAgICAgIHN1cmZhY2UsXG4gICAgICBjbGllbnRJZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIHNlc3Npb25Ub2tlbjogc3BvbnNvci5zZXNzaW9uVG9rZW4sXG4gICAgICBub25jZTogZXZlbnROb25jZSgpLFxuICAgICAgdHM6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIC4uLih2aXNpYmxlTXMgIT09IHVuZGVmaW5lZCA/IHsgdmlzaWJsZU1zIH0gOiB7fSksXG4gICAgICBjbGllbnQ6IHtcbiAgICAgICAgb3M6IHBsYXRmb3JtKCksXG4gICAgICAgIGFyY2g6IGFyY2goKSxcbiAgICAgICAgZWRpdG9yOiB2c2NvZGUuZW52LmFwcE5hbWUsXG4gICAgICAgIGV4dFZlcnNpb246IHZzY29kZS5leHRlbnNpb25zLmdldEV4dGVuc2lvbihcbiAgICAgICAgICBcInNoYXduZXNxdWl2ZWwubWVhbndoaWxlXCIsXG4gICAgICAgICk/LnBhY2thZ2VKU09OPy52ZXJzaW9uLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBFbnF1ZXVlIGEgcHJlLWJ1aWx0IGJlYWNvbiAodXNlZCBieSB0aGUgbG9vcGJhY2sgZm9yIHdlYnZpZXcgZXZlbnRzKS4gKi9cbiAgZW5xdWV1ZShiZWFjb246IE1ldHJpY0JlYWNvbik6IHZvaWQge1xuICAgIHRoaXMucXVldWUucHVzaChiZWFjb24pO1xuICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCA+IE1BWF9RVUVVRSkgdGhpcy5xdWV1ZS5zaGlmdCgpO1xuICAgIC8vIENsaWNrcyBhcmUgcHJlY2lvdXMgXHUyMDE0IHB1c2ggdGhlbSBvdXQgaW1tZWRpYXRlbHkuXG4gICAgaWYgKGJlYWNvbi5ldmVudCA9PT0gXCJjbGlja1wiIHx8IGJlYWNvbi5ldmVudCA9PT0gXCJ2aWV3X3RocmVzaG9sZF9tZXRcIikge1xuICAgICAgdm9pZCB0aGlzLmZsdXNoKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwZW5kaW5nOiBQcm9taXNlPHZvaWQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgLyoqIERyYWluIHRoZSBxdWV1ZS4gQXdhaXRpbmcgdGhpcyBhbHdheXMgY292ZXJzIGFueSBpbi1mbGlnaHQgZHJhaW4gdG9vLFxuICAgKiAgc28gY2FsbGVycyAoZGlzcG9zZSwgdGVzdHMpIGdldCBhIHJlYWwgY29tcGxldGlvbiBzaWduYWwuICovXG4gIGZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnBlbmRpbmcpIHJldHVybiB0aGlzLnBlbmRpbmc7XG4gICAgaWYgKHRoaXMucXVldWUubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgdGhpcy5wZW5kaW5nID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHdoaWxlICh0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBiZWFjb24gPSB0aGlzLnF1ZXVlWzBdO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmF1dGgud2l0aEF1dGgoKGJlYXJlcikgPT5cbiAgICAgICAgICAgICAgZmV0Y2hKc29uKHRoaXMuYmFzZSArIHJvdXRlcy5tZXRyaWNzKCksIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJlYWNvbiksXG4gICAgICAgICAgICAgICAgaGVhZGVyczogYmVhcmVyID8geyBhdXRob3JpemF0aW9uOiBgQmVhcmVyICR7YmVhcmVyfWAgfSA6IHt9LFxuICAgICAgICAgICAgICAgIHRpbWVvdXRNczogNjAwMCxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5xdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIExlYXZlIHRoZSBxdWV1ZSBpbnRhY3Q7IHRoZSBuZXh0IGludGVydmFsIHJldHJpZXMuIE5vbmNlcyBtYWtlXG4gICAgICAgICAgICAvLyBzZXJ2ZXItc2lkZSBkdXBsaWNhdGVzIGltcG9zc2libGUuXG4gICAgICAgICAgICBkbG9nKFwibWV0cmljc1wiLCBcImZsdXNoIGZhaWxlZDsgd2lsbCByZXRyeVwiLCB7XG4gICAgICAgICAgICAgIGU6IFN0cmluZyhlKSxcbiAgICAgICAgICAgICAgcXVldWVkOiB0aGlzLnF1ZXVlLmxlbmd0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLnBlbmRpbmcgPSBudWxsO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHRoaXMucGVuZGluZztcbiAgfVxufVxuIiwgImltcG9ydCB7IHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHtcbiAgUG9ydGZvbGlvUmVzcG9uc2UsXG4gIFNwb25zb3IsXG4gIFN1cmZhY2UsXG59IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IHJvdXRlcyB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB0eXBlIHsgQXV0aFNlcnZpY2UgfSBmcm9tIFwiLi9hdXRoXCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi9jb25maWdcIjtcbmltcG9ydCB7IGZldGNoSnNvbiB9IGZyb20gXCIuL2h0dHBcIjtcbmltcG9ydCB7IGRsb2cgfSBmcm9tIFwiLi9sb2dcIjtcblxuLyoqIE9uLWRpc2sgY2FjaGUgY29uc3VtZWQgYnkgdGhlIENMSSBzdXJmYWNlcyAoc3RhdHVzbGluZSBzY3JpcHQsIHdyYXBwZXJzKS5cbiAqICBUb2tlbnMgbmV2ZXIgYXBwZWFyIGhlcmUgXHUyMDE0IG9ubHkgZGlzcGxheWFibGUgc3BvbnNvciBkYXRhLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTcG9uc29yQ2FjaGVGaWxlIHtcbiAgdXBkYXRlZEF0TXM6IG51bWJlcjtcbiAgdHRsTXM6IG51bWJlcjtcbiAgcm90YXRpb25JbnRlcnZhbE1zOiBudW1iZXI7XG4gIHZpZXdUaHJlc2hvbGRNczogbnVtYmVyO1xuICBzcG9uc29yczogU3BvbnNvcltdO1xufVxuXG5leHBvcnQgY29uc3QgU1BPTlNPUl9DQUNIRV9GSUxFID0gXCJzcG9uc29ycy5qc29uXCI7XG5cbi8qKlxuICogRmV0Y2hlcyBhbmQgY2FjaGVzIHRoZSBzcG9uc29yIHBvcnRmb2xpby4gT25lIHNlcnZpY2UgaW5zdGFuY2Ugc2VydmVzIGV2ZXJ5XG4gKiBzdXJmYWNlOiB3ZWJ2aWV3cyBwdWxsIGZyb20gbWVtb3J5IHZpYSB0aGUgbG9vcGJhY2ssIENMSSBzY3JpcHRzIHJlYWQgdGhlXG4gKiBKU09OIGNhY2hlIHRoaXMgd3JpdGVzIGFmdGVyIGVhY2ggcmVmcmVzaC5cbiAqL1xuZXhwb3J0IGNsYXNzIFBvcnRmb2xpb1NlcnZpY2Uge1xuICBwcml2YXRlIGN1cnJlbnQ6IFBvcnRmb2xpb1Jlc3BvbnNlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZmV0Y2hlZEF0TXMgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYXV0aDogQXV0aFNlcnZpY2UsXG4gICAgcHJpdmF0ZSByZWFkb25seSBiYXNlOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjbGllbnRJZDogc3RyaW5nLFxuICApIHt9XG5cbiAgZ2V0IHBvcnRmb2xpbygpOiBQb3J0Zm9saW9SZXNwb25zZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnQ7XG4gIH1cblxuICBnZXQgc3RhbGUoKTogYm9vbGVhbiB7XG4gICAgaWYgKCF0aGlzLmN1cnJlbnQpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBEYXRlLm5vdygpIC0gdGhpcy5mZXRjaGVkQXRNcyA+IHRoaXMuY3VycmVudC50dGxNcztcbiAgfVxuXG4gIC8qKiBUaGUgc3BvbnNvciBmb3IgXCJub3dcIjogdGltZS1zbG90IHJvdGF0aW9uIHRocm91Z2ggdGhlIHF1ZXVlIHNvIGV2ZXJ5XG4gICAqICBzdXJmYWNlIHNob3dzIHRoZSBzYW1lIGxpbmUgYXQgdGhlIHNhbWUgbW9tZW50IHdpdGhvdXQgY29vcmRpbmF0aW9uLiAqL1xuICBjdXJyZW50U3BvbnNvcigpOiBTcG9uc29yIHwgbnVsbCB7XG4gICAgY29uc3QgcCA9IHRoaXMuY3VycmVudDtcbiAgICBpZiAoIXAgfHwgcC5zcG9uc29ycy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHNsb3QgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyBNYXRoLm1heChwLnJvdGF0aW9uSW50ZXJ2YWxNcywgNTAwMCkpO1xuICAgIHJldHVybiBwLnNwb25zb3JzW3Nsb3QgJSBwLnNwb25zb3JzLmxlbmd0aF07XG4gIH1cblxuICBhc3luYyByZWZyZXNoKHN1cmZhY2U6IFN1cmZhY2UgPSBcImNjX3dlYnZpZXdcIik6IFByb21pc2U8UG9ydGZvbGlvUmVzcG9uc2UgfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHAgPSBhd2FpdCB0aGlzLmF1dGgud2l0aEF1dGgoKGJlYXJlcikgPT5cbiAgICAgICAgZmV0Y2hKc29uPFBvcnRmb2xpb1Jlc3BvbnNlPihcbiAgICAgICAgICB0aGlzLmJhc2UgKyByb3V0ZXMucG9ydGZvbGlvKHN1cmZhY2UsIHRoaXMuY2xpZW50SWQpLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IGJlYXJlciA/IHsgYXV0aG9yaXphdGlvbjogYEJlYXJlciAke2JlYXJlcn1gIH0gOiB7fSxcbiAgICAgICAgICB9LFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIHRoaXMuY3VycmVudCA9IHA7XG4gICAgICB0aGlzLmZldGNoZWRBdE1zID0gRGF0ZS5ub3coKTtcbiAgICAgIHRoaXMud3JpdGVDbGlDYWNoZShwKTtcbiAgICAgIGRsb2coXCJwb3J0Zm9saW9cIiwgXCJyZWZyZXNoZWRcIiwge1xuICAgICAgICBuOiBwLnNwb25zb3JzLmxlbmd0aCxcbiAgICAgICAgc2lnbmVkSW46IHRoaXMuYXV0aC5zaWduZWRJbixcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGxvZyhcInBvcnRmb2xpb1wiLCBcInJlZnJlc2ggZmFpbGVkXCIsIHsgZTogU3RyaW5nKGUpIH0pO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqIE1pcnJvciB0aGUgbGF0ZXN0IHBvcnRmb2xpbyBmb3Igb3V0LW9mLXByb2Nlc3MgQ0xJIHN1cmZhY2VzLiAqL1xuICBwcml2YXRlIHdyaXRlQ2xpQ2FjaGUocDogUG9ydGZvbGlvUmVzcG9uc2UpOiB2b2lkIHtcbiAgICBjb25zdCBmaWxlOiBTcG9uc29yQ2FjaGVGaWxlID0ge1xuICAgICAgdXBkYXRlZEF0TXM6IERhdGUubm93KCksXG4gICAgICB0dGxNczogcC50dGxNcyxcbiAgICAgIHJvdGF0aW9uSW50ZXJ2YWxNczogcC5yb3RhdGlvbkludGVydmFsTXMsXG4gICAgICB2aWV3VGhyZXNob2xkTXM6IHAudmlld1RocmVzaG9sZE1zLFxuICAgICAgc3BvbnNvcnM6IHAuc3BvbnNvcnMsXG4gICAgfTtcbiAgICB0cnkge1xuICAgICAgd3JpdGVGaWxlU3luYyhcbiAgICAgICAgam9pbihtZWFud2hpbGVEaXIoKSwgU1BPTlNPUl9DQUNIRV9GSUxFKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZmlsZSwgbnVsbCwgMikgKyBcIlxcblwiLFxuICAgICAgICB7IG1vZGU6IDBvNjAwIH0sXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRsb2coXCJwb3J0Zm9saW9cIiwgXCJjbGkgY2FjaGUgd3JpdGUgZmFpbGVkXCIsIHsgZTogU3RyaW5nKGUpIH0pO1xuICAgIH1cbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBQ0EsSUFBQUEsNkJBQTZCO0FBQzdCLElBQUFDLGtCQUF5QztBQUN6QyxJQUFBQyxrQkFBd0I7QUFDeEIsSUFBQUMsb0JBQXFCOzs7QUNFZCxJQUFNLGFBQXVCLENBQUM7QUFFOUIsSUFBTSxNQUFNO0FBQUEsRUFDakIsU0FBUztBQUFBLEVBQ1QsY0FBYyxPQUFPLFFBQWdDO0FBQ25ELGVBQVcsS0FBSyxJQUFJLFNBQVMsQ0FBQztBQUM5QixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRU8sSUFBTSxNQUFNO0FBQUEsRUFDakIsT0FBTyxDQUFDLE9BQWUsRUFBRSxVQUFVLE1BQU0sRUFBRTtBQUM3QztBQUVPLElBQU0sYUFBYTtBQUFBLEVBQ3hCLGNBQWMsQ0FBQyxTQUFpQixFQUFFLGFBQWEsRUFBRSxTQUFTLGFBQWEsRUFBRTtBQUMzRTtBQUdPLElBQU0sZ0JBQU4sTUFBb0I7QUFBQSxF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LFVBQU0sOEJBQWEsVUFBVSxNQUFNLENBQUM7QUFDMUQsUUFBTSxvQ0FBb0MsS0FBSyxVQUFVLFFBQVEsTUFBTSxLQUFLLFVBQVUsUUFBUSxHQUFHLFFBQVE7QUFDekcsUUFBTSw2QkFBNkIsS0FBQyxnQ0FBVyx3QkFBSyxJQUFJLGdCQUFnQixDQUFDLENBQUM7QUFHMUUsTUFBSSxVQUFVO0FBQ2QsTUFBSTtBQUNGLGtCQUFVLHlDQUFhLFVBQVUsQ0FBQyxXQUFXLEdBQUcsRUFBRSxVQUFVLFFBQVEsU0FBUyxJQUFNLENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDN0YsUUFBUTtBQUFBLEVBRVI7QUFDQSxRQUFNLGdDQUFnQyxRQUFRLFNBQVMsR0FBRyxPQUFPO0FBRWpFLFVBQVEsUUFBUTtBQUNoQixVQUFRLElBQUksYUFBYSxJQUFJLGVBQWU7QUFBQSxFQUFLLFFBQVEsV0FBVztBQUNwRSxVQUFRLEtBQUssYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyQztBQUVBLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtBQUNsQixVQUFRLE1BQU0scUJBQXFCLENBQUM7QUFDcEMsVUFBUSxLQUFLLENBQUM7QUFDaEIsQ0FBQzsiLAogICJuYW1lcyI6IFsiaW1wb3J0X25vZGVfY2hpbGRfcHJvY2VzcyIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9vcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX29zIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfb3MiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCJdCn0K
