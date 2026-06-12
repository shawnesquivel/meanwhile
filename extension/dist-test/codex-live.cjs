"use strict";

// test/codex-live.ts
var import_node_child_process2 = require("node:child_process");
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

// src/adapters/codex-cli.ts
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

// src/adapters/rc-edit.ts
var RC_BEGIN = "# >>> meanwhile >>>";
var RC_END = "# <<< meanwhile <<<";
function rcBlock(binDir2) {
  return [
    RC_BEGIN,
    "# Adds the Meanwhile sponsor shim for the codex CLI. Managed by the",
    '# Meanwhile extension \u2014 run "Meanwhile: Restore" to remove.',
    `export PATH="${binDir2}:$PATH"`,
    RC_END
  ].join("\n");
}
function hasRcBlock(src) {
  return src.includes(RC_BEGIN) && src.includes(RC_END);
}
function addRcBlock(src, binDir2) {
  const without = removeRcBlock(src);
  const sep = without.length === 0 || without.endsWith("\n") ? "" : "\n";
  return `${without}${sep}
${rcBlock(binDir2)}
`;
}
function removeRcBlock(src) {
  if (!hasRcBlock(src)) return src;
  const start = src.indexOf(RC_BEGIN);
  const end = src.indexOf(RC_END);
  if (start === -1 || end === -1 || end < start) return src;
  let head = src.slice(0, start);
  let tail = src.slice(end + RC_END.length);
  head = head.replace(/\n\n$/, "\n");
  tail = tail.replace(/^\n/, "");
  return head + tail;
}

// src/adapters/codex-cli.ts
var STATE_FILE = "codex-cli-state.json";
function binDir() {
  return (0, import_node_path3.join)(meanwhileDir(), "bin");
}
function statePath() {
  return (0, import_node_path3.join)(meanwhileDir(), STATE_FILE);
}
function findRealCodex() {
  const ours = binDir();
  for (const d of (process.env.PATH || "").split(import_node_path3.delimiter)) {
    if (!d || d === ours) continue;
    const p = (0, import_node_path3.join)(d, "codex");
    try {
      if ((0, import_node_fs3.existsSync)(p)) return p;
    } catch {
    }
  }
  return null;
}
function codexVersion(bin) {
  return new Promise((resolve) => {
    (0, import_node_child_process.execFile)(
      bin,
      ["--version"],
      { timeout: 8e3 },
      (err, stdout) => resolve(err ? null : String(stdout).trim() || null)
    );
  });
}
function rcFiles() {
  const h = (0, import_node_os2.homedir)();
  const files = [(0, import_node_path3.join)(h, ".zshrc")];
  for (const f of [(0, import_node_path3.join)(h, ".bashrc"), (0, import_node_path3.join)(h, ".bash_profile")]) {
    if ((0, import_node_fs3.existsSync)(f)) files.push(f);
  }
  return files;
}
var CodexCliAdapter = class {
  constructor() {
    this.id = "codex_cli";
  }
  async detect() {
    const real = findRealCodex();
    return {
      realCodexPath: real,
      version: real ? await codexVersion(real) : null,
      rcFiles: rcFiles()
    };
  }
  isPatched() {
    return (0, import_node_fs3.existsSync)(statePath());
  }
  /** Install the shim + banner and inject PATH. Idempotent. */
  async patch(opts) {
    const det = await this.detect();
    if (!det.realCodexPath) {
      dlog("codex", "no codex on PATH \u2014 skipping");
      return { ok: false, detail: "codex not installed" };
    }
    (0, import_node_fs3.mkdirSync)(binDir(), { recursive: true });
    const shimSrc = (0, import_node_path3.join)(opts.extensionDistDir, "adapters", "codex-shim.asset.sh");
    const bannerSrc = (0, import_node_path3.join)(
      opts.extensionDistDir,
      "adapters",
      "codex-banner.asset.mjs"
    );
    const shim = (0, import_node_path3.join)(binDir(), "codex");
    const banner = (0, import_node_path3.join)(meanwhileDir(), "codex-banner.mjs");
    (0, import_node_fs3.copyFileSync)(shimSrc, shim);
    (0, import_node_fs3.chmodSync)(shim, 493);
    (0, import_node_fs3.copyFileSync)(bannerSrc, banner);
    (0, import_node_fs3.chmodSync)(banner, 420);
    const edited = [];
    for (const rc of rcFiles()) {
      try {
        const src = (0, import_node_fs3.existsSync)(rc) ? (0, import_node_fs3.readFileSync)(rc, "utf8") : "";
        const next = addRcBlock(src, binDir());
        if (next !== src) (0, import_node_fs3.writeFileSync)(rc, next);
        edited.push(rc);
      } catch (e) {
        dlog("codex", "rc edit failed", { rc, e: String(e) });
      }
    }
    if (edited.length === 0) return { ok: false, detail: "no rc file editable" };
    const state = { rcFilesEdited: edited, appliedAtMs: Date.now() };
    (0, import_node_fs3.writeFileSync)(statePath(), JSON.stringify(state, null, 2) + "\n");
    dlog("codex", "patched", { edited });
    return { ok: true };
  }
  /** Remove the shim and strip the PATH block from every rc we edited. */
  restore() {
    let state = null;
    try {
      state = JSON.parse((0, import_node_fs3.readFileSync)(statePath(), "utf8"));
    } catch {
    }
    if (!state) return { ok: true, detail: "nothing to restore" };
    try {
      for (const rc of state.rcFilesEdited) {
        try {
          if (!(0, import_node_fs3.existsSync)(rc)) continue;
          const src = (0, import_node_fs3.readFileSync)(rc, "utf8");
          const next = removeRcBlock(src);
          if (next !== src) (0, import_node_fs3.writeFileSync)(rc, next);
        } catch (e) {
          dlog("codex", "rc restore failed", { rc, e: String(e) });
        }
      }
      (0, import_node_fs3.rmSync)(binDir(), { recursive: true, force: true });
      (0, import_node_fs3.rmSync)((0, import_node_path3.join)(meanwhileDir(), "codex-banner.mjs"), { force: true });
      (0, import_node_fs3.rmSync)(statePath(), { force: true });
      dlog("codex", "restored");
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: String(e) };
    }
  }
};

// ../shared/contract.ts
var API_VERSION = "v1";
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

// src/portfolio.ts
var import_node_fs5 = require("node:fs");
var import_node_path5 = require("node:path");
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
      (0, import_node_fs5.writeFileSync)(
        (0, import_node_path5.join)(meanwhileDir(), SPONSOR_CACHE_FILE),
        JSON.stringify(file, null, 2) + "\n",
        { mode: 384 }
      );
    } catch (e) {
      dlog("portfolio", "cli cache write failed", { e: String(e) });
    }
  }
};

// test/codex-live.ts
var BASE = (process.env.MEANWHILE_BASE || "http://127.0.0.1:3100").replace(/\/+$/, "");
var MW = (0, import_node_path6.join)((0, import_node_os3.homedir)(), ".meanwhile");
var ZSHRC = (0, import_node_path6.join)((0, import_node_os3.homedir)(), ".zshrc");
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
  await portfolio.refresh("codex_cli");
  const zshrcBefore = (0, import_node_fs6.existsSync)(ZSHRC) ? (0, import_node_fs6.readFileSync)(ZSHRC, "utf8") : "";
  (0, import_node_fs6.rmSync)((0, import_node_path6.join)(MW, "cli-events.jsonl"), { force: true });
  const adapter = new CodexCliAdapter();
  const det = await adapter.detect();
  console.log("  detect:", JSON.stringify(det));
  check("codex found", det.realCodexPath !== null, det);
  const realVersion = det.version ?? "";
  const res = await adapter.patch({ extensionDistDir: (0, import_node_path6.join)(process.cwd(), "dist") });
  check("patch ok", res.ok, res);
  check("shim installed", (0, import_node_fs6.existsSync)((0, import_node_path6.join)(MW, "bin", "codex")));
  check("banner installed", (0, import_node_fs6.existsSync)((0, import_node_path6.join)(MW, "codex-banner.mjs")));
  check("zshrc has block", hasRcBlock((0, import_node_fs6.readFileSync)(ZSHRC, "utf8")));
  const shimPath = `${(0, import_node_path6.join)(MW, "bin")}:${process.env.PATH}`;
  const piped = (0, import_node_child_process2.execFileSync)((0, import_node_path6.join)(MW, "bin", "codex"), ["--version"], {
    encoding: "utf8",
    timeout: 2e4,
    env: { ...process.env, PATH: shimPath }
  });
  check("piped run returns real version", piped.trim() === realVersion, { piped, realVersion });
  check("piped run has no banner", !piped.includes("sponsor"), piped);
  let tty = "";
  try {
    tty = (0, import_node_child_process2.execSync)(
      `expect -c 'spawn -noecho "${(0, import_node_path6.join)(MW, "bin", "codex")}" --version' -c 'expect eof'`,
      { encoding: "utf8", timeout: 2e4, env: { ...process.env, PATH: shimPath } }
    );
  } catch (e) {
    check("tty run executed", false, String(e));
  }
  check("tty run shows banner", tty.includes("sponsor"), JSON.stringify(tty.slice(0, 120)));
  check("tty run shows OSC-8 link", tty.includes("\x1B]8;;https://"));
  check("tty run still prints version", tty.includes(realVersion), tty);
  const ev = (0, import_node_fs6.existsSync)((0, import_node_path6.join)(MW, "cli-events.jsonl")) ? (0, import_node_fs6.readFileSync)((0, import_node_path6.join)(MW, "cli-events.jsonl"), "utf8").trim().split("\n") : [];
  check("one codex impression logged", ev.length === 1, ev);
  if (ev.length === 1) {
    const j = JSON.parse(ev[0]);
    check("event surface is codex_cli", j.surface === "codex_cli", j);
  }
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  check("shim removed", !(0, import_node_fs6.existsSync)((0, import_node_path6.join)(MW, "bin")));
  const zshrcAfter = (0, import_node_fs6.readFileSync)(ZSHRC, "utf8");
  check("zshrc block removed", !hasRcBlock(zshrcAfter));
  check("zshrc byte-identical to before", zshrcAfter === zshrcBefore);
  const direct = (0, import_node_child_process2.execFileSync)("codex", ["--version"], { encoding: "utf8", timeout: 2e4 }).trim();
  check("codex direct still healthy", direct === realVersion, direct);
  (0, import_node_fs6.rmSync)((0, import_node_path6.join)(MW, "cli-events.jsonl"), { force: true });
  console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("codex-live crashed:", e);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vdGVzdC9jb2RleC1saXZlLnRzIiwgIi4uL3Rlc3QvdnNjb2RlLXN0dWIudHMiLCAiLi4vc3JjL2FkYXB0ZXJzL2NvZGV4LWNsaS50cyIsICIuLi9zcmMvY29uZmlnLnRzIiwgIi4uL3NyYy9sb2cudHMiLCAiLi4vc3JjL2FkYXB0ZXJzL3JjLWVkaXQudHMiLCAiLi4vLi4vc2hhcmVkL2NvbnRyYWN0LnRzIiwgIi4uL3NyYy9odHRwLnRzIiwgIi4uL3NyYy9hdXRoLnRzIiwgIi4uL3NyYy9pZHMudHMiLCAiLi4vc3JjL3BvcnRmb2xpby50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuaW1wb3J0IHsgZXhlY0ZpbGVTeW5jLCBleGVjU3luYyB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYywgcm1TeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IE1lbW9yeVNlY3JldHMgfSBmcm9tIFwiLi92c2NvZGUtc3R1YlwiO1xuaW1wb3J0IHsgQ29kZXhDbGlBZGFwdGVyIH0gZnJvbSBcIi4uL3NyYy9hZGFwdGVycy9jb2RleC1jbGlcIjtcbmltcG9ydCB7IGhhc1JjQmxvY2sgfSBmcm9tIFwiLi4vc3JjL2FkYXB0ZXJzL3JjLWVkaXRcIjtcbmltcG9ydCB7IEF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4uL3NyYy9hdXRoXCI7XG5pbXBvcnQgeyBkZXZpY2VJZCB9IGZyb20gXCIuLi9zcmMvaWRzXCI7XG5pbXBvcnQgeyBzZXREZWJ1ZyB9IGZyb20gXCIuLi9zcmMvbG9nXCI7XG5pbXBvcnQgeyBQb3J0Zm9saW9TZXJ2aWNlIH0gZnJvbSBcIi4uL3NyYy9wb3J0Zm9saW9cIjtcblxuLyoqXG4gKiBMSVZFIE0xZCB0ZXN0OiBpbnN0YWxscyB0aGUgY29kZXggc2hpbSArIFBBVEggYmxvY2sgb24gdGhpcyBtYWNoaW5lLFxuICogcHJvdmVzIHRoZSBzaGltIGNoYWluIChiYW5uZXIgb24gVFRZLCBzaWxlbmNlIHdoZW4gcGlwZWQsIGNvcnJlY3QgZXhlYyBvZlxuICogdGhlIHJlYWwgYmluYXJ5KSwgdGhlbiByZXN0b3JlcyBldmVyeXRoaW5nLlxuICovXG5cbmNvbnN0IEJBU0UgPSAocHJvY2Vzcy5lbnYuTUVBTldISUxFX0JBU0UgfHwgXCJodHRwOi8vMTI3LjAuMC4xOjMxMDBcIikucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcbmNvbnN0IE1XID0gam9pbihob21lZGlyKCksIFwiLm1lYW53aGlsZVwiKTtcbmNvbnN0IFpTSFJDID0gam9pbihob21lZGlyKCksIFwiLnpzaHJjXCIpO1xuXG5sZXQgZmFpbHVyZXMgPSAwO1xuY29uc3QgY2hlY2sgPSAobmFtZTogc3RyaW5nLCBvazogYm9vbGVhbiwgZGV0YWlsPzogdW5rbm93bikgPT4ge1xuICBjb25zb2xlLmxvZyhgJHtvayA/IFwiUEFTU1wiIDogXCJGQUlMXCJ9ICAke25hbWV9JHtvayA/IFwiXCIgOiBcIiBcdTIwMTQgXCIgKyBKU09OLnN0cmluZ2lmeShkZXRhaWwpfWApO1xuICBpZiAoIW9rKSBmYWlsdXJlcysrO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgc2V0RGVidWcodHJ1ZSk7XG4gIGNvbnN0IGNsaWVudElkID0gZGV2aWNlSWQoKTtcbiAgY29uc3QgYXV0aCA9IG5ldyBBdXRoU2VydmljZShuZXcgTWVtb3J5U2VjcmV0cygpIGFzIG5ldmVyLCBCQVNFLCBjbGllbnRJZCk7XG4gIGNvbnN0IHBvcnRmb2xpbyA9IG5ldyBQb3J0Zm9saW9TZXJ2aWNlKGF1dGgsIEJBU0UsIGNsaWVudElkKTtcbiAgYXdhaXQgcG9ydGZvbGlvLnJlZnJlc2goXCJjb2RleF9jbGlcIik7XG5cbiAgY29uc3QgenNocmNCZWZvcmUgPSBleGlzdHNTeW5jKFpTSFJDKSA/IHJlYWRGaWxlU3luYyhaU0hSQywgXCJ1dGY4XCIpIDogXCJcIjtcbiAgcm1TeW5jKGpvaW4oTVcsIFwiY2xpLWV2ZW50cy5qc29ubFwiKSwgeyBmb3JjZTogdHJ1ZSB9KTtcblxuICAvLyAxKSBkZXRlY3QgKyBwYXRjaFxuICBjb25zdCBhZGFwdGVyID0gbmV3IENvZGV4Q2xpQWRhcHRlcigpO1xuICBjb25zdCBkZXQgPSBhd2FpdCBhZGFwdGVyLmRldGVjdCgpO1xuICBjb25zb2xlLmxvZyhcIiAgZGV0ZWN0OlwiLCBKU09OLnN0cmluZ2lmeShkZXQpKTtcbiAgY2hlY2soXCJjb2RleCBmb3VuZFwiLCBkZXQucmVhbENvZGV4UGF0aCAhPT0gbnVsbCwgZGV0KTtcbiAgY29uc3QgcmVhbFZlcnNpb24gPSBkZXQudmVyc2lvbiA/PyBcIlwiO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGFkYXB0ZXIucGF0Y2goeyBleHRlbnNpb25EaXN0RGlyOiBqb2luKHByb2Nlc3MuY3dkKCksIFwiZGlzdFwiKSB9KTtcbiAgY2hlY2soXCJwYXRjaCBva1wiLCByZXMub2ssIHJlcyk7XG4gIGNoZWNrKFwic2hpbSBpbnN0YWxsZWRcIiwgZXhpc3RzU3luYyhqb2luKE1XLCBcImJpblwiLCBcImNvZGV4XCIpKSk7XG4gIGNoZWNrKFwiYmFubmVyIGluc3RhbGxlZFwiLCBleGlzdHNTeW5jKGpvaW4oTVcsIFwiY29kZXgtYmFubmVyLm1qc1wiKSkpO1xuICBjaGVjayhcInpzaHJjIGhhcyBibG9ja1wiLCBoYXNSY0Jsb2NrKHJlYWRGaWxlU3luYyhaU0hSQywgXCJ1dGY4XCIpKSk7XG5cbiAgLy8gMikgc2hpbSBjaGFpbjogcGlwZWQgKG5vbi1UVFkpIFx1MjE5MiB2ZXJzaW9uIG9ubHksIG5vIGJhbm5lclxuICBjb25zdCBzaGltUGF0aCA9IGAke2pvaW4oTVcsIFwiYmluXCIpfToke3Byb2Nlc3MuZW52LlBBVEh9YDtcbiAgY29uc3QgcGlwZWQgPSBleGVjRmlsZVN5bmMoam9pbihNVywgXCJiaW5cIiwgXCJjb2RleFwiKSwgW1wiLS12ZXJzaW9uXCJdLCB7XG4gICAgZW5jb2Rpbmc6IFwidXRmOFwiLFxuICAgIHRpbWVvdXQ6IDIwMDAwLFxuICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgUEFUSDogc2hpbVBhdGggfSxcbiAgfSk7XG4gIGNoZWNrKFwicGlwZWQgcnVuIHJldHVybnMgcmVhbCB2ZXJzaW9uXCIsIHBpcGVkLnRyaW0oKSA9PT0gcmVhbFZlcnNpb24sIHsgcGlwZWQsIHJlYWxWZXJzaW9uIH0pO1xuICBjaGVjayhcInBpcGVkIHJ1biBoYXMgbm8gYmFubmVyXCIsICFwaXBlZC5pbmNsdWRlcyhcInNwb25zb3JcIiksIHBpcGVkKTtcblxuICAvLyAzKSBUVFkgcnVuIHZpYSBgZXhwZWN0YCAoYWxsb2NhdGVzIGEgcmVhbCBwdHkpIFx1MjE5MiBiYW5uZXIgKyB2ZXJzaW9uXG4gIGxldCB0dHkgPSBcIlwiO1xuICB0cnkge1xuICAgIHR0eSA9IGV4ZWNTeW5jKFxuICAgICAgYGV4cGVjdCAtYyAnc3Bhd24gLW5vZWNobyBcIiR7am9pbihNVywgXCJiaW5cIiwgXCJjb2RleFwiKX1cIiAtLXZlcnNpb24nIC1jICdleHBlY3QgZW9mJ2AsXG4gICAgICB7IGVuY29kaW5nOiBcInV0ZjhcIiwgdGltZW91dDogMjAwMDAsIGVudjogeyAuLi5wcm9jZXNzLmVudiwgUEFUSDogc2hpbVBhdGggfSB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjaGVjayhcInR0eSBydW4gZXhlY3V0ZWRcIiwgZmFsc2UsIFN0cmluZyhlKSk7XG4gIH1cbiAgY2hlY2soXCJ0dHkgcnVuIHNob3dzIGJhbm5lclwiLCB0dHkuaW5jbHVkZXMoXCJzcG9uc29yXCIpLCBKU09OLnN0cmluZ2lmeSh0dHkuc2xpY2UoMCwgMTIwKSkpO1xuICBjaGVjayhcInR0eSBydW4gc2hvd3MgT1NDLTggbGlua1wiLCB0dHkuaW5jbHVkZXMoXCJcXHUwMDFiXTg7O2h0dHBzOi8vXCIpKTtcbiAgY2hlY2soXCJ0dHkgcnVuIHN0aWxsIHByaW50cyB2ZXJzaW9uXCIsIHR0eS5pbmNsdWRlcyhyZWFsVmVyc2lvbiksIHR0eSk7XG5cbiAgLy8gNCkgaW1wcmVzc2lvbiBldmVudCBsb2dnZWQgZXhhY3RseSBvbmNlIChUVFkgcnVuIG9ubHkpXG4gIGNvbnN0IGV2ID0gZXhpc3RzU3luYyhqb2luKE1XLCBcImNsaS1ldmVudHMuanNvbmxcIikpXG4gICAgPyByZWFkRmlsZVN5bmMoam9pbihNVywgXCJjbGktZXZlbnRzLmpzb25sXCIpLCBcInV0ZjhcIikudHJpbSgpLnNwbGl0KFwiXFxuXCIpXG4gICAgOiBbXTtcbiAgY2hlY2soXCJvbmUgY29kZXggaW1wcmVzc2lvbiBsb2dnZWRcIiwgZXYubGVuZ3RoID09PSAxLCBldik7XG4gIGlmIChldi5sZW5ndGggPT09IDEpIHtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShldlswXSk7XG4gICAgY2hlY2soXCJldmVudCBzdXJmYWNlIGlzIGNvZGV4X2NsaVwiLCBqLnN1cmZhY2UgPT09IFwiY29kZXhfY2xpXCIsIGopO1xuICB9XG5cbiAgLy8gNSkgcmVzdG9yZVxuICBjb25zdCByID0gYWRhcHRlci5yZXN0b3JlKCk7XG4gIGNoZWNrKFwicmVzdG9yZSBva1wiLCByLm9rLCByKTtcbiAgY2hlY2soXCJzaGltIHJlbW92ZWRcIiwgIWV4aXN0c1N5bmMoam9pbihNVywgXCJiaW5cIikpKTtcbiAgY29uc3QgenNocmNBZnRlciA9IHJlYWRGaWxlU3luYyhaU0hSQywgXCJ1dGY4XCIpO1xuICBjaGVjayhcInpzaHJjIGJsb2NrIHJlbW92ZWRcIiwgIWhhc1JjQmxvY2soenNocmNBZnRlcikpO1xuICBjaGVjayhcInpzaHJjIGJ5dGUtaWRlbnRpY2FsIHRvIGJlZm9yZVwiLCB6c2hyY0FmdGVyID09PSB6c2hyY0JlZm9yZSk7XG4gIGNvbnN0IGRpcmVjdCA9IGV4ZWNGaWxlU3luYyhcImNvZGV4XCIsIFtcIi0tdmVyc2lvblwiXSwgeyBlbmNvZGluZzogXCJ1dGY4XCIsIHRpbWVvdXQ6IDIwMDAwIH0pLnRyaW0oKTtcbiAgY2hlY2soXCJjb2RleCBkaXJlY3Qgc3RpbGwgaGVhbHRoeVwiLCBkaXJlY3QgPT09IHJlYWxWZXJzaW9uLCBkaXJlY3QpO1xuXG4gIHJtU3luYyhqb2luKE1XLCBcImNsaS1ldmVudHMuanNvbmxcIiksIHsgZm9yY2U6IHRydWUgfSk7XG4gIGNvbnNvbGUubG9nKGZhaWx1cmVzID09PSAwID8gXCJcXG5BTEwgUEFTU1wiIDogYFxcbiR7ZmFpbHVyZXN9IEZBSUxVUkVTYCk7XG4gIHByb2Nlc3MuZXhpdChmYWlsdXJlcyA9PT0gMCA/IDAgOiAxKTtcbn1cblxubWFpbigpLmNhdGNoKChlKSA9PiB7XG4gIGNvbnNvbGUuZXJyb3IoXCJjb2RleC1saXZlIGNyYXNoZWQ6XCIsIGUpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59KTtcbiIsICIvKipcbiAqIE1pbmltYWwgYHZzY29kZWAgbW9kdWxlIHN0dWIgc28gdGhlIHNlcnZpY2UgbGF5ZXIgKGF1dGgvcG9ydGZvbGlvL21ldHJpY3MvXG4gKiBsb29wYmFjaykgY2FuIHJ1biBoZWFkbGVzcyBpbiBwbGFpbiBOb2RlIGZvciBpbnRlZ3JhdGlvbiB0ZXN0cy4gT25seSB0aGVcbiAqIEFQSXMgdGhvc2UgbW9kdWxlcyBhY3R1YWxseSB0b3VjaCBhcmUgaW1wbGVtZW50ZWQuXG4gKi9cblxuZXhwb3J0IGNvbnN0IG9wZW5lZFVybHM6IHN0cmluZ1tdID0gW107XG5cbmV4cG9ydCBjb25zdCBlbnYgPSB7XG4gIGFwcE5hbWU6IFwiaGFybmVzc1wiLFxuICBvcGVuRXh0ZXJuYWw6IGFzeW5jICh1cmk6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0pID0+IHtcbiAgICBvcGVuZWRVcmxzLnB1c2godXJpLnRvU3RyaW5nKCkpO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IFVyaSA9IHtcbiAgcGFyc2U6IChzOiBzdHJpbmcpID0+ICh7IHRvU3RyaW5nOiAoKSA9PiBzIH0pLFxufTtcblxuZXhwb3J0IGNvbnN0IGV4dGVuc2lvbnMgPSB7XG4gIGdldEV4dGVuc2lvbjogKF9pZDogc3RyaW5nKSA9PiAoeyBwYWNrYWdlSlNPTjogeyB2ZXJzaW9uOiBcIjAuMC4wLXRlc3RcIiB9IH0pLFxufTtcblxuLyoqIEluLW1lbW9yeSBTZWNyZXRTdG9yYWdlIGxvb2thbGlrZS4gKi9cbmV4cG9ydCBjbGFzcyBNZW1vcnlTZWNyZXRzIHtcbiAgcHJpdmF0ZSBtID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgYXN5bmMgZ2V0KGs6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIHRoaXMubS5nZXQoayk7XG4gIH1cbiAgYXN5bmMgc3RvcmUoazogc3RyaW5nLCB2OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLm0uc2V0KGssIHYpO1xuICB9XG4gIGFzeW5jIGRlbGV0ZShrOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLm0uZGVsZXRlKGspO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB3b3Jrc3BhY2UgPSB7XG4gIGdldENvbmZpZ3VyYXRpb246ICgpID0+ICh7IGdldDogKF9rOiBzdHJpbmcpID0+IHVuZGVmaW5lZCB9KSxcbn07XG5cbmV4cG9ydCBjb25zdCB3aW5kb3cgPSB7XG4gIHNob3dJbmZvcm1hdGlvbk1lc3NhZ2U6ICguLi5fYTogdW5rbm93bltdKSA9PiB1bmRlZmluZWQsXG4gIHNob3dXYXJuaW5nTWVzc2FnZTogKC4uLl9hOiB1bmtub3duW10pID0+IHVuZGVmaW5lZCxcbn07XG4iLCAiaW1wb3J0IHsgZXhlY0ZpbGUgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQge1xuICBjaG1vZFN5bmMsXG4gIGNvcHlGaWxlU3luYyxcbiAgZXhpc3RzU3luYyxcbiAgbWtkaXJTeW5jLFxuICByZWFkRmlsZVN5bmMsXG4gIHJtU3luYyxcbiAgd3JpdGVGaWxlU3luYyxcbn0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgZGVsaW1pdGVyLCBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgbWVhbndoaWxlRGlyIH0gZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuLi9sb2dcIjtcbmltcG9ydCB7IGFkZFJjQmxvY2ssIHJlbW92ZVJjQmxvY2sgfSBmcm9tIFwiLi9yYy1lZGl0XCI7XG5cbi8qKlxuICogQ29kZXggQ0xJIGFkYXB0ZXIuIENvZGV4IHNoaXBzIGFzIGEgcGxhaW4gYmluYXJ5IHdpdGggbm8gc2V0dGluZ3MgaG9vaywgc29cbiAqIHRoZSBzdXJmYWNlIGlzIGEgUEFUSCBzaGltOiB+Ly5tZWFud2hpbGUvYmluL2NvZGV4IHByaW50cyBvbmUgc3BvbnNvciBsaW5lXG4gKiAoaW50ZXJhY3RpdmUgcnVucyBvbmx5KSwgdGhlbiBleGVjJ3MgdGhlIHJlYWwgYmluYXJ5LiBQQVRIIGlzIGluamVjdGVkIHZpYVxuICogYSBtYXJrZXItZGVsaW1pdGVkIGJsb2NrIGluIHRoZSB1c2VyJ3Mgc2hlbGwgcmMgZmlsZXMuXG4gKi9cblxuY29uc3QgU1RBVEVfRklMRSA9IFwiY29kZXgtY2xpLXN0YXRlLmpzb25cIjtcblxuaW50ZXJmYWNlIENvZGV4U3RhdGUge1xuICByY0ZpbGVzRWRpdGVkOiBzdHJpbmdbXTtcbiAgYXBwbGllZEF0TXM6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2RleERldGVjdGlvbiB7XG4gIHJlYWxDb2RleFBhdGg6IHN0cmluZyB8IG51bGw7XG4gIHZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIHJjRmlsZXM6IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiBiaW5EaXIoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGpvaW4obWVhbndoaWxlRGlyKCksIFwiYmluXCIpO1xufVxuXG5mdW5jdGlvbiBzdGF0ZVBhdGgoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGpvaW4obWVhbndoaWxlRGlyKCksIFNUQVRFX0ZJTEUpO1xufVxuXG4vKiogRmlyc3QgY29kZXggb24gUEFUSCB0aGF0IGlzIG5vdCBvdXIgc2hpbS4gKi9cbmZ1bmN0aW9uIGZpbmRSZWFsQ29kZXgoKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IG91cnMgPSBiaW5EaXIoKTtcbiAgZm9yIChjb25zdCBkIG9mIChwcm9jZXNzLmVudi5QQVRIIHx8IFwiXCIpLnNwbGl0KGRlbGltaXRlcikpIHtcbiAgICBpZiAoIWQgfHwgZCA9PT0gb3VycykgY29udGludWU7XG4gICAgY29uc3QgcCA9IGpvaW4oZCwgXCJjb2RleFwiKTtcbiAgICB0cnkge1xuICAgICAgaWYgKGV4aXN0c1N5bmMocCkpIHJldHVybiBwO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogcGVybWlzc2lvbiBpc3N1ZXMgb24gb2RkIFBBVEggZW50cmllcyAqL1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY29kZXhWZXJzaW9uKGJpbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGV4ZWNGaWxlKGJpbiwgW1wiLS12ZXJzaW9uXCJdLCB7IHRpbWVvdXQ6IDgwMDAgfSwgKGVyciwgc3Rkb3V0KSA9PlxuICAgICAgcmVzb2x2ZShlcnIgPyBudWxsIDogU3RyaW5nKHN0ZG91dCkudHJpbSgpIHx8IG51bGwpLFxuICAgICk7XG4gIH0pO1xufVxuXG4vKiogcmMgZmlsZXMgd2UgbWFuYWdlOiB6c2ggYWx3YXlzIChtYWNPUyBkZWZhdWx0KSwgYmFzaCBvbmx5IGlmIHByZXNlbnQuICovXG5mdW5jdGlvbiByY0ZpbGVzKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgaCA9IGhvbWVkaXIoKTtcbiAgY29uc3QgZmlsZXMgPSBbam9pbihoLCBcIi56c2hyY1wiKV07XG4gIGZvciAoY29uc3QgZiBvZiBbam9pbihoLCBcIi5iYXNocmNcIiksIGpvaW4oaCwgXCIuYmFzaF9wcm9maWxlXCIpXSkge1xuICAgIGlmIChleGlzdHNTeW5jKGYpKSBmaWxlcy5wdXNoKGYpO1xuICB9XG4gIHJldHVybiBmaWxlcztcbn1cblxuZXhwb3J0IGNsYXNzIENvZGV4Q2xpQWRhcHRlciB7XG4gIHJlYWRvbmx5IGlkID0gXCJjb2RleF9jbGlcIjtcblxuICBhc3luYyBkZXRlY3QoKTogUHJvbWlzZTxDb2RleERldGVjdGlvbj4ge1xuICAgIGNvbnN0IHJlYWwgPSBmaW5kUmVhbENvZGV4KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYWxDb2RleFBhdGg6IHJlYWwsXG4gICAgICB2ZXJzaW9uOiByZWFsID8gYXdhaXQgY29kZXhWZXJzaW9uKHJlYWwpIDogbnVsbCxcbiAgICAgIHJjRmlsZXM6IHJjRmlsZXMoKSxcbiAgICB9O1xuICB9XG5cbiAgaXNQYXRjaGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBleGlzdHNTeW5jKHN0YXRlUGF0aCgpKTtcbiAgfVxuXG4gIC8qKiBJbnN0YWxsIHRoZSBzaGltICsgYmFubmVyIGFuZCBpbmplY3QgUEFUSC4gSWRlbXBvdGVudC4gKi9cbiAgYXN5bmMgcGF0Y2gob3B0czogeyBleHRlbnNpb25EaXN0RGlyOiBzdHJpbmcgfSk6IFByb21pc2U8e1xuICAgIG9rOiBib29sZWFuO1xuICAgIGRldGFpbD86IHN0cmluZztcbiAgfT4ge1xuICAgIGNvbnN0IGRldCA9IGF3YWl0IHRoaXMuZGV0ZWN0KCk7XG4gICAgaWYgKCFkZXQucmVhbENvZGV4UGF0aCkge1xuICAgICAgZGxvZyhcImNvZGV4XCIsIFwibm8gY29kZXggb24gUEFUSCBcdTIwMTQgc2tpcHBpbmdcIik7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGRldGFpbDogXCJjb2RleCBub3QgaW5zdGFsbGVkXCIgfTtcbiAgICB9XG5cbiAgICBta2RpclN5bmMoYmluRGlyKCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGNvbnN0IHNoaW1TcmMgPSBqb2luKG9wdHMuZXh0ZW5zaW9uRGlzdERpciwgXCJhZGFwdGVyc1wiLCBcImNvZGV4LXNoaW0uYXNzZXQuc2hcIik7XG4gICAgY29uc3QgYmFubmVyU3JjID0gam9pbihcbiAgICAgIG9wdHMuZXh0ZW5zaW9uRGlzdERpcixcbiAgICAgIFwiYWRhcHRlcnNcIixcbiAgICAgIFwiY29kZXgtYmFubmVyLmFzc2V0Lm1qc1wiLFxuICAgICk7XG4gICAgY29uc3Qgc2hpbSA9IGpvaW4oYmluRGlyKCksIFwiY29kZXhcIik7XG4gICAgY29uc3QgYmFubmVyID0gam9pbihtZWFud2hpbGVEaXIoKSwgXCJjb2RleC1iYW5uZXIubWpzXCIpO1xuICAgIGNvcHlGaWxlU3luYyhzaGltU3JjLCBzaGltKTtcbiAgICBjaG1vZFN5bmMoc2hpbSwgMG83NTUpO1xuICAgIGNvcHlGaWxlU3luYyhiYW5uZXJTcmMsIGJhbm5lcik7XG4gICAgY2htb2RTeW5jKGJhbm5lciwgMG82NDQpO1xuXG4gICAgY29uc3QgZWRpdGVkOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgcmMgb2YgcmNGaWxlcygpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzcmMgPSBleGlzdHNTeW5jKHJjKSA/IHJlYWRGaWxlU3luYyhyYywgXCJ1dGY4XCIpIDogXCJcIjtcbiAgICAgICAgY29uc3QgbmV4dCA9IGFkZFJjQmxvY2soc3JjLCBiaW5EaXIoKSk7XG4gICAgICAgIGlmIChuZXh0ICE9PSBzcmMpIHdyaXRlRmlsZVN5bmMocmMsIG5leHQpO1xuICAgICAgICBlZGl0ZWQucHVzaChyYyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRsb2coXCJjb2RleFwiLCBcInJjIGVkaXQgZmFpbGVkXCIsIHsgcmMsIGU6IFN0cmluZyhlKSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVkaXRlZC5sZW5ndGggPT09IDApIHJldHVybiB7IG9rOiBmYWxzZSwgZGV0YWlsOiBcIm5vIHJjIGZpbGUgZWRpdGFibGVcIiB9O1xuXG4gICAgY29uc3Qgc3RhdGU6IENvZGV4U3RhdGUgPSB7IHJjRmlsZXNFZGl0ZWQ6IGVkaXRlZCwgYXBwbGllZEF0TXM6IERhdGUubm93KCkgfTtcbiAgICB3cml0ZUZpbGVTeW5jKHN0YXRlUGF0aCgpLCBKU09OLnN0cmluZ2lmeShzdGF0ZSwgbnVsbCwgMikgKyBcIlxcblwiKTtcbiAgICBkbG9nKFwiY29kZXhcIiwgXCJwYXRjaGVkXCIsIHsgZWRpdGVkIH0pO1xuICAgIHJldHVybiB7IG9rOiB0cnVlIH07XG4gIH1cblxuICAvKiogUmVtb3ZlIHRoZSBzaGltIGFuZCBzdHJpcCB0aGUgUEFUSCBibG9jayBmcm9tIGV2ZXJ5IHJjIHdlIGVkaXRlZC4gKi9cbiAgcmVzdG9yZSgpOiB7IG9rOiBib29sZWFuOyBkZXRhaWw/OiBzdHJpbmcgfSB7XG4gICAgbGV0IHN0YXRlOiBDb2RleFN0YXRlIHwgbnVsbCA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIHN0YXRlID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoc3RhdGVQYXRoKCksIFwidXRmOFwiKSkgYXMgQ29kZXhTdGF0ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIG5vdCBwYXRjaGVkICovXG4gICAgfVxuICAgIGlmICghc3RhdGUpIHJldHVybiB7IG9rOiB0cnVlLCBkZXRhaWw6IFwibm90aGluZyB0byByZXN0b3JlXCIgfTtcblxuICAgIHRyeSB7XG4gICAgICBmb3IgKGNvbnN0IHJjIG9mIHN0YXRlLnJjRmlsZXNFZGl0ZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAoIWV4aXN0c1N5bmMocmMpKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBzcmMgPSByZWFkRmlsZVN5bmMocmMsIFwidXRmOFwiKTtcbiAgICAgICAgICBjb25zdCBuZXh0ID0gcmVtb3ZlUmNCbG9jayhzcmMpO1xuICAgICAgICAgIGlmIChuZXh0ICE9PSBzcmMpIHdyaXRlRmlsZVN5bmMocmMsIG5leHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgZGxvZyhcImNvZGV4XCIsIFwicmMgcmVzdG9yZSBmYWlsZWRcIiwgeyByYywgZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBybVN5bmMoYmluRGlyKCksIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgIHJtU3luYyhqb2luKG1lYW53aGlsZURpcigpLCBcImNvZGV4LWJhbm5lci5tanNcIiksIHsgZm9yY2U6IHRydWUgfSk7XG4gICAgICBybVN5bmMoc3RhdGVQYXRoKCksIHsgZm9yY2U6IHRydWUgfSk7XG4gICAgICBkbG9nKFwiY29kZXhcIiwgXCJyZXN0b3JlZFwiKTtcbiAgICAgIHJldHVybiB7IG9rOiB0cnVlIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBkZXRhaWw6IFN0cmluZyhlKSB9O1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHZzY29kZSBmcm9tIFwidnNjb2RlXCI7XG5pbXBvcnQgeyBob21lZGlyIH0gZnJvbSBcIm5vZGU6b3NcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCBta2RpclN5bmMsIHJlYWRGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5cbi8qKlxuICogRWZmZWN0aXZlIGV4dGVuc2lvbiBjb25maWd1cmF0aW9uLCByZXNvbHZlZCBmcm9tIChoaWdoZXN0IHByZWNlZGVuY2UgZmlyc3QpOlxuICogICAxLiBWUyBDb2RlIHNldHRpbmdzIChgbWVhbndoaWxlLipgKVxuICogICAyLiB+Ly5tZWFud2hpbGUvY29uZmlnLmpzb24gIChwb3dlci11c2VyIC8gaGVhZGxlc3Mgb3ZlcnJpZGUpXG4gKiAgIDMuIGVudmlyb25tZW50IChNRUFOV0hJTEVfQkFTRSwgTUVBTldISUxFX0RFQlVHKVxuICogICA0LiBjb21waWxlZC1pbiBkZWZhdWx0c1xuICpcbiAqIFJlYWRzIGFyZSBiZXN0LWVmZm9ydDogYSBtaXNzaW5nL2Jyb2tlbiBmaWxlIG9yIHNldHRpbmcgZmFsbHMgdGhyb3VnaCB0byB0aGVcbiAqIG5leHQgc291cmNlIHNvIGFjdGl2YXRpb24gY2FuIG5ldmVyIGJlIGJyb2tlbiBieSBjb25maWcuXG4gKi9cblxuY29uc3QgREVGQVVMVF9CQUNLRU5EX0JBU0UgPSBcImh0dHA6Ly8xMjcuMC4wLjE6MzAwMFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lYW53aGlsZUNvbmZpZyB7XG4gIGJhY2tlbmRCYXNlVXJsOiBzdHJpbmc7XG4gIGRlYnVnOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWVhbndoaWxlRGlyKCk6IHN0cmluZyB7XG4gIGNvbnN0IGRpciA9IGpvaW4oaG9tZWRpcigpLCBcIi5tZWFud2hpbGVcIik7XG4gIHRyeSB7XG4gICAgaWYgKCFleGlzdHNTeW5jKGRpcikpIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvKiBiZXN0LWVmZm9ydCAqL1xuICB9XG4gIHJldHVybiBkaXI7XG59XG5cbmludGVyZmFjZSBGaWxlQ29uZmlnIHtcbiAgYmFja2VuZEJhc2VVcmw/OiBzdHJpbmc7XG4gIGRlYnVnPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gcmVhZEZpbGVDb25maWcoKTogRmlsZUNvbmZpZyB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmF3ID0gcmVhZEZpbGVTeW5jKGpvaW4obWVhbndoaWxlRGlyKCksIFwiY29uZmlnLmpzb25cIiksIFwidXRmOFwiKTtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShyYXcpIGFzIEZpbGVDb25maWc7XG4gICAgcmV0dXJuIGogJiYgdHlwZW9mIGogPT09IFwib2JqZWN0XCIgPyBqIDoge307XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7fTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cmltU2xhc2hlcyhzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZENvbmZpZygpOiBNZWFud2hpbGVDb25maWcge1xuICBjb25zdCBzZXR0aW5ncyA9IHZzY29kZS53b3Jrc3BhY2UuZ2V0Q29uZmlndXJhdGlvbihcIm1lYW53aGlsZVwiKTtcbiAgY29uc3QgZmlsZSA9IHJlYWRGaWxlQ29uZmlnKCk7XG5cbiAgY29uc3Qgc2V0dGluZ0Jhc2UgPSAoc2V0dGluZ3MuZ2V0PHN0cmluZz4oXCJiYWNrZW5kQmFzZVVybFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IGZpbGVCYXNlID0gKGZpbGUuYmFja2VuZEJhc2VVcmwgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCBlbnZCYXNlID0gKHByb2Nlc3MuZW52Lk1FQU5XSElMRV9CQVNFIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgYmFja2VuZEJhc2VVcmwgPSB0cmltU2xhc2hlcyhcbiAgICBzZXR0aW5nQmFzZSB8fCBmaWxlQmFzZSB8fCBlbnZCYXNlIHx8IERFRkFVTFRfQkFDS0VORF9CQVNFLFxuICApO1xuXG4gIGNvbnN0IGRlYnVnID1cbiAgICBzZXR0aW5ncy5nZXQ8Ym9vbGVhbj4oXCJkZWJ1Z1wiKSA9PT0gdHJ1ZSB8fFxuICAgIGZpbGUuZGVidWcgPT09IHRydWUgfHxcbiAgICBwcm9jZXNzLmVudi5NRUFOV0hJTEVfREVCVUcgPT09IFwiMVwiO1xuXG4gIHJldHVybiB7IGJhY2tlbmRCYXNlVXJsLCBkZWJ1ZyB9O1xufVxuIiwgImltcG9ydCB7IGFwcGVuZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi9jb25maWdcIjtcblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBkZWJ1ZyBsb2dnaW5nLiBPZmYgdW5sZXNzIGBkZWJ1Z2AgaXMgZW5hYmxlZCBpbiBjb25maWc7IGV2ZW5cbiAqIHRoZW4sIGEgd3JpdGUgZmFpbHVyZSBtdXN0IG5ldmVyIHN1cmZhY2UgdG8gdGhlIHVzZXIgXHUyMDE0IGxvZ2dpbmcgaXMgYVxuICogZGlhZ25vc3RpYyBhaWQsIG5vdCBhIGZlYXR1cmUgcGF0aC5cbiAqL1xuXG5sZXQgZGVidWdFbmFibGVkID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXREZWJ1ZyhvbjogYm9vbGVhbik6IHZvaWQge1xuICBkZWJ1Z0VuYWJsZWQgPSBvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRsb2coc2NvcGU6IHN0cmluZywgZXZlbnQ6IHN0cmluZywgZGF0YT86IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKCFkZWJ1Z0VuYWJsZWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBsaW5lID1cbiAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzY29wZSxcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIC4uLihkYXRhICE9PSB1bmRlZmluZWQgPyB7IGRhdGEgfSA6IHt9KSxcbiAgICAgIH0pICsgXCJcXG5cIjtcbiAgICBhcHBlbmRGaWxlU3luYyhqb2luKG1lYW53aGlsZURpcigpLCBcImRlYnVnLmxvZ1wiKSwgbGluZSwgXCJ1dGY4XCIpO1xuICB9IGNhdGNoIHtcbiAgICAvKiBuZXZlciBicmVhayBvbiBsb2dnaW5nICovXG4gIH1cbn1cbiIsICIvKipcbiAqIFB1cmUgZWRpdCBsb2dpYyBmb3Igc2hlbGwgcmMgZmlsZXMgKH4vLnpzaHJjLCB+Ly5iYXNocmMpLiBUaGUgTWVhbndoaWxlXG4gKiBibG9jayBpcyBtYXJrZXItZGVsaW1pdGVkIHNvIGluc3RhbGwvcmVtb3ZlIGFyZSBpZGVtcG90ZW50IGFuZCBuZXZlciB0b3VjaFxuICogYW55dGhpbmcgdGhlIHVzZXIgd3JvdGUuIElPIGFuZCBwb2xpY3kgbGl2ZSBpbiB0aGUgQ29kZXggYWRhcHRlci5cbiAqL1xuXG5leHBvcnQgY29uc3QgUkNfQkVHSU4gPSBcIiMgPj4+IG1lYW53aGlsZSA+Pj5cIjtcbmV4cG9ydCBjb25zdCBSQ19FTkQgPSBcIiMgPDw8IG1lYW53aGlsZSA8PDxcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHJjQmxvY2soYmluRGlyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gW1xuICAgIFJDX0JFR0lOLFxuICAgIFwiIyBBZGRzIHRoZSBNZWFud2hpbGUgc3BvbnNvciBzaGltIGZvciB0aGUgY29kZXggQ0xJLiBNYW5hZ2VkIGJ5IHRoZVwiLFxuICAgICcjIE1lYW53aGlsZSBleHRlbnNpb24gXHUyMDE0IHJ1biBcIk1lYW53aGlsZTogUmVzdG9yZVwiIHRvIHJlbW92ZS4nLFxuICAgIGBleHBvcnQgUEFUSD1cIiR7YmluRGlyfTokUEFUSFwiYCxcbiAgICBSQ19FTkQsXG4gIF0uam9pbihcIlxcblwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc1JjQmxvY2soc3JjOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHNyYy5pbmNsdWRlcyhSQ19CRUdJTikgJiYgc3JjLmluY2x1ZGVzKFJDX0VORCk7XG59XG5cbi8qKiBBcHBlbmQgKG9yIHJlZnJlc2gpIHRoZSBtYW5hZ2VkIGJsb2NrLiBSZXR1cm5zIHRoZSBuZXcgY29udGVudC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRSY0Jsb2NrKHNyYzogc3RyaW5nLCBiaW5EaXI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHdpdGhvdXQgPSByZW1vdmVSY0Jsb2NrKHNyYyk7XG4gIGNvbnN0IHNlcCA9IHdpdGhvdXQubGVuZ3RoID09PSAwIHx8IHdpdGhvdXQuZW5kc1dpdGgoXCJcXG5cIikgPyBcIlwiIDogXCJcXG5cIjtcbiAgcmV0dXJuIGAke3dpdGhvdXR9JHtzZXB9XFxuJHtyY0Jsb2NrKGJpbkRpcil9XFxuYDtcbn1cblxuLyoqIFN0cmlwIHRoZSBtYW5hZ2VkIGJsb2NrIChhbmQgZXhhY3RseSBvbmUgc3Vycm91bmRpbmcgYmxhbmsgbGluZSkuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlUmNCbG9jayhzcmM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghaGFzUmNCbG9jayhzcmMpKSByZXR1cm4gc3JjO1xuICBjb25zdCBzdGFydCA9IHNyYy5pbmRleE9mKFJDX0JFR0lOKTtcbiAgY29uc3QgZW5kID0gc3JjLmluZGV4T2YoUkNfRU5EKTtcbiAgaWYgKHN0YXJ0ID09PSAtMSB8fCBlbmQgPT09IC0xIHx8IGVuZCA8IHN0YXJ0KSByZXR1cm4gc3JjO1xuICBsZXQgaGVhZCA9IHNyYy5zbGljZSgwLCBzdGFydCk7XG4gIGxldCB0YWlsID0gc3JjLnNsaWNlKGVuZCArIFJDX0VORC5sZW5ndGgpO1xuICAvLyBTd2FsbG93IHRoZSBuZXdsaW5lIHdlIGFkZGVkIGJlZm9yZSB0aGUgYmxvY2sgYW5kIGFmdGVyIGl0LlxuICBoZWFkID0gaGVhZC5yZXBsYWNlKC9cXG5cXG4kLywgXCJcXG5cIik7XG4gIHRhaWwgPSB0YWlsLnJlcGxhY2UoL15cXG4vLCBcIlwiKTtcbiAgcmV0dXJuIGhlYWQgKyB0YWlsO1xufVxuIiwgIi8qKlxuICogTWVhbndoaWxlIFx1MjAxNCBzaGFyZWQgQVBJIGNvbnRyYWN0LlxuICpcbiAqIFRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciB0aGUgd2lyZSBzaGFwZXMgZXhjaGFuZ2VkIGJldHdlZW4gdGhlIHdlYlxuICogYmFja2VuZCAoYHdlYi9gKSBhbmQgdGhlIGVkaXRvciBleHRlbnNpb24gKGBleHRlbnNpb24vYCkuIEJvdGggaW1wb3J0IHRoaXNcbiAqIGZpbGUgZGlyZWN0bHkgc28gYSBjb250cmFjdCBjaGFuZ2UgY2FuIG5ldmVyIGRyaWZ0IGJldHdlZW4gdGhlIHR3byBoYWx2ZXMuXG4gKlxuICogRGVzaWduIHJ1bGUgKG1vZHVsYXIgYXV0aCk6IHRoZSBleHRlbnNpb24gTkVWRVIgdGFsa3MgdG8gdGhlIHdlYiBhdXRoXG4gKiBwcm92aWRlciAoYmV0dGVyLWF1dGgvQ2xlcmsvZXRjLikgZGlyZWN0bHkuIEl0IHVzZXMgb3VyIG93biBvcGFxdWUtdG9rZW5cbiAqIGxheWVyIGJlbG93IChgL2FwaS9leHQvYXV0aC8qYCkuIFN3YXBwaW5nIHRoZSB3ZWIgcHJvdmlkZXIgbGF0ZXIgdG91Y2hlc1xuICogb25seSB0aGUgYnJvd3NlciBzaWduLWluIHBhZ2UsIG5ldmVyIGFueXRoaW5nIGluIGhlcmUuXG4gKi9cblxuLyoqIEFQSSB2ZXJzaW9uIHByZWZpeCBmb3IgZXZlcnkgZXh0ZW5zaW9uLWZhY2luZyByb3V0ZS4gKi9cbmV4cG9ydCBjb25zdCBBUElfVkVSU0lPTiA9IFwidjFcIiBhcyBjb25zdDtcblxuLyoqIFdoZXJlIGEgc3BvbnNvciBsaW5lIGlzIGJlaW5nIHJlbmRlcmVkLiBEcml2ZXMgcGVyLXN1cmZhY2UgYmlsbGluZyBhbmRcbiAqICBsZXRzIHRoZSBiYWNrZW5kIHNlZ21lbnQgZGVsaXZlcnkgYnkgY2xpZW50IHR5cGUuICovXG5leHBvcnQgdHlwZSBTdXJmYWNlID1cbiAgfCBcImNjX3dlYnZpZXdcIiAvLyBDbGF1ZGUgQ29kZSBWUyBDb2RlL0N1cnNvciBwYW5lbCAocmljaCBvdmVybGF5KVxuICB8IFwiY2NfY2xpX3N0YXR1c2xpbmVcIiAvLyBDbGF1ZGUgQ29kZSB0ZXJtaW5hbCBzdGF0dXMtYmFyIE9TQy04IGxpbmtcbiAgfCBcImNjX2NsaV9zcGlubmVyXCIgLy8gQ2xhdWRlIENvZGUgdGVybWluYWwgdGhpbmtpbmctdmVyYiAoQ0MgPj0gMi4xLjE0MylcbiAgfCBcImNvZGV4X2NsaVwiIC8vIENvZGV4IENMSSBzdGFydHVwIGJhbm5lciAoUEFUSCB3cmFwcGVyKVxuICB8IFwiY29kZXhfd2Vidmlld1wiOyAvLyBDb2RleCBWUyBDb2RlIHBhbmVsXG5cbmV4cG9ydCBjb25zdCBBTExfU1VSRkFDRVM6IHJlYWRvbmx5IFN1cmZhY2VbXSA9IFtcbiAgXCJjY193ZWJ2aWV3XCIsXG4gIFwiY2NfY2xpX3N0YXR1c2xpbmVcIixcbiAgXCJjY19jbGlfc3Bpbm5lclwiLFxuICBcImNvZGV4X2NsaVwiLFxuICBcImNvZGV4X3dlYnZpZXdcIixcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN1cmZhY2UocmF3OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogU3VyZmFjZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiByYXcgJiYgKEFMTF9TVVJGQUNFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocmF3KVxuICAgID8gKHJhdyBhcyBTdXJmYWNlKVxuICAgIDogdW5kZWZpbmVkO1xufVxuXG4vKiogQSBzaW5nbGUgc2VydmVkIHNwb25zb3IgY3JlYXRpdmUgKHdlIGNhbGwgdGhlbSBcInNwb25zb3JzXCIsIG5vdCBcImFkc1wiKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3BvbnNvciB7XG4gIC8qKiBTdGFibGUgaWQgb2YgdGhpcyBzZXJ2ZWQgaW1wcmVzc2lvbi1lbGlnaWJsZSBjcmVhdGl2ZS4gKi9cbiAgc3BvbnNvcklkOiBzdHJpbmc7XG4gIGNhbXBhaWduSWQ6IHN0cmluZztcbiAgLyoqIFRoZSBvbmUtbGluZSB0ZXh0IHNob3duIGluIHRoZSBzcGlubmVyL3N0YXR1cyBzdXJmYWNlICgzXHUyMDEzNjAgY2hhcnMpLiAqL1xuICB0ZXh0OiBzdHJpbmc7XG4gIC8qKiBCcmFuZCBuYW1lIGZvciB0aGUgbGVhZGVyYm9hcmQgKG9wdGlvbmFsKS4gKi9cbiAgYnJhbmQ/OiBzdHJpbmc7XG4gIC8qKiBBYnNvbHV0ZSBodHRwcyBpY29uIFVSTCAob3B0aW9uYWw7IHN1cmZhY2VzIGZhbGwgYmFjayB0byBhIGdseXBoKS4gKi9cbiAgaWNvblVybD86IHN0cmluZztcbiAgLyoqIEFic29sdXRlIGh0dHBzIGxhbmRpbmcgVVJMIG9wZW5lZCBvbiBjbGljay4gKi9cbiAgY2xpY2tVcmw6IHN0cmluZztcbiAgLyoqIE9wYXF1ZSBwZXItc2VydmUgdG9rZW4gdGhlIGNsaWVudCBlY2hvZXMgYmFjayBvbiBldmVyeSBtZXRyaWMgYmVhY29uIHNvXG4gICAqICB0aGUgYmFja2VuZCBjYW4gYmluZCBhbiBldmVudCB0byBleGFjdGx5IHRoaXMgc2VydmUgKGFudGktc3Bvb2YpLiAqL1xuICBzZXNzaW9uVG9rZW46IHN0cmluZztcbiAgLyoqIFRydWUgd2hlbiB0aGlzIGNhbWUgZnJvbSB0aGUgc2lnbmVkLW91dCBERU1PIGludmVudG9yeTogaXQgcmVuZGVyc1xuICAgKiAgaWRlbnRpY2FsbHkgYW5kIHRoZSBjbGljayBvcGVucyB0aGUgcmVhbCBVUkwsIGJ1dCBtZXRyaWNzIHJvdXRlIHRvIHRoZVxuICAgKiAgZGVtbyBzaW5rIChhZHZlcnRpc2VyIGNoYXJnZWQsIG5vIHVzZXIgY3JlZGl0ZWQpLiAqL1xuICBkZW1vPzogYm9vbGVhbjtcbn1cblxuLyoqIERpc3BsYXktb25seSBlYXJuaW5ncyBmb3IgdGhlIHN0YXR1cyBiYXIgKHRoZSB1c2VyJ3MgNTAlIHNoYXJlKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmFsYW5jZXMge1xuICBsaWZldGltZVVzZDogc3RyaW5nOyAvLyBmb3JtYXR0ZWQgZGVjaW1hbCBzdHJpbmcsIGUuZy4gXCI3LjExXCJcbiAgdG9kYXlVc2Q6IHN0cmluZztcbiAgbGFzdFVwZGF0ZWRNczogbnVtYmVyO1xufVxuXG4vKiogR0VUIC92MS9wb3J0Zm9saW8gcmVzcG9uc2UuIFRoZSBleHRlbnNpb24gZHJhaW5zIGBzcG9uc29yc2AgaW4gb3JkZXIsXG4gKiAgcm90YXRpbmcgZXZlcnkgYHJvdGF0aW9uSW50ZXJ2YWxNc2AsIHJlZmV0Y2hpbmcgd2hlbiB0aGUgcXVldWUgZW1wdGllcyBvclxuICogIGB0dGxNc2AgZWxhcHNlcy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUG9ydGZvbGlvUmVzcG9uc2Uge1xuICBzcG9uc29yczogU3BvbnNvcltdO1xuICAvKiogSG93IGxvbmcgdGhlIGNsaWVudCBzaG91bGQgY2FjaGUgdGhpcyByZXNwb25zZSBiZWZvcmUgcmVmZXRjaGluZy4gKi9cbiAgdHRsTXM6IG51bWJlcjtcbiAgLyoqIE1pbmltdW0gZ2FwIGJldHdlZW4gb24tZGlzayByb3RhdGlvbnMgKGZsb29yZWQgc2VydmVyLXNpZGUgdG8gcHJvdGVjdFxuICAgKiAgdGhlIGhvc3QgZnJvbSBhIGhvc3RpbGUvYnVnZ3kgdmFsdWUgcmV3cml0aW5nIENDJ3MgNC42IE1CIGJ1bmRsZSkuICovXG4gIHJvdGF0aW9uSW50ZXJ2YWxNczogbnVtYmVyO1xuICAvKiogQ3VtdWxhdGl2ZSB2aXNpYmxlIHRpbWUgYSBzcG9uc29yIG11c3QgYWNjcnVlIGJlZm9yZSBpdCBiaWxscyBhcyBhXG4gICAqICB2aWV3YWJsZSBpbXByZXNzaW9uLiAqL1xuICB2aWV3VGhyZXNob2xkTXM6IG51bWJlcjtcbiAgLyoqIFNpZ25lZC1pbiBvbmx5OyBudWxsIGZvciBkZW1vL2Fub255bW91cyBmZXRjaGVzLiAqL1xuICBiYWxhbmNlczogQmFsYW5jZXMgfCBudWxsO1xufVxuXG4vKiogQmlsbGFibGUgbGlmZWN5Y2xlIGV2ZW50cy4gYGltcHJlc3Npb25gID0gZmlyc3QgcGFpbnQ7IGB2aWV3YWJsZWAgPVxuICogIGNyb3NzZWQgdGhlIHZpZXcgdGhyZXNob2xkOyBgdmlld190aWNrYCA9IHBlcmlvZGljIGhlYXJ0YmVhdCB3aGlsZVxuICogIHZpc2libGU7IGBjbGlja2AgPSBhbmNob3Igb3BlbmVkOyBgZXJyb3JfaW1wcmVzc2lvbmAgPSBzYWZldHktbmV0IGZpcmUgc29cbiAqICBhIHN0dWNrLWJ1dC12aXNpYmxlIHNwb25zb3Igc3RpbGwgYmlsbHMgb25jZS4gKi9cbmV4cG9ydCB0eXBlIE1ldHJpY0V2ZW50ID1cbiAgfCBcImltcHJlc3Npb25cIlxuICB8IFwidmlld2FibGVcIlxuICB8IFwidmlld190aWNrXCJcbiAgfCBcInZpZXdfdGhyZXNob2xkX21ldFwiXG4gIHwgXCJjbGlja1wiXG4gIHwgXCJlcnJvcl9pbXByZXNzaW9uXCI7XG5cbmV4cG9ydCBjb25zdCBCSUxMQUJMRV9FVkVOVFM6IHJlYWRvbmx5IE1ldHJpY0V2ZW50W10gPSBbXG4gIFwiaW1wcmVzc2lvblwiLFxuICBcInZpZXdhYmxlXCIsXG4gIFwidmlld190aWNrXCIsXG4gIFwidmlld190aHJlc2hvbGRfbWV0XCIsXG4gIFwiY2xpY2tcIixcbiAgXCJlcnJvcl9pbXByZXNzaW9uXCIsXG5dO1xuXG4vKiogUE9TVCAvdjEvbWV0cmljcyBib2R5LiBTZW50IHdpdGggYSBCZWFyZXIgdG9rZW4gd2hlbiBzaWduZWQgaW4sIGVsc2UgaXRcbiAqICByb3V0ZXMgdG8gdGhlIGRlbW8gc2luay4gYG5vbmNlYCBkZWR1cGVzIHJldHJpZXM7IGBzZXNzaW9uVG9rZW5gIGJpbmRzIHRoZVxuICogIGV2ZW50IHRvIGEgc3BlY2lmaWMgc2VydmUuICovXG5leHBvcnQgaW50ZXJmYWNlIE1ldHJpY0JlYWNvbiB7XG4gIGV2ZW50OiBNZXRyaWNFdmVudDtcbiAgc3BvbnNvcklkOiBzdHJpbmc7XG4gIGNhbXBhaWduSWQ6IHN0cmluZztcbiAgc3VyZmFjZTogU3VyZmFjZTtcbiAgLyoqIFN0YWJsZSBhbm9ueW1vdXMgZGV2aWNlIGlkIChtaW50ZWQgY2xpZW50LXNpZGUsIHBlcnNpc3RlZCBsb2NhbGx5KS4gKi9cbiAgY2xpZW50SWQ6IHN0cmluZztcbiAgLyoqIFBlci1zZXJ2ZSB0b2tlbiBmcm9tIHRoZSBTcG9uc29yLiAqL1xuICBzZXNzaW9uVG9rZW46IHN0cmluZztcbiAgLyoqIFVVSUQgdjQsIHVuaXF1ZSBwZXIgZXZlbnQ7IGJhY2tlbmQgaWdub3JlcyBkdXBsaWNhdGVzLiAqL1xuICBub25jZTogc3RyaW5nO1xuICAvKiogSVNPIHRpbWVzdGFtcCAoY2xpZW50IGNsb2NrOyBiYWNrZW5kIHN0YW1wcyBpdHMgb3duIHRvbykuICovXG4gIHRzOiBzdHJpbmc7XG4gIC8qKiBDdW11bGF0aXZlIHZpc2libGUgbXMgYXQgdGhlIG1vbWVudCBvZiB0aGUgZXZlbnQgKGZvciB2aWV3L2NsaWNrIGZsb29ycykuICovXG4gIHZpc2libGVNcz86IG51bWJlcjtcbiAgLyoqIENsaWVudCBlbnZpcm9ubWVudCBmaW5nZXJwcmludCBmb3IgdHJhZmZpYyBzZWdtZW50YXRpb24gKG9zL2FyY2gvZWRpdG9yKS4gKi9cbiAgY2xpZW50PzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbi8qKiBHRVQgL3YxL2Vhcm5pbmdzIHJlc3BvbnNlIChzaWduZWQtaW4pLiAqL1xuZXhwb3J0IGludGVyZmFjZSBFYXJuaW5nc1Jlc3BvbnNlIHtcbiAgbGlmZXRpbWVVc2Q6IHN0cmluZztcbiAgdG9kYXlVc2Q6IHN0cmluZztcbn1cblxuLy8gLS0tIEV4dGVuc2lvbiBhdXRoIChvdXIgb3duIHRva2VuIGxheWVyOyBwcm92aWRlci1hZ25vc3RpYykgLS0tLS0tLS0tLS0tLS0tXG5cbi8qKiBQT1NUIC92MS9leHQvYXV0aC9zdGFydCByZXNwb25zZS4gVGhlIGV4dGVuc2lvbiBvcGVucyBgYXV0aFVybGAgaW4gdGhlXG4gKiAgc3lzdGVtIGJyb3dzZXIgYW5kIHBvbGxzIHdpdGggYHN0YXRlYC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0QXV0aFN0YXJ0UmVzcG9uc2Uge1xuICBzdGF0ZTogc3RyaW5nO1xuICBhdXRoVXJsOiBzdHJpbmc7XG4gIC8qKiBIb3cgbG9uZyB0aGUgY2xpZW50IHNob3VsZCBwb2xsIGJlZm9yZSBnaXZpbmcgdXAgKHNlY29uZHMpLiAqL1xuICBleHBpcmVzSW5TZWM6IG51bWJlcjtcbn1cblxuLyoqIEdFVCAvdjEvZXh0L2F1dGgvcG9sbD9zdGF0ZT0gcmVzcG9uc2UuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhQb2xsUmVzcG9uc2Uge1xuICBzdGF0dXM6IFwicGVuZGluZ1wiIHwgXCJjb21wbGV0ZVwiIHwgXCJleHBpcmVkXCI7XG4gIGFjY2Vzc1Rva2VuPzogc3RyaW5nO1xuICByZWZyZXNoVG9rZW4/OiBzdHJpbmc7XG59XG5cbi8qKiBQT1NUIC92MS9leHQvYXV0aC9yZWZyZXNoIGJvZHkgKyByZXNwb25zZS4gVGhlIHJlZnJlc2ggdG9rZW4gUk9UQVRFUzpcbiAqICB0aGUgcmVzcG9uc2UgYWx3YXlzIGNhcnJpZXMgYSBmcmVzaCBvbmUgdG8gcGVyc2lzdC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXh0QXV0aFJlZnJlc2hSZXF1ZXN0IHtcbiAgcmVmcmVzaFRva2VuOiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIEV4dEF1dGhSZWZyZXNoUmVzcG9uc2Uge1xuICBhY2Nlc3NUb2tlbjogc3RyaW5nO1xuICByZWZyZXNoVG9rZW46IHN0cmluZztcbn1cblxuLyoqIFJvdXRlIGJ1aWxkZXJzIHNvIGNhbGxlcnMgbmV2ZXIgaGFuZC1jb25jYXRlbmF0ZSBwYXRocy4gUGF0aHMgYXJlIHJlbGF0aXZlXG4gKiAgdG8gdGhlIGJhY2tlbmQgYmFzZSBVUkwgYW5kIGluY2x1ZGUgdGhlIE5leHQuanMgYC9hcGlgIG1vdW50LiAqL1xuY29uc3QgUCA9IGAvYXBpLyR7QVBJX1ZFUlNJT059YCBhcyBjb25zdDtcblxuZXhwb3J0IGNvbnN0IHJvdXRlcyA9IHtcbiAgcG9ydGZvbGlvOiAoc3VyZmFjZTogU3VyZmFjZSwgY2xpZW50SWQ6IHN0cmluZykgPT5cbiAgICBgJHtQfS9wb3J0Zm9saW8/c3VyZmFjZT0ke2VuY29kZVVSSUNvbXBvbmVudChzdXJmYWNlKX0mY2xpZW50X2lkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGNsaWVudElkKX1gLFxuICBtZXRyaWNzOiAoKSA9PiBgJHtQfS9tZXRyaWNzYCxcbiAgZWFybmluZ3M6ICgpID0+IGAke1B9L2Vhcm5pbmdzYCxcbiAgYXV0aFN0YXJ0OiAoKSA9PiBgJHtQfS9leHQvYXV0aC9zdGFydGAsXG4gIGF1dGhQb2xsOiAoc3RhdGU6IHN0cmluZykgPT5cbiAgICBgJHtQfS9leHQvYXV0aC9wb2xsP3N0YXRlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN0YXRlKX1gLFxuICBhdXRoUmVmcmVzaDogKCkgPT4gYCR7UH0vZXh0L2F1dGgvcmVmcmVzaGAsXG4gIGF1dGhTaWdub3V0OiAoKSA9PiBgJHtQfS9leHQvYXV0aC9zaWdub3V0YCxcbn0gYXMgY29uc3Q7XG4iLCAiaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG4vKiogRXJyb3IgY2FycnlpbmcgdGhlIEhUVFAgc3RhdHVzIHNvIGNhbGxlcnMgY2FuIGJyYW5jaCBvbiA0MDEgZXRjLiAqL1xuZXhwb3J0IGNsYXNzIEh0dHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IHN0YXR1czogbnVtYmVyLFxuICAgIHB1YmxpYyByZWFkb25seSBib2R5VGV4dDogc3RyaW5nLFxuICApIHtcbiAgICBzdXBlcihgSFRUUCAke3N0YXR1c31gKTtcbiAgfVxufVxuXG5jb25zdCBERUZBVUxUX1RJTUVPVVRfTVMgPSAxMF8wMDA7XG5cbi8qKlxuICogTWluaW1hbCBKU09OIGZldGNoIHdpdGggYSBoYXJkIHRpbWVvdXQuIFRoZSBleHRlbnNpb24gaG9zdCBzaGlwcyBOb2RlIDIwKyxcbiAqIHNvIGdsb2JhbCBmZXRjaC9BYm9ydENvbnRyb2xsZXIgYXJlIGF2YWlsYWJsZSB3aXRob3V0IGRlcGVuZGVuY2llcy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSnNvbjxUPihcbiAgdXJsOiBzdHJpbmcsXG4gIGluaXQ/OiBSZXF1ZXN0SW5pdCAmIHsgdGltZW91dE1zPzogbnVtYmVyIH0sXG4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3QgY3RsID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCB0ID0gc2V0VGltZW91dChcbiAgICAoKSA9PiBjdGwuYWJvcnQoKSxcbiAgICBpbml0Py50aW1lb3V0TXMgPz8gREVGQVVMVF9USU1FT1VUX01TLFxuICApO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgLi4uaW5pdCxcbiAgICAgIHNpZ25hbDogY3RsLnNpZ25hbCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIC4uLihpbml0Py5oZWFkZXJzID8/IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBIdHRwRXJyb3IocmVzLnN0YXR1cywgdGV4dCk7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCkgYXMgVDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmICghKGUgaW5zdGFuY2VvZiBIdHRwRXJyb3IpKSBkbG9nKFwiaHR0cFwiLCBcImZldGNoIGZhaWxlZFwiLCB7IHVybCwgZTogU3RyaW5nKGUpIH0pO1xuICAgIHRocm93IGU7XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHQpO1xuICB9XG59XG4iLCAiaW1wb3J0ICogYXMgdnNjb2RlIGZyb20gXCJ2c2NvZGVcIjtcbmltcG9ydCB0eXBlIHtcbiAgRXh0QXV0aFBvbGxSZXNwb25zZSxcbiAgRXh0QXV0aFJlZnJlc2hSZXNwb25zZSxcbiAgRXh0QXV0aFN0YXJ0UmVzcG9uc2UsXG59IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IHJvdXRlcyB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29udHJhY3RcIjtcbmltcG9ydCB7IGZldGNoSnNvbiwgSHR0cEVycm9yIH0gZnJvbSBcIi4vaHR0cFwiO1xuaW1wb3J0IHsgZGxvZyB9IGZyb20gXCIuL2xvZ1wiO1xuXG5jb25zdCBTRUNSRVRfS0VZID0gXCJtZWFud2hpbGUudG9rZW5zLnYxXCI7XG5cbmludGVyZmFjZSBTdG9yZWRUb2tlbnMge1xuICBhY2Nlc3NUb2tlbjogc3RyaW5nO1xuICByZWZyZXNoVG9rZW46IHN0cmluZztcbn1cblxuLyoqXG4gKiBFeHRlbnNpb24tc2lkZSBhdXRoIGFnYWluc3Qgb3VyIG9wYXF1ZSB0b2tlbiBsYXllci4gVGhlIGZsb3cgaXNcbiAqIHN0YXJ0IFx1MjE5MiBvcGVuIGJyb3dzZXIgXHUyMTkyIHBvbGwgXHUyMTkyIHN0b3JlOyB0b2tlbnMgbGl2ZSBPTkxZIGluIFZTIENvZGVcbiAqIFNlY3JldFN0b3JhZ2UgKG5ldmVyIG9uIGRpc2spLCBhbmQgdGhlIHJlZnJlc2ggdG9rZW4gcm90YXRlcyBvbiBldmVyeSB1c2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBBdXRoU2VydmljZSB7XG4gIHByaXZhdGUgdG9rZW5zOiBTdG9yZWRUb2tlbnMgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZWZyZXNoaW5nOiBQcm9taXNlPGJvb2xlYW4+IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBzZWNyZXRzOiB2c2NvZGUuU2VjcmV0U3RvcmFnZSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJhc2U6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNsaWVudElkOiBzdHJpbmcsXG4gICkge31cblxuICBhc3luYyBsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLnNlY3JldHMuZ2V0KFNFQ1JFVF9LRVkpO1xuICAgICAgaWYgKHJhdykgdGhpcy50b2tlbnMgPSBKU09OLnBhcnNlKHJhdykgYXMgU3RvcmVkVG9rZW5zO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy50b2tlbnMgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBzaWduZWRJbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnMgIT09IG51bGw7XG4gIH1cblxuICBnZXQgYWNjZXNzVG9rZW4oKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zPy5hY2Nlc3NUb2tlbiA/PyBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0KHQ6IFN0b3JlZFRva2VucyB8IG51bGwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnRva2VucyA9IHQ7XG4gICAgaWYgKHQpIGF3YWl0IHRoaXMuc2VjcmV0cy5zdG9yZShTRUNSRVRfS0VZLCBKU09OLnN0cmluZ2lmeSh0KSk7XG4gICAgZWxzZSBhd2FpdCB0aGlzLnNlY3JldHMuZGVsZXRlKFNFQ1JFVF9LRVkpO1xuICB9XG5cbiAgLyoqIEZ1bGwgaW50ZXJhY3RpdmUgc2lnbi1pbi4gUmV0dXJucyB0cnVlIHdoZW4gdG9rZW5zIHdlcmUgb2J0YWluZWQuICovXG4gIGFzeW5jIHNpZ25Jbihwcm9ncmVzcz86IChtc2c6IHN0cmluZykgPT4gdm9pZCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHN0YXJ0ID0gYXdhaXQgZmV0Y2hKc29uPEV4dEF1dGhTdGFydFJlc3BvbnNlPihcbiAgICAgIHRoaXMuYmFzZSArIHJvdXRlcy5hdXRoU3RhcnQoKSxcbiAgICAgIHsgbWV0aG9kOiBcIlBPU1RcIiwgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBjbGllbnRJZDogdGhpcy5jbGllbnRJZCB9KSB9LFxuICAgICk7XG4gICAgZGxvZyhcImF1dGhcIiwgXCJzdGFydCBva1wiLCB7IHN0YXRlOiBzdGFydC5zdGF0ZS5zbGljZSgwLCA2KSArIFwiXHUyMDI2XCIgfSk7XG4gICAgcHJvZ3Jlc3M/LihcIk9wZW5pbmcgYnJvd3Nlclx1MjAyNlwiKTtcbiAgICBhd2FpdCB2c2NvZGUuZW52Lm9wZW5FeHRlcm5hbCh2c2NvZGUuVXJpLnBhcnNlKHN0YXJ0LmF1dGhVcmwpKTtcblxuICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIHN0YXJ0LmV4cGlyZXNJblNlYyAqIDEwMDA7XG4gICAgcHJvZ3Jlc3M/LihcIldhaXRpbmcgZm9yIHlvdSB0byBmaW5pc2ggc2lnbmluZyBpblx1MjAyNlwiKTtcbiAgICB3aGlsZSAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAyMDAwKSk7XG4gICAgICBsZXQgcG9sbDogRXh0QXV0aFBvbGxSZXNwb25zZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHBvbGwgPSBhd2FpdCBmZXRjaEpzb248RXh0QXV0aFBvbGxSZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLmF1dGhQb2xsKHN0YXJ0LnN0YXRlKSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGxvZyhcImF1dGhcIiwgXCJwb2xsIGVycm9yIChyZXRyeWluZylcIiwgeyBlOiBTdHJpbmcoZSkgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKHBvbGwuc3RhdHVzID09PSBcImNvbXBsZXRlXCIgJiYgcG9sbC5hY2Nlc3NUb2tlbiAmJiBwb2xsLnJlZnJlc2hUb2tlbikge1xuICAgICAgICBhd2FpdCB0aGlzLnBlcnNpc3Qoe1xuICAgICAgICAgIGFjY2Vzc1Rva2VuOiBwb2xsLmFjY2Vzc1Rva2VuLFxuICAgICAgICAgIHJlZnJlc2hUb2tlbjogcG9sbC5yZWZyZXNoVG9rZW4sXG4gICAgICAgIH0pO1xuICAgICAgICBkbG9nKFwiYXV0aFwiLCBcInNpZ24taW4gY29tcGxldGVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHBvbGwuc3RhdHVzID09PSBcImV4cGlyZWRcIikgYnJlYWs7XG4gICAgfVxuICAgIGRsb2coXCJhdXRoXCIsIFwic2lnbi1pbiBleHBpcmVkL2FiYW5kb25lZFwiKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKiogUm90YXRlIHRoZSByZWZyZXNoIHRva2VuLiBTaW5nbGUtZmxpZ2h0IHNvIGNvbmN1cnJlbnQgNDAxcyByZWZyZXNoIG9uY2UuICovXG4gIGFzeW5jIHJlZnJlc2goKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgaWYgKCF0aGlzLnRva2VucykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0aGlzLnJlZnJlc2hpbmcpIHJldHVybiB0aGlzLnJlZnJlc2hpbmc7XG4gICAgdGhpcy5yZWZyZXNoaW5nID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaEpzb248RXh0QXV0aFJlZnJlc2hSZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLmF1dGhSZWZyZXNoKCksXG4gICAgICAgICAge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcmVmcmVzaFRva2VuOiB0aGlzLnRva2Vucz8ucmVmcmVzaFRva2VuIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdCh7XG4gICAgICAgICAgYWNjZXNzVG9rZW46IHIuYWNjZXNzVG9rZW4sXG4gICAgICAgICAgcmVmcmVzaFRva2VuOiByLnJlZnJlc2hUb2tlbixcbiAgICAgICAgfSk7XG4gICAgICAgIGRsb2coXCJhdXRoXCIsIFwicmVmcmVzaCBva1wiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIEludmFsaWQvcmV2b2tlZCByZWZyZXNoIHRva2VuIFx1MjE5MiBmdWxseSBzaWduZWQgb3V0LlxuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEh0dHBFcnJvciAmJiAoZS5zdGF0dXMgPT09IDQwMSB8fCBlLnN0YXR1cyA9PT0gNDAwKSkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGVyc2lzdChudWxsKTtcbiAgICAgICAgfVxuICAgICAgICBkbG9nKFwiYXV0aFwiLCBcInJlZnJlc2ggZmFpbGVkXCIsIHsgZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLnJlZnJlc2hpbmcgPSBudWxsO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHRoaXMucmVmcmVzaGluZztcbiAgfVxuXG4gIGFzeW5jIHNpZ25PdXQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcnQgPSB0aGlzLnRva2Vucz8ucmVmcmVzaFRva2VuO1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdChudWxsKTtcbiAgICBpZiAoIXJ0KSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZldGNoSnNvbih0aGlzLmJhc2UgKyByb3V0ZXMuYXV0aFNpZ25vdXQoKSwge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHJlZnJlc2hUb2tlbjogcnQgfSksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwiYXV0aFwiLCBcInNpZ25vdXQgYmVhY29uIGZhaWxlZCAobG9jYWwgc3RhdGUgY2xlYXJlZClcIiwge1xuICAgICAgICBlOiBTdHJpbmcoZSksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUnVuIGFuIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdDsgb24gNDAxLCByZWZyZXNoIG9uY2UgYW5kIHJldHJ5LiBGYWxscyBiYWNrXG4gICAqIHRvIGFuIGFub255bW91cyBjYWxsIHdoZW4gc2lnbmVkIG91dCAocG9ydGZvbGlvIHN1cHBvcnRzIGJvdGgpLlxuICAgKi9cbiAgYXN5bmMgd2l0aEF1dGg8VD4oZm46IChiZWFyZXI6IHN0cmluZyB8IG51bGwpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBpZiAoIXRoaXMudG9rZW5zKSByZXR1cm4gZm4obnVsbCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmbih0aGlzLnRva2Vucy5hY2Nlc3NUb2tlbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBIdHRwRXJyb3IgJiYgZS5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgICBjb25zdCBvayA9IGF3YWl0IHRoaXMucmVmcmVzaCgpO1xuICAgICAgICByZXR1cm4gZm4ob2sgPyAodGhpcy50b2tlbnM/LmFjY2Vzc1Rva2VuID8/IG51bGwpIDogbnVsbCk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IHJhbmRvbUJ5dGVzLCByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IG1lYW53aGlsZURpciB9IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG4vKipcbiAqIFN0YWJsZSBhbm9ueW1vdXMgZGV2aWNlIGlkLiBNaW50ZWQgb25jZSwgcGVyc2lzdGVkIGluIH4vLm1lYW53aGlsZSwgYW5kXG4gKiByZXVzZWQgYWNyb3NzIGVkaXRvciByZXN0YXJ0cyBzbyBpbXByZXNzaW9ucyBmcm9tIG9uZSBtYWNoaW5lIGFnZ3JlZ2F0ZS5cbiAqIE5vdCBkZXJpdmVkIGZyb20gYW55IGhhcmR3YXJlIGlkZW50aWZpZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXZpY2VJZCgpOiBzdHJpbmcge1xuICBjb25zdCBmaWxlID0gam9pbihtZWFud2hpbGVEaXIoKSwgXCJkZXZpY2UuanNvblwiKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMoZmlsZSwgXCJ1dGY4XCIpKSBhcyB7IGNsaWVudElkPzogc3RyaW5nIH07XG4gICAgaWYgKGogJiYgdHlwZW9mIGouY2xpZW50SWQgPT09IFwic3RyaW5nXCIgJiYgai5jbGllbnRJZC5sZW5ndGggPj0gOCkge1xuICAgICAgcmV0dXJuIGouY2xpZW50SWQ7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiBtaW50IGJlbG93ICovXG4gIH1cbiAgY29uc3QgaWQgPSBgZGV2XyR7cmFuZG9tQnl0ZXMoMTIpLnRvU3RyaW5nKFwiYmFzZTY0dXJsXCIpfWA7XG4gIHRyeSB7XG4gICAgd3JpdGVGaWxlU3luYyhmaWxlLCBKU09OLnN0cmluZ2lmeSh7IGNsaWVudElkOiBpZCB9LCBudWxsLCAyKSArIFwiXFxuXCIsIHtcbiAgICAgIG1vZGU6IDBvNjAwLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvKiBzdGlsbCB1c2FibGUgaW4tbWVtb3J5IGZvciB0aGlzIHNlc3Npb24gKi9cbiAgfVxuICByZXR1cm4gaWQ7XG59XG5cbi8qKiBVbmlxdWUgcGVyLWV2ZW50IG5vbmNlIGZvciBtZXRyaWMgZGVkdXBlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50Tm9uY2UoKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJhbmRvbVVVSUQoKTtcbn1cbiIsICJpbXBvcnQgeyB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFBvcnRmb2xpb1Jlc3BvbnNlLFxuICBTcG9uc29yLFxuICBTdXJmYWNlLFxufSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL2NvbnRyYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aFwiO1xuaW1wb3J0IHsgbWVhbndoaWxlRGlyIH0gZnJvbSBcIi4vY29uZmlnXCI7XG5pbXBvcnQgeyBmZXRjaEpzb24gfSBmcm9tIFwiLi9odHRwXCI7XG5pbXBvcnQgeyBkbG9nIH0gZnJvbSBcIi4vbG9nXCI7XG5cbi8qKiBPbi1kaXNrIGNhY2hlIGNvbnN1bWVkIGJ5IHRoZSBDTEkgc3VyZmFjZXMgKHN0YXR1c2xpbmUgc2NyaXB0LCB3cmFwcGVycykuXG4gKiAgVG9rZW5zIG5ldmVyIGFwcGVhciBoZXJlIFx1MjAxNCBvbmx5IGRpc3BsYXlhYmxlIHNwb25zb3IgZGF0YS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3BvbnNvckNhY2hlRmlsZSB7XG4gIHVwZGF0ZWRBdE1zOiBudW1iZXI7XG4gIHR0bE1zOiBudW1iZXI7XG4gIHJvdGF0aW9uSW50ZXJ2YWxNczogbnVtYmVyO1xuICB2aWV3VGhyZXNob2xkTXM6IG51bWJlcjtcbiAgc3BvbnNvcnM6IFNwb25zb3JbXTtcbn1cblxuZXhwb3J0IGNvbnN0IFNQT05TT1JfQ0FDSEVfRklMRSA9IFwic3BvbnNvcnMuanNvblwiO1xuXG4vKipcbiAqIEZldGNoZXMgYW5kIGNhY2hlcyB0aGUgc3BvbnNvciBwb3J0Zm9saW8uIE9uZSBzZXJ2aWNlIGluc3RhbmNlIHNlcnZlcyBldmVyeVxuICogc3VyZmFjZTogd2Vidmlld3MgcHVsbCBmcm9tIG1lbW9yeSB2aWEgdGhlIGxvb3BiYWNrLCBDTEkgc2NyaXB0cyByZWFkIHRoZVxuICogSlNPTiBjYWNoZSB0aGlzIHdyaXRlcyBhZnRlciBlYWNoIHJlZnJlc2guXG4gKi9cbmV4cG9ydCBjbGFzcyBQb3J0Zm9saW9TZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjdXJyZW50OiBQb3J0Zm9saW9SZXNwb25zZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGZldGNoZWRBdE1zID0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGF1dGg6IEF1dGhTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmFzZTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50SWQ6IHN0cmluZyxcbiAgKSB7fVxuXG4gIGdldCBwb3J0Zm9saW8oKTogUG9ydGZvbGlvUmVzcG9uc2UgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50O1xuICB9XG5cbiAgZ2V0IHN0YWxlKCk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5jdXJyZW50KSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSAtIHRoaXMuZmV0Y2hlZEF0TXMgPiB0aGlzLmN1cnJlbnQudHRsTXM7XG4gIH1cblxuICAvKiogVGhlIHNwb25zb3IgZm9yIFwibm93XCI6IHRpbWUtc2xvdCByb3RhdGlvbiB0aHJvdWdoIHRoZSBxdWV1ZSBzbyBldmVyeVxuICAgKiAgc3VyZmFjZSBzaG93cyB0aGUgc2FtZSBsaW5lIGF0IHRoZSBzYW1lIG1vbWVudCB3aXRob3V0IGNvb3JkaW5hdGlvbi4gKi9cbiAgY3VycmVudFNwb25zb3IoKTogU3BvbnNvciB8IG51bGwge1xuICAgIGNvbnN0IHAgPSB0aGlzLmN1cnJlbnQ7XG4gICAgaWYgKCFwIHx8IHAuc3BvbnNvcnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBzbG90ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gTWF0aC5tYXgocC5yb3RhdGlvbkludGVydmFsTXMsIDUwMDApKTtcbiAgICByZXR1cm4gcC5zcG9uc29yc1tzbG90ICUgcC5zcG9uc29ycy5sZW5ndGhdO1xuICB9XG5cbiAgYXN5bmMgcmVmcmVzaChzdXJmYWNlOiBTdXJmYWNlID0gXCJjY193ZWJ2aWV3XCIpOiBQcm9taXNlPFBvcnRmb2xpb1Jlc3BvbnNlIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwID0gYXdhaXQgdGhpcy5hdXRoLndpdGhBdXRoKChiZWFyZXIpID0+XG4gICAgICAgIGZldGNoSnNvbjxQb3J0Zm9saW9SZXNwb25zZT4oXG4gICAgICAgICAgdGhpcy5iYXNlICsgcm91dGVzLnBvcnRmb2xpbyhzdXJmYWNlLCB0aGlzLmNsaWVudElkKSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBoZWFkZXJzOiBiZWFyZXIgPyB7IGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtiZWFyZXJ9YCB9IDoge30sXG4gICAgICAgICAgfSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICB0aGlzLmN1cnJlbnQgPSBwO1xuICAgICAgdGhpcy5mZXRjaGVkQXRNcyA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLndyaXRlQ2xpQ2FjaGUocCk7XG4gICAgICBkbG9nKFwicG9ydGZvbGlvXCIsIFwicmVmcmVzaGVkXCIsIHtcbiAgICAgICAgbjogcC5zcG9uc29ycy5sZW5ndGgsXG4gICAgICAgIHNpZ25lZEluOiB0aGlzLmF1dGguc2lnbmVkSW4sXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBwO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRsb2coXCJwb3J0Zm9saW9cIiwgXCJyZWZyZXNoIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBNaXJyb3IgdGhlIGxhdGVzdCBwb3J0Zm9saW8gZm9yIG91dC1vZi1wcm9jZXNzIENMSSBzdXJmYWNlcy4gKi9cbiAgcHJpdmF0ZSB3cml0ZUNsaUNhY2hlKHA6IFBvcnRmb2xpb1Jlc3BvbnNlKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZTogU3BvbnNvckNhY2hlRmlsZSA9IHtcbiAgICAgIHVwZGF0ZWRBdE1zOiBEYXRlLm5vdygpLFxuICAgICAgdHRsTXM6IHAudHRsTXMsXG4gICAgICByb3RhdGlvbkludGVydmFsTXM6IHAucm90YXRpb25JbnRlcnZhbE1zLFxuICAgICAgdmlld1RocmVzaG9sZE1zOiBwLnZpZXdUaHJlc2hvbGRNcyxcbiAgICAgIHNwb25zb3JzOiBwLnNwb25zb3JzLFxuICAgIH07XG4gICAgdHJ5IHtcbiAgICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICAgIGpvaW4obWVhbndoaWxlRGlyKCksIFNQT05TT1JfQ0FDSEVfRklMRSksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGZpbGUsIG51bGwsIDIpICsgXCJcXG5cIixcbiAgICAgICAgeyBtb2RlOiAwbzYwMCB9LFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkbG9nKFwicG9ydGZvbGlvXCIsIFwiY2xpIGNhY2hlIHdyaXRlIGZhaWxlZFwiLCB7IGU6IFN0cmluZyhlKSB9KTtcbiAgICB9XG4gIH1cbn1cbiJdLAogICJtYXBw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QyxXQUFXLFVBQVUsQ0FBQztBQUNwRCxRQUFNLGtDQUFrQyxlQUFlLFdBQVc7QUFDbEUsUUFBTSxhQUFTLHlDQUFhLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBRSxVQUFVLFFBQVEsU0FBUyxJQUFNLENBQUMsRUFBRSxLQUFLO0FBQy9GLFFBQU0sOEJBQThCLFdBQVcsYUFBYSxNQUFNO0FBRWxFLGtDQUFPLHdCQUFLLElBQUksa0JBQWtCLEdBQUcsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUNwRCxVQUFRLElBQUksYUFBYSxJQUFJLGVBQWU7QUFBQSxFQUFLLFFBQVEsV0FBVztBQUNwRSxVQUFRLEtBQUssYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyQztBQUVBLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtBQUNsQixVQUFRLE1BQU0sdUJBQXVCLENBQUM7QUFDdEMsVUFBUSxLQUFLLENBQUM7QUFDaEIsQ0FBQzsiLAogICJuYW1lcyI6IFsiaW1wb3J0X25vZGVfY2hpbGRfcHJvY2VzcyIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9vcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX29zIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJiaW5EaXIiLCAiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIl0KfQo=
