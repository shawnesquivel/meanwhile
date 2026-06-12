"use strict";

// test/webview-live.ts
var import_node_crypto = require("node:crypto");
var import_node_fs4 = require("node:fs");
var import_node_path4 = require("node:path");
var import_esbuild = require("esbuild");

// src/adapters/claude-webview.ts
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

// src/adapters/webview-patch.ts
var SNIPPET_BEGIN = "/*<<MEANWHILE_SNIPPET>>*/";
var SNIPPET_END = "/*<</MEANWHILE_SNIPPET>>*/";
var CSP_CONNECT = "connect-src http://127.0.0.1:*";
var TEXT_CLASS_RE = /\{container:"container_([A-Za-z0-9_-]+)",icon:"icon_\1",text:"(text_\1)"\}/;
var CSP_ANCHOR_RE = /(content="default-src 'none'; )(\$\{)/;
var PatchAnchorError = class extends Error {
};
function extractSpinnerTextClass(webviewSrc) {
  const m = webviewSrc.match(TEXT_CLASS_RE);
  if (!m) {
    throw new PatchAnchorError(
      "spinner text class anchor not found (incompatible Claude Code build)"
    );
  }
  return m[2];
}
function fillSnippet(template, p) {
  return template.replaceAll("__MW_PORT__", String(p.port)).replaceAll("__MW_TOKEN__", p.token).replaceAll("__MW_TEXT_CLASS__", p.textClass);
}
function patchWebviewBundle(webviewSrc, filledSnippet) {
  const base = unpatchWebviewBundle(webviewSrc);
  const snippet = filledSnippet.endsWith("\n") ? filledSnippet : filledSnippet + "\n";
  return base + "\n" + snippet;
}
function unpatchWebviewBundle(webviewSrc) {
  const start = webviewSrc.indexOf(SNIPPET_BEGIN);
  if (start === -1) return webviewSrc;
  const end = webviewSrc.indexOf(SNIPPET_END);
  if (end === -1) return webviewSrc;
  let blockStart = start;
  if (blockStart > 0 && webviewSrc[blockStart - 1] === "\n") blockStart--;
  let blockEnd = end + SNIPPET_END.length;
  if (webviewSrc[blockEnd] === "\n") blockEnd++;
  return webviewSrc.slice(0, blockStart) + webviewSrc.slice(blockEnd);
}
function isCspPatched(extensionSrc) {
  return extensionSrc.includes(CSP_CONNECT);
}
function patchExtensionCsp(extensionSrc) {
  if (isCspPatched(extensionSrc)) return extensionSrc;
  if (!CSP_ANCHOR_RE.test(extensionSrc)) {
    throw new PatchAnchorError(
      "CSP anchor not found (incompatible Claude Code build)"
    );
  }
  return extensionSrc.replace(CSP_ANCHOR_RE, `$1${CSP_CONNECT}; $2`);
}
function unpatchExtensionCsp(extensionSrc) {
  return extensionSrc.replace(`${CSP_CONNECT}; `, "");
}

// src/adapters/claude-webview.ts
var STATE_FILE = "cc-webview-state.json";
function statePath() {
  return (0, import_node_path3.join)(meanwhileDir(), STATE_FILE);
}
function backupRoot() {
  return (0, import_node_path3.join)(meanwhileDir(), "backups", "cc-webview");
}
function findTargets() {
  const roots = [
    (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".cursor", "extensions"),
    (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".vscode", "extensions")
  ];
  const targets = [];
  for (const root of roots) {
    let entries = [];
    try {
      entries = (0, import_node_fs3.readdirSync)(root);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.startsWith("anthropic.claude-code-")) continue;
      const dir = (0, import_node_path3.join)(root, e);
      const webviewJs = (0, import_node_path3.join)(dir, "webview", "index.js");
      const extensionJs = (0, import_node_path3.join)(dir, "extension.js");
      if ((0, import_node_fs3.existsSync)(webviewJs) && (0, import_node_fs3.existsSync)(extensionJs)) {
        targets.push({ dir, webviewJs, extensionJs });
      }
    }
  }
  return targets;
}
var ClaudeWebviewAdapter = class {
  constructor() {
    this.id = "cc_webview";
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
  /**
   * Patch every detected build. Returns whether anything newly changed
   * (callers prompt for a window reload only then).
   */
  patch(opts) {
    const template = (0, import_node_fs3.readFileSync)(
      (0, import_node_path3.join)(opts.extensionDistDir, "adapters", "webview-snippet.asset.js"),
      "utf8"
    );
    const prior = this.loadState();
    const targets = findTargets();
    const state = { targets: [] };
    const failures2 = [];
    let changedAny = false;
    for (const t of targets) {
      try {
        const webviewSrc = (0, import_node_fs3.readFileSync)(t.webviewJs, "utf8");
        const extensionSrc = (0, import_node_fs3.readFileSync)(t.extensionJs, "utf8");
        const bdir = (0, import_node_path3.join)(backupRoot(), (0, import_node_path3.basename)(t.dir));
        (0, import_node_fs3.mkdirSync)(bdir, { recursive: true });
        const wvBackup = (0, import_node_path3.join)(bdir, "webview-index.js");
        const extBackup = (0, import_node_path3.join)(bdir, "extension.js");
        if (!(0, import_node_fs3.existsSync)(wvBackup)) {
          (0, import_node_fs3.writeFileSync)(wvBackup, unpatchWebviewBundle(webviewSrc));
        }
        if (!(0, import_node_fs3.existsSync)(extBackup)) {
          (0, import_node_fs3.writeFileSync)(extBackup, unpatchExtensionCsp(extensionSrc));
        }
        const textClass = extractSpinnerTextClass(webviewSrc);
        const filled = fillSnippet(template, {
          port: opts.port,
          token: opts.token,
          textClass
        });
        const nextWebview = patchWebviewBundle(webviewSrc, filled);
        if (nextWebview !== webviewSrc) {
          (0, import_node_fs3.writeFileSync)(t.webviewJs, nextWebview);
          changedAny = true;
        }
        if (!isCspPatched(extensionSrc)) {
          (0, import_node_fs3.writeFileSync)(t.extensionJs, patchExtensionCsp(extensionSrc));
          changedAny = true;
        }
        state.targets.push({ dir: t.dir, patchedAtMs: Date.now() });
        dlog("cc-webview", "patched", { dir: (0, import_node_path3.basename)(t.dir), textClass });
      } catch (e) {
        const why = e instanceof PatchAnchorError ? e.message : `io: ${String(e)}`;
        failures2.push(`${(0, import_node_path3.basename)(t.dir)}: ${why}`);
        dlog("cc-webview", "patch failed", { dir: t.dir, why });
      }
    }
    if (prior) {
      for (const old of prior.targets) {
        if (!state.targets.some((s) => s.dir === old.dir)) {
          state.targets.push(old);
        }
      }
    }
    if (state.targets.length > 0) {
      (0, import_node_fs3.writeFileSync)(statePath(), JSON.stringify(state, null, 2) + "\n");
    }
    return { changedAny, patched: state.targets.length, failures: failures2 };
  }
  /** Copy byte-exact originals back over every patched build. */
  restore() {
    const state = this.loadState();
    if (!state) return { ok: true, restored: 0, detail: "nothing to restore" };
    let restored = 0;
    const problems = [];
    for (const t of state.targets) {
      const bdir = (0, import_node_path3.join)(backupRoot(), (0, import_node_path3.basename)(t.dir));
      const wvBackup = (0, import_node_path3.join)(bdir, "webview-index.js");
      const extBackup = (0, import_node_path3.join)(bdir, "extension.js");
      try {
        if (!(0, import_node_fs3.existsSync)(t.dir)) continue;
        if ((0, import_node_fs3.existsSync)(wvBackup)) {
          (0, import_node_fs3.copyFileSync)(wvBackup, (0, import_node_path3.join)(t.dir, "webview", "index.js"));
        }
        if ((0, import_node_fs3.existsSync)(extBackup)) {
          (0, import_node_fs3.copyFileSync)(extBackup, (0, import_node_path3.join)(t.dir, "extension.js"));
        }
        restored++;
      } catch (e) {
        problems.push(`${(0, import_node_path3.basename)(t.dir)}: ${String(e)}`);
      }
    }
    if (problems.length > 0) {
      return { ok: false, restored, detail: problems.join("; ") };
    }
    (0, import_node_fs3.rmSync)(statePath(), { force: true });
    dlog("cc-webview", "restored", { restored });
    return { ok: true, restored };
  }
};

// test/webview-live.ts
var failures = 0;
var check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " \u2014 " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
var sha = (s) => (0, import_node_crypto.createHash)("sha256").update(s).digest("hex");
function parses(src) {
  try {
    (0, import_esbuild.transformSync)(src, { loader: "js", minify: false });
    return true;
  } catch {
    return false;
  }
}
async function main() {
  setDebug(true);
  const targets = findTargets();
  check("found installed Claude Code builds", targets.length > 0, targets.length);
  if (targets.length === 0) process.exit(1);
  console.log("  targets:", targets.map((t) => t.dir.split("/").slice(-1)[0]).join(", "));
  const originals = /* @__PURE__ */ new Map();
  for (const t of targets) {
    originals.set(t.dir, {
      wv: sha((0, import_node_fs4.readFileSync)(t.webviewJs, "utf8")),
      ext: sha((0, import_node_fs4.readFileSync)(t.extensionJs, "utf8"))
    });
  }
  const adapter = new ClaudeWebviewAdapter();
  const res = adapter.patch({
    extensionDistDir: (0, import_node_path4.join)(process.cwd(), "dist"),
    port: 48757,
    token: "tok_live_test"
  });
  check("patch reported changes", res.changedAny, res);
  check("no per-build failures", res.failures.length === 0, res.failures);
  check("adapter reports patched", adapter.isPatched());
  for (const t of targets) {
    const name = t.dir.split("/").slice(-1)[0];
    const wv = (0, import_node_fs4.readFileSync)(t.webviewJs, "utf8");
    const ext = (0, import_node_fs4.readFileSync)(t.extensionJs, "utf8");
    check(`[${name}] snippet present`, wv.includes(SNIPPET_BEGIN));
    check(`[${name}] port+token baked in`, wv.includes("48757") && wv.includes("tok_live_test"));
    check(
      `[${name}] text class baked in`,
      /var TEXT_CLASS = "text_[A-Za-z0-9_-]+"/.test(wv)
    );
    check(`[${name}] CSP has loopback connect-src`, ext.includes(CSP_CONNECT));
    check(`[${name}] patched webview parses as JS`, parses(wv));
    check(`[${name}] patched extension parses as JS`, parses(ext));
  }
  const res2 = adapter.patch({
    extensionDistDir: (0, import_node_path4.join)(process.cwd(), "dist"),
    port: 48757,
    token: "tok_live_test"
  });
  check("re-patch is a no-op", !res2.changedAny, res2);
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  check("restored every build", r.restored === targets.length, r);
  for (const t of targets) {
    const name = t.dir.split("/").slice(-1)[0];
    const o = originals.get(t.dir);
    check(
      `[${name}] webview byte-identical after restore`,
      sha((0, import_node_fs4.readFileSync)(t.webviewJs, "utf8")) === o?.wv
    );
    check(
      `[${name}] extension byte-identical after restore`,
      sha((0, import_node_fs4.readFileSync)(t.extensionJs, "utf8")) === o?.ext
    );
  }
  check("adapter state cleared", !adapter.isPatched());
  console.log(failures === 0 ? "\nALL PASS" : `
${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("webview-live crashed:", e);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vdGVzdC93ZWJ2aWV3LWxpdmUudHMiLCAiLi4vc3JjL2FkYXB0ZXJzL2NsYXVkZS13ZWJ2aWV3LnRzIiwgIi4uL3NyYy9jb25maWcudHMiLCAiLi4vc3JjL2xvZy50cyIsICIuLi9zcmMvYWRhcHRlcnMvd2Vidmlldy1wYXRjaC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TeW5jIH0gZnJvbSBcImVzYnVpbGRcIjtcbmltcG9ydCB7IENsYXVkZVdlYnZpZXdBZGFwdGVyLCBmaW5kVGFyZ2V0cyB9IGZyb20gXCIuLi9zcmMvYWRhcHRlcnMvY2xhdWRlLXdlYnZpZXdcIjtcbmltcG9ydCB7IENTUF9DT05ORUNULCBTTklQUEVUX0JFR0lOIH0gZnJvbSBcIi4uL3NyYy9hZGFwdGVycy93ZWJ2aWV3LXBhdGNoXCI7XG5pbXBvcnQgeyBzZXREZWJ1ZyB9IGZyb20gXCIuLi9zcmMvbG9nXCI7XG5cbi8qKlxuICogTElWRSBNMWUgdGVzdDogcGF0Y2hlcyBldmVyeSBpbnN0YWxsZWQgQ2xhdWRlIENvZGUgYnVpbGQgKEN1cnNvciArXG4gKiBWUyBDb2RlKSwgcHJvdmVzIHRoZSBwYXRjaGVkIGJ1bmRsZXMgc3RpbGwgcGFyc2UgYXMgSmF2YVNjcmlwdCBhbmQgY2FycnlcbiAqIHRoZSBsb29wYmFjayB3aXJpbmcsIHRoZW4gcmVzdG9yZXMgYnl0ZS1leGFjdCBvcmlnaW5hbHMgKGhhc2gtdmVyaWZpZWQpLlxuICovXG5cbmxldCBmYWlsdXJlcyA9IDA7XG5jb25zdCBjaGVjayA9IChuYW1lOiBzdHJpbmcsIG9rOiBib29sZWFuLCBkZXRhaWw/OiB1bmtub3duKSA9PiB7XG4gIGNvbnNvbGUubG9nKGAke29rID8gXCJQQVNTXCIgOiBcIkZBSUxcIn0gICR7bmFtZX0ke29rID8gXCJcIiA6IFwiIFx1MjAxNCBcIiArIEpTT04uc3RyaW5naWZ5KGRldGFpbCl9YCk7XG4gIGlmICghb2spIGZhaWx1cmVzKys7XG59O1xuXG5jb25zdCBzaGEgPSAoczogc3RyaW5nKSA9PiBjcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZShzKS5kaWdlc3QoXCJoZXhcIik7XG5cbmZ1bmN0aW9uIHBhcnNlcyhzcmM6IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIHRyYW5zZm9ybVN5bmMoc3JjLCB7IGxvYWRlcjogXCJqc1wiLCBtaW5pZnk6IGZhbHNlIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgc2V0RGVidWcodHJ1ZSk7XG4gIGNvbnN0IHRhcmdldHMgPSBmaW5kVGFyZ2V0cygpO1xuICBjaGVjayhcImZvdW5kIGluc3RhbGxlZCBDbGF1ZGUgQ29kZSBidWlsZHNcIiwgdGFyZ2V0cy5sZW5ndGggPiAwLCB0YXJnZXRzLmxlbmd0aCk7XG4gIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkgcHJvY2Vzcy5leGl0KDEpO1xuICBjb25zb2xlLmxvZyhcIiAgdGFyZ2V0czpcIiwgdGFyZ2V0cy5tYXAoKHQpID0+IHQuZGlyLnNwbGl0KFwiL1wiKS5zbGljZSgtMSlbMF0pLmpvaW4oXCIsIFwiKSk7XG5cbiAgY29uc3Qgb3JpZ2luYWxzID0gbmV3IE1hcDxzdHJpbmcsIHsgd3Y6IHN0cmluZzsgZXh0OiBzdHJpbmcgfT4oKTtcbiAgZm9yIChjb25zdCB0IG9mIHRhcmdldHMpIHtcbiAgICBvcmlnaW5hbHMuc2V0KHQuZGlyLCB7XG4gICAgICB3djogc2hhKHJlYWRGaWxlU3luYyh0LndlYnZpZXdKcywgXCJ1dGY4XCIpKSxcbiAgICAgIGV4dDogc2hhKHJlYWRGaWxlU3luYyh0LmV4dGVuc2lvbkpzLCBcInV0ZjhcIikpLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gMSkgcGF0Y2ggYWxsIGJ1aWxkcyB3aXRoIGEgZmFrZS1idXQtc2hhcGVkIGxvb3BiYWNrIGlkZW50aXR5XG4gIGNvbnN0IGFkYXB0ZXIgPSBuZXcgQ2xhdWRlV2Vidmlld0FkYXB0ZXIoKTtcbiAgY29uc3QgcmVzID0gYWRhcHRlci5wYXRjaCh7XG4gICAgZXh0ZW5zaW9uRGlzdERpcjogam9pbihwcm9jZXNzLmN3ZCgpLCBcImRpc3RcIiksXG4gICAgcG9ydDogNDg3NTcsXG4gICAgdG9rZW46IFwidG9rX2xpdmVfdGVzdFwiLFxuICB9KTtcbiAgY2hlY2soXCJwYXRjaCByZXBvcnRlZCBjaGFuZ2VzXCIsIHJlcy5jaGFuZ2VkQW55LCByZXMpO1xuICBjaGVjayhcIm5vIHBlci1idWlsZCBmYWlsdXJlc1wiLCByZXMuZmFpbHVyZXMubGVuZ3RoID09PSAwLCByZXMuZmFpbHVyZXMpO1xuICBjaGVjayhcImFkYXB0ZXIgcmVwb3J0cyBwYXRjaGVkXCIsIGFkYXB0ZXIuaXNQYXRjaGVkKCkpO1xuXG4gIGZvciAoY29uc3QgdCBvZiB0YXJnZXRzKSB7XG4gICAgY29uc3QgbmFtZSA9IHQuZGlyLnNwbGl0KFwiL1wiKS5zbGljZSgtMSlbMF07XG4gICAgY29uc3Qgd3YgPSByZWFkRmlsZVN5bmModC53ZWJ2aWV3SnMsIFwidXRmOFwiKTtcbiAgICBjb25zdCBleHQgPSByZWFkRmlsZVN5bmModC5leHRlbnNpb25KcywgXCJ1dGY4XCIpO1xuICAgIGNoZWNrKGBbJHtuYW1lfV0gc25pcHBldCBwcmVzZW50YCwgd3YuaW5jbHVkZXMoU05JUFBFVF9CRUdJTikpO1xuICAgIGNoZWNrKGBbJHtuYW1lfV0gcG9ydCt0b2tlbiBiYWtlZCBpbmAsIHd2LmluY2x1ZGVzKFwiNDg3NTdcIikgJiYgd3YuaW5jbHVkZXMoXCJ0b2tfbGl2ZV90ZXN0XCIpKTtcbiAgICBjaGVjayhcbiAgICAgIGBbJHtuYW1lfV0gdGV4dCBjbGFzcyBiYWtlZCBpbmAsXG4gICAgICAvdmFyIFRFWFRfQ0xBU1MgPSBcInRleHRfW0EtWmEtejAtOV8tXStcIi8udGVzdCh3diksXG4gICAgKTtcbiAgICBjaGVjayhgWyR7bmFtZX1dIENTUCBoYXMgbG9vcGJhY2sgY29ubmVjdC1zcmNgLCBleHQuaW5jbHVkZXMoQ1NQX0NPTk5FQ1QpKTtcbiAgICBjaGVjayhgWyR7bmFtZX1dIHBhdGNoZWQgd2VidmlldyBwYXJzZXMgYXMgSlNgLCBwYXJzZXMod3YpKTtcbiAgICBjaGVjayhgWyR7bmFtZX1dIHBhdGNoZWQgZXh0ZW5zaW9uIHBhcnNlcyBhcyBKU2AsIHBhcnNlcyhleHQpKTtcbiAgfVxuXG4gIC8vIDIpIGlkZW1wb3RlbmN5OiBzZWNvbmQgcGF0Y2ggd2l0aCBzYW1lIHBhcmFtcyBjaGFuZ2VzIG5vdGhpbmdcbiAgY29uc3QgcmVzMiA9IGFkYXB0ZXIucGF0Y2goe1xuICAgIGV4dGVuc2lvbkRpc3REaXI6IGpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJkaXN0XCIpLFxuICAgIHBvcnQ6IDQ4NzU3LFxuICAgIHRva2VuOiBcInRva19saXZlX3Rlc3RcIixcbiAgfSk7XG4gIGNoZWNrKFwicmUtcGF0Y2ggaXMgYSBuby1vcFwiLCAhcmVzMi5jaGFuZ2VkQW55LCByZXMyKTtcblxuICAvLyAzKSByZXN0b3JlIFx1MjE5MiBieXRlLWV4YWN0IG9yaWdpbmFsc1xuICBjb25zdCByID0gYWRhcHRlci5yZXN0b3JlKCk7XG4gIGNoZWNrKFwicmVzdG9yZSBva1wiLCByLm9rLCByKTtcbiAgY2hlY2soXCJyZXN0b3JlZCBldmVyeSBidWlsZFwiLCByLnJlc3RvcmVkID09PSB0YXJnZXRzLmxlbmd0aCwgcik7XG4gIGZvciAoY29uc3QgdCBvZiB0YXJnZXRzKSB7XG4gICAgY29uc3QgbmFtZSA9IHQuZGlyLnNwbGl0KFwiL1wiKS5zbGljZSgtMSlbMF07XG4gICAgY29uc3QgbyA9IG9yaWdpbmFscy5nZXQodC5kaXIpO1xuICAgIGNoZWNrKFxuICAgICAgYFske25hbWV9XSB3ZWJ2aWV3IGJ5dGUtaWRlbnRpY2FsIGFmdGVyIHJlc3RvcmVgLFxuICAgICAgc2hhKHJlYWRGaWxlU3luYyh0LndlYnZpZXdKcywgXCJ1dGY4XCIpKSA9PT0gbz8ud3YsXG4gICAgKTtcbiAgICBjaGVjayhcbiAgICAgIGBbJHtuYW1lfV0gZXh0ZW5zaW9uIGJ5dGUtaWRlbnRpY2FsIGFmdGVyIHJlc3RvcmVgLFxuICAgICAgc2hhKHJlYWRGaWxlU3luYyh0LmV4dGVuc2lvbkpzLCBcInV0ZjhcIikpID09PSBvPy5leHQsXG4gICAgKTtcbiAgfVxuICBjaGVjayhcImFkYXB0ZXIgc3RhdGUgY2xlYXJlZFwiLCAhYWRhcHRlci5pc1BhdGNoZWQoKSk7XG5cbiAgY29uc29sZS5sb2coZmFpbHVyZXMgPT09IDAgPyBcIlxcbkFMTCBQQVNTXCIgOiBgXFxuJHtmYWlsdXJlc30gRkFJTFVSRVNgKTtcbiAgcHJvY2Vzcy5leGl0KGZhaWx1cmVzID09PSAwID8gMCA6IDEpO1xufVxuXG5tYWluKCkuY2F0Y2goKGUpID0+IHtcbiAgY29uc29sZS5lcnJvcihcIndlYnZpZXctbGl2ZSBjcmFzaGVkOlwiLCBlKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufSk7XG4iLCAiaW1wb3J0IHtcbiAgY29weUZpbGVTeW5jLFxuICBleGlzdHNTeW5jLFxuICBta2RpclN5bmMsXG4gIHJlYWRkaXJTeW5jLFxuICByZWFkRmlsZVN5bmMsXG4gIHJtU3luYyxcbiAgd3JpdGVGaWxlU3luYyxcbn0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tIFwibm9kZTpvc1wiO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBkbG9nIH0gZnJvbSBcIi4uL2xvZ1wiO1xuaW1wb3J0IHtcbiAgZXh0cmFjdFNwaW5uZXJUZXh0Q2xhc3MsXG4gIGZpbGxTbmlwcGV0LFxuICBpc0NzcFBhdGNoZWQsXG4gIHBhdGNoRXh0ZW5zaW9uQ3NwLFxuICBwYXRjaFdlYnZpZXdCdW5kbGUsXG4gIFBhdGNoQW5jaG9yRXJyb3IsXG4gIHVucGF0Y2hFeHRlbnNpb25Dc3AsXG4gIHVucGF0Y2hXZWJ2aWV3QnVuZGxlLFxufSBmcm9tIFwiLi93ZWJ2aWV3LXBhdGNoXCI7XG5cbi8qKlxuICogQ2xhdWRlIENvZGUgVlMgQ29kZS9DdXJzb3Igd2VidmlldyBhZGFwdGVyLlxuICpcbiAqIFRoZSBzcGlubmVyIHRleHQgaXRzZWxmIGlzIGFscmVhZHkgc3BvbnNvcmVkIHZpYSB0aGUgc3Bpbm5lclZlcmJzIHNldHRpbmdcbiAqIChNMWMpLiBUaGlzIGFkYXB0ZXIgbWFrZXMgdGhlIHdlYnZpZXcgbGluZSBtZWFzdXJhYmxlIGFuZCBjbGlja2FibGU6XG4gKiAgIHdlYnZpZXcvaW5kZXguanMgICsgTWVhbndoaWxlIHJ1bnRpbWUgc25pcHBldCAobG9vcGJhY2stY29ubmVjdGVkKVxuICogICBleHRlbnNpb24uanMgICAgICArIGNvbm5lY3Qtc3JjIGZvciAxMjcuMC4wLjEgaW4gdGhlIHdlYnZpZXcgQ1NQXG4gKlxuICogQnl0ZS1leGFjdCBvcmlnaW5hbHMgYXJlIHN0b3JlZCB1bmRlciB+Ly5tZWFud2hpbGUvYmFja3Vwcy9jYy13ZWJ2aWV3L1xuICogYmVmb3JlIGFueSB3cml0ZTsgcmVzdG9yZSBjb3BpZXMgdGhlbSBiYWNrIHZlcmJhdGltLlxuICovXG5cbmNvbnN0IFNUQVRFX0ZJTEUgPSBcImNjLXdlYnZpZXctc3RhdGUuanNvblwiO1xuXG5pbnRlcmZhY2UgVGFyZ2V0U3RhdGUge1xuICBkaXI6IHN0cmluZztcbiAgcGF0Y2hlZEF0TXM6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFdlYnZpZXdTdGF0ZSB7XG4gIHRhcmdldHM6IFRhcmdldFN0YXRlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2Vidmlld1RhcmdldCB7XG4gIGRpcjogc3RyaW5nO1xuICB3ZWJ2aWV3SnM6IHN0cmluZztcbiAgZXh0ZW5zaW9uSnM6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gc3RhdGVQYXRoKCk6IHN0cmluZyB7XG4gIHJldHVybiBqb2luKG1lYW53aGlsZURpcigpLCBTVEFURV9GSUxFKTtcbn1cblxuZnVuY3Rpb24gYmFja3VwUm9vdCgpOiBzdHJpbmcge1xuICByZXR1cm4gam9pbihtZWFud2hpbGVEaXIoKSwgXCJiYWNrdXBzXCIsIFwiY2Mtd2Vidmlld1wiKTtcbn1cblxuLyoqIEV2ZXJ5IGluc3RhbGxlZCBDbGF1ZGUgQ29kZSBleHRlbnNpb24gYnVpbGQgYWNyb3NzIGVkaXRvcnMuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZFRhcmdldHMoKTogV2Vidmlld1RhcmdldFtdIHtcbiAgY29uc3Qgcm9vdHMgPSBbXG4gICAgam9pbihob21lZGlyKCksIFwiLmN1cnNvclwiLCBcImV4dGVuc2lvbnNcIiksXG4gICAgam9pbihob21lZGlyKCksIFwiLnZzY29kZVwiLCBcImV4dGVuc2lvbnNcIiksXG4gIF07XG4gIGNvbnN0IHRhcmdldHM6IFdlYnZpZXdUYXJnZXRbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHJvb3Qgb2Ygcm9vdHMpIHtcbiAgICBsZXQgZW50cmllczogc3RyaW5nW10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgZW50cmllcyA9IHJlYWRkaXJTeW5jKHJvb3QpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XG4gICAgICBpZiAoIWUuc3RhcnRzV2l0aChcImFudGhyb3BpYy5jbGF1ZGUtY29kZS1cIikpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGlyID0gam9pbihyb290LCBlKTtcbiAgICAgIGNvbnN0IHdlYnZpZXdKcyA9IGpvaW4oZGlyLCBcIndlYnZpZXdcIiwgXCJpbmRleC5qc1wiKTtcbiAgICAgIGNvbnN0IGV4dGVuc2lvbkpzID0gam9pbihkaXIsIFwiZXh0ZW5zaW9uLmpzXCIpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMod2Vidmlld0pzKSAmJiBleGlzdHNTeW5jKGV4dGVuc2lvbkpzKSkge1xuICAgICAgICB0YXJnZXRzLnB1c2goeyBkaXIsIHdlYnZpZXdKcywgZXh0ZW5zaW9uSnMgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB0YXJnZXRzO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhdWRlV2Vidmlld0FkYXB0ZXIge1xuICByZWFkb25seSBpZCA9IFwiY2Nfd2Vidmlld1wiO1xuXG4gIGlzUGF0Y2hlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZXhpc3RzU3luYyhzdGF0ZVBhdGgoKSk7XG4gIH1cblxuICBwcml2YXRlIGxvYWRTdGF0ZSgpOiBXZWJ2aWV3U3RhdGUgfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHN0YXRlUGF0aCgpLCBcInV0ZjhcIikpIGFzIFdlYnZpZXdTdGF0ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQYXRjaCBldmVyeSBkZXRlY3RlZCBidWlsZC4gUmV0dXJucyB3aGV0aGVyIGFueXRoaW5nIG5ld2x5IGNoYW5nZWRcbiAgICogKGNhbGxlcnMgcHJvbXB0IGZvciBhIHdpbmRvdyByZWxvYWQgb25seSB0aGVuKS5cbiAgICovXG4gIHBhdGNoKG9wdHM6IHtcbiAgICBleHRlbnNpb25EaXN0RGlyOiBzdHJpbmc7XG4gICAgcG9ydDogbnVtYmVyO1xuICAgIHRva2VuOiBzdHJpbmc7XG4gIH0pOiB7IGNoYW5nZWRBbnk6IGJvb2xlYW47IHBhdGNoZWQ6IG51bWJlcjsgZmFpbHVyZXM6IHN0cmluZ1tdIH0ge1xuICAgIGNvbnN0IHRlbXBsYXRlID0gcmVhZEZpbGVTeW5jKFxuICAgICAgam9pbihvcHRzLmV4dGVuc2lvbkRpc3REaXIsIFwiYWRhcHRlcnNcIiwgXCJ3ZWJ2aWV3LXNuaXBwZXQuYXNzZXQuanNcIiksXG4gICAgICBcInV0ZjhcIixcbiAgICApO1xuXG4gICAgY29uc3QgcHJpb3IgPSB0aGlzLmxvYWRTdGF0ZSgpO1xuICAgIGNvbnN0IHRhcmdldHMgPSBmaW5kVGFyZ2V0cygpO1xuICAgIGNvbnN0IHN0YXRlOiBXZWJ2aWV3U3RhdGUgPSB7IHRhcmdldHM6IFtdIH07XG4gICAgY29uc3QgZmFpbHVyZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGNoYW5nZWRBbnkgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgdCBvZiB0YXJnZXRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB3ZWJ2aWV3U3JjID0gcmVhZEZpbGVTeW5jKHQud2Vidmlld0pzLCBcInV0ZjhcIik7XG4gICAgICAgIGNvbnN0IGV4dGVuc2lvblNyYyA9IHJlYWRGaWxlU3luYyh0LmV4dGVuc2lvbkpzLCBcInV0ZjhcIik7XG5cbiAgICAgICAgLy8gS2VlcCB0aGUgb3JpZ2luYWwgYnl0ZXMgZnJvbSB0aGUgRklSU1QgdGltZSB3ZSBldmVyIHRvdWNoIGEgYnVpbGQuXG4gICAgICAgIGNvbnN0IGJkaXIgPSBqb2luKGJhY2t1cFJvb3QoKSwgYmFzZW5hbWUodC5kaXIpKTtcbiAgICAgICAgbWtkaXJTeW5jKGJkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBjb25zdCB3dkJhY2t1cCA9IGpvaW4oYmRpciwgXCJ3ZWJ2aWV3LWluZGV4LmpzXCIpO1xuICAgICAgICBjb25zdCBleHRCYWNrdXAgPSBqb2luKGJkaXIsIFwiZXh0ZW5zaW9uLmpzXCIpO1xuICAgICAgICBpZiAoIWV4aXN0c1N5bmMod3ZCYWNrdXApKSB7XG4gICAgICAgICAgd3JpdGVGaWxlU3luYyh3dkJhY2t1cCwgdW5wYXRjaFdlYnZpZXdCdW5kbGUod2Vidmlld1NyYykpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZXhpc3RzU3luYyhleHRCYWNrdXApKSB7XG4gICAgICAgICAgd3JpdGVGaWxlU3luYyhleHRCYWNrdXAsIHVucGF0Y2hFeHRlbnNpb25Dc3AoZXh0ZW5zaW9uU3JjKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ZXh0Q2xhc3MgPSBleHRyYWN0U3Bpbm5lclRleHRDbGFzcyh3ZWJ2aWV3U3JjKTtcbiAgICAgICAgY29uc3QgZmlsbGVkID0gZmlsbFNuaXBwZXQodGVtcGxhdGUsIHtcbiAgICAgICAgICBwb3J0OiBvcHRzLnBvcnQsXG4gICAgICAgICAgdG9rZW46IG9wdHMudG9rZW4sXG4gICAgICAgICAgdGV4dENsYXNzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBuZXh0V2VidmlldyA9IHBhdGNoV2Vidmlld0J1bmRsZSh3ZWJ2aWV3U3JjLCBmaWxsZWQpO1xuICAgICAgICBpZiAobmV4dFdlYnZpZXcgIT09IHdlYnZpZXdTcmMpIHtcbiAgICAgICAgICB3cml0ZUZpbGVTeW5jKHQud2Vidmlld0pzLCBuZXh0V2Vidmlldyk7XG4gICAgICAgICAgY2hhbmdlZEFueSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzQ3NwUGF0Y2hlZChleHRlbnNpb25TcmMpKSB7XG4gICAgICAgICAgd3JpdGVGaWxlU3luYyh0LmV4dGVuc2lvbkpzLCBwYXRjaEV4dGVuc2lvbkNzcChleHRlbnNpb25TcmMpKTtcbiAgICAgICAgICBjaGFuZ2VkQW55ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLnRhcmdldHMucHVzaCh7IGRpcjogdC5kaXIsIHBhdGNoZWRBdE1zOiBEYXRlLm5vdygpIH0pO1xuICAgICAgICBkbG9nKFwiY2Mtd2Vidmlld1wiLCBcInBhdGNoZWRcIiwgeyBkaXI6IGJhc2VuYW1lKHQuZGlyKSwgdGV4dENsYXNzIH0pO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB3aHkgPVxuICAgICAgICAgIGUgaW5zdGFuY2VvZiBQYXRjaEFuY2hvckVycm9yID8gZS5tZXNzYWdlIDogYGlvOiAke1N0cmluZyhlKX1gO1xuICAgICAgICBmYWlsdXJlcy5wdXNoKGAke2Jhc2VuYW1lKHQuZGlyKX06ICR7d2h5fWApO1xuICAgICAgICBkbG9nKFwiY2Mtd2Vidmlld1wiLCBcInBhdGNoIGZhaWxlZFwiLCB7IGRpcjogdC5kaXIsIHdoeSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1lbWJlciBkaXJzIHdlIHBhdGNoZWQgZWFybGllciBldmVuIGlmIHRoZXkgdmFuaXNoZWQgdGhpcyByb3VuZFxuICAgIC8vICh1bmluc3RhbGxlZCBidWlsZHMpIHNvIHJlc3RvcmUgc3RheXMgZXhoYXVzdGl2ZS5cbiAgICBpZiAocHJpb3IpIHtcbiAgICAgIGZvciAoY29uc3Qgb2xkIG9mIHByaW9yLnRhcmdldHMpIHtcbiAgICAgICAgaWYgKCFzdGF0ZS50YXJnZXRzLnNvbWUoKHMpID0+IHMuZGlyID09PSBvbGQuZGlyKSkge1xuICAgICAgICAgIHN0YXRlLnRhcmdldHMucHVzaChvbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlLnRhcmdldHMubGVuZ3RoID4gMCkge1xuICAgICAgd3JpdGVGaWxlU3luYyhzdGF0ZVBhdGgoKSwgSlNPTi5zdHJpbmdpZnkoc3RhdGUsIG51bGwsIDIpICsgXCJcXG5cIik7XG4gICAgfVxuICAgIHJldHVybiB7IGNoYW5nZWRBbnksIHBhdGNoZWQ6IHN0YXRlLnRhcmdldHMubGVuZ3RoLCBmYWlsdXJlcyB9O1xuICB9XG5cbiAgLyoqIENvcHkgYnl0ZS1leGFjdCBvcmlnaW5hbHMgYmFjayBvdmVyIGV2ZXJ5IHBhdGNoZWQgYnVpbGQuICovXG4gIHJlc3RvcmUoKTogeyBvazogYm9vbGVhbjsgcmVzdG9yZWQ6IG51bWJlcjsgZGV0YWlsPzogc3RyaW5nIH0ge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5sb2FkU3RhdGUoKTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm4geyBvazogdHJ1ZSwgcmVzdG9yZWQ6IDAsIGRldGFpbDogXCJub3RoaW5nIHRvIHJlc3RvcmVcIiB9O1xuXG4gICAgbGV0IHJlc3RvcmVkID0gMDtcbiAgICBjb25zdCBwcm9ibGVtczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHQgb2Ygc3RhdGUudGFyZ2V0cykge1xuICAgICAgY29uc3QgYmRpciA9IGpvaW4oYmFja3VwUm9vdCgpLCBiYXNlbmFtZSh0LmRpcikpO1xuICAgICAgY29uc3Qgd3ZCYWNrdXAgPSBqb2luKGJkaXIsIFwid2Vidmlldy1pbmRleC5qc1wiKTtcbiAgICAgIGNvbnN0IGV4dEJhY2t1cCA9IGpvaW4oYmRpciwgXCJleHRlbnNpb24uanNcIik7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoIWV4aXN0c1N5bmModC5kaXIpKSBjb250aW51ZTsgLy8gYnVpbGQgd2FzIHVuaW5zdGFsbGVkXG4gICAgICAgIGlmIChleGlzdHNTeW5jKHd2QmFja3VwKSkge1xuICAgICAgICAgIGNvcHlGaWxlU3luYyh3dkJhY2t1cCwgam9pbih0LmRpciwgXCJ3ZWJ2aWV3XCIsIFwiaW5kZXguanNcIikpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleGlzdHNTeW5jKGV4dEJhY2t1cCkpIHtcbiAgICAgICAgICBjb3B5RmlsZVN5bmMoZXh0QmFja3VwLCBqb2luKHQuZGlyLCBcImV4dGVuc2lvbi5qc1wiKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdG9yZWQrKztcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcHJvYmxlbXMucHVzaChgJHtiYXNlbmFtZSh0LmRpcil9OiAke1N0cmluZyhlKX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocHJvYmxlbXMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN0b3JlZCwgZGV0YWlsOiBwcm9ibGVtcy5qb2luKFwiOyBcIikgfTtcbiAgICB9XG4gICAgcm1TeW5jKHN0YXRlUGF0aCgpLCB7IGZvcmNlOiB0cnVlIH0pO1xuICAgIGRsb2coXCJjYy13ZWJ2aWV3XCIsIFwicmVzdG9yZWRcIiwgeyByZXN0b3JlZCB9KTtcbiAgICByZXR1cm4geyBvazogdHJ1ZSwgcmVzdG9yZWQgfTtcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHZzY29kZSBmcm9tIFwidnNjb2RlXCI7XG5pbXBvcnQgeyBob21lZGlyIH0gZnJvbSBcIm5vZGU6b3NcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCBta2RpclN5bmMsIHJlYWRGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5cbi8qKlxuICogRWZmZWN0aXZlIGV4dGVuc2lvbiBjb25maWd1cmF0aW9uLCByZXNvbHZlZCBmcm9tIChoaWdoZXN0IHByZWNlZGVuY2UgZmlyc3QpOlxuICogICAxLiBWUyBDb2RlIHNldHRpbmdzIChgbWVhbndoaWxlLipgKVxuICogICAyLiB+Ly5tZWFud2hpbGUvY29uZmlnLmpzb24gIChwb3dlci11c2VyIC8gaGVhZGxlc3Mgb3ZlcnJpZGUpXG4gKiAgIDMuIGVudmlyb25tZW50IChNRUFOV0hJTEVfQkFTRSwgTUVBTldISUxFX0RFQlVHKVxuICogICA0LiBjb21waWxlZC1pbiBkZWZhdWx0c1xuICpcbiAqIFJlYWRzIGFyZSBiZXN0LWVmZm9ydDogYSBtaXNzaW5nL2Jyb2tlbiBmaWxlIG9yIHNldHRpbmcgZmFsbHMgdGhyb3VnaCB0byB0aGVcbiAqIG5leHQgc291cmNlIHNvIGFjdGl2YXRpb24gY2FuIG5ldmVyIGJlIGJyb2tlbiBieSBjb25maWcuXG4gKi9cblxuY29uc3QgREVGQVVMVF9CQUNLRU5EX0JBU0UgPSBcImh0dHA6Ly8xMjcuMC4wLjE6MzAwMFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lYW53aGlsZUNvbmZpZyB7XG4gIGJhY2tlbmRCYXNlVXJsOiBzdHJpbmc7XG4gIGRlYnVnOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWVhbndoaWxlRGlyKCk6IHN0cmluZyB7XG4gIGNvbnN0IGRpciA9IGpvaW4oaG9tZWRpcigpLCBcIi5tZWFud2hpbGVcIik7XG4gIHRyeSB7XG4gICAgaWYgKCFleGlzdHNTeW5jKGRpcikpIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvKiBiZXN0LWVmZm9ydCAqL1xuICB9XG4gIHJldHVybiBkaXI7XG59XG5cbmludGVyZmFjZSBGaWxlQ29uZmlnIHtcbiAgYmFja2VuZEJhc2VVcmw/OiBzdHJpbmc7XG4gIGRlYnVnPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gcmVhZEZpbGVDb25maWcoKTogRmlsZUNvbmZpZyB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmF3ID0gcmVhZEZpbGVTeW5jKGpvaW4obWVhbndoaWxlRGlyKCksIFwiY29uZmlnLmpzb25cIiksIFwidXRmOFwiKTtcbiAgICBjb25zdCBqID0gSlNPTi5wYXJzZShyYXcpIGFzIEZpbGVDb25maWc7XG4gICAgcmV0dXJuIGogJiYgdHlwZW9mIGogPT09IFwib2JqZWN0XCIgPyBqIDoge307XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7fTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cmltU2xhc2hlcyhzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZENvbmZpZygpOiBNZWFud2hpbGVDb25maWcge1xuICBjb25zdCBzZXR0aW5ncyA9IHZzY29kZS53b3Jrc3BhY2UuZ2V0Q29uZmlndXJhdGlvbihcIm1lYW53aGlsZVwiKTtcbiAgY29uc3QgZmlsZSA9IHJlYWRGaWxlQ29uZmlnKCk7XG5cbiAgY29uc3Qgc2V0dGluZ0Jhc2UgPSAoc2V0dGluZ3MuZ2V0PHN0cmluZz4oXCJiYWNrZW5kQmFzZVVybFwiKSB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IGZpbGVCYXNlID0gKGZpbGUuYmFja2VuZEJhc2VVcmwgfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCBlbnZCYXNlID0gKHByb2Nlc3MuZW52Lk1FQU5XSElMRV9CQVNFIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgYmFja2VuZEJhc2VVcmwgPSB0cmltU2xhc2hlcyhcbiAgICBzZXR0aW5nQmFzZSB8fCBmaWxlQmFzZSB8fCBlbnZCYXNlIHx8IERFRkFVTFRfQkFDS0VORF9CQVNFLFxuICApO1xuXG4gIGNvbnN0IGRlYnVnID1cbiAgICBzZXR0aW5ncy5nZXQ8Ym9vbGVhbj4oXCJkZWJ1Z1wiKSA9PT0gdHJ1ZSB8fFxuICAgIGZpbGUuZGVidWcgPT09IHRydWUgfHxcbiAgICBwcm9jZXNzLmVudi5NRUFOV0hJTEVfREVCVUcgPT09IFwiMVwiO1xuXG4gIHJldHVybiB7IGJhY2tlbmRCYXNlVXJsLCBkZWJ1ZyB9O1xufVxuIiwgImltcG9ydCB7IGFwcGVuZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBtZWFud2hpbGVEaXIgfSBmcm9tIFwiLi9jb25maWdcIjtcblxuLyoqXG4gKiBCZXN0LWVmZm9ydCBkZWJ1ZyBsb2dnaW5nLiBPZmYgdW5sZXNzIGBkZWJ1Z2AgaXMgZW5hYmxlZCBpbiBjb25maWc7IGV2ZW5cbiAqIHRoZW4sIGEgd3JpdGUgZmFpbHVyZSBtdXN0IG5ldmVyIHN1cmZhY2UgdG8gdGhlIHVzZXIgXHUyMDE0IGxvZ2dpbmcgaXMgYVxuICogZGlhZ25vc3RpYyBhaWQsIG5vdCBhIGZlYXR1cmUgcGF0aC5cbiAqL1xuXG5sZXQgZGVidWdFbmFibGVkID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXREZWJ1ZyhvbjogYm9vbGVhbik6IHZvaWQge1xuICBkZWJ1Z0VuYWJsZWQgPSBvbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRsb2coc2NvcGU6IHN0cmluZywgZXZlbnQ6IHN0cmluZywgZGF0YT86IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKCFkZWJ1Z0VuYWJsZWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBsaW5lID1cbiAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzY29wZSxcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIC4uLihkYXRhICE9PSB1bmRlZmluZWQgPyB7IGRhdGEgfSA6IHt9KSxcbiAgICAgIH0pICsgXCJcXG5cIjtcbiAgICBhcHBlbmRGaWxlU3luYyhqb2luKG1lYW53aGlsZURpcigpLCBcImRlYnVnLmxvZ1wiKSwgbGluZSwgXCJ1dGY4XCIpO1xuICB9IGNhdGNoIHtcbiAgICAvKiBuZXZlciBicmVhayBvbiBsb2dnaW5nICovXG4gIH1cbn1cbiIsICIvKipcbiAqIFB1cmUgcGF0Y2ggbG9naWMgZm9yIENsYXVkZSBDb2RlJ3MgVlMgQ29kZSBidW5kbGVzLiBJTyBsaXZlcyBpbiB0aGVcbiAqIGFkYXB0ZXI7IHRoZXNlIGZ1bmN0aW9ucyB0cmFuc2Zvcm0gYnVuZGxlIHRleHQgYW5kIGFyZSB1bml0LXRlc3RlZFxuICogYWdhaW5zdCBzeW50aGV0aWMgYW5kIHJlYWwgYnVuZGxlcy5cbiAqXG4gKiBUd28gdHJhbnNmb3JtczpcbiAqICAxLiB3ZWJ2aWV3L2luZGV4LmpzIFx1MjAxNCBhcHBlbmQgdGhlIE1lYW53aGlsZSBydW50aW1lIHNuaXBwZXQgKG1hcmtlclxuICogICAgIGRlbGltaXRlZCwgaWRlbXBvdGVudCwgcGxhY2Vob2xkZXJzIHN1YnN0aXR1dGVkKS5cbiAqICAyLiBleHRlbnNpb24uanMgXHUyMDE0IGFkZCBgY29ubmVjdC1zcmMgaHR0cDovLzEyNy4wLjAuMToqYCB0byB0aGUgd2Vidmlld1xuICogICAgIENTUCB0ZW1wbGF0ZSBzbyB0aGUgc25pcHBldCBjYW4gcmVhY2ggdGhlIGxvb3BiYWNrLlxuICovXG5cbmV4cG9ydCBjb25zdCBTTklQUEVUX0JFR0lOID0gXCIvKjw8TUVBTldISUxFX1NOSVBQRVQ+PiovXCI7XG5leHBvcnQgY29uc3QgU05JUFBFVF9FTkQgPSBcIi8qPDwvTUVBTldISUxFX1NOSVBQRVQ+PiovXCI7XG5leHBvcnQgY29uc3QgQ1NQX0NPTk5FQ1QgPSBcImNvbm5lY3Qtc3JjIGh0dHA6Ly8xMjcuMC4wLjE6KlwiO1xuXG4vKiogTWF0Y2hlcyB0aGUgQ1NTLW1vZHVsZSBtYXAgb2YgdGhlIHNwaW5uZXIgY29tcG9uZW50OlxuICogIHZhciBYPXtjb250YWluZXI6XCJjb250YWluZXJfaC4uLlwiLGljb246XCJpY29uX2guLi5cIix0ZXh0OlwidGV4dF9oLi4uXCJ9ICovXG5jb25zdCBURVhUX0NMQVNTX1JFID1cbiAgL1xce2NvbnRhaW5lcjpcImNvbnRhaW5lcl8oW0EtWmEtejAtOV8tXSspXCIsaWNvbjpcImljb25fXFwxXCIsdGV4dDpcIih0ZXh0X1xcMSlcIlxcfS87XG5cbi8qKiBUaGUgQ1NQIG1ldGEgdGVtcGxhdGUgaW5zaWRlIGdldEh0bWxGb3JXZWJ2aWV3LiBBbmNob3JlZCBvbiB0aGUgbGl0ZXJhbFxuICogIHByZWZpeCwgdG9sZXJhbnQgb2YgbWluaWZpZWQgdmFyaWFibGUgbmFtZXMgdGhhdCBmb2xsb3cuICovXG5jb25zdCBDU1BfQU5DSE9SX1JFID0gLyhjb250ZW50PVwiZGVmYXVsdC1zcmMgJ25vbmUnOyApKFxcJFxceykvO1xuXG5leHBvcnQgY2xhc3MgUGF0Y2hBbmNob3JFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0U3Bpbm5lclRleHRDbGFzcyh3ZWJ2aWV3U3JjOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBtID0gd2Vidmlld1NyYy5tYXRjaChURVhUX0NMQVNTX1JFKTtcbiAgaWYgKCFtKSB7XG4gICAgdGhyb3cgbmV3IFBhdGNoQW5jaG9yRXJyb3IoXG4gICAgICBcInNwaW5uZXIgdGV4dCBjbGFzcyBhbmNob3Igbm90IGZvdW5kIChpbmNvbXBhdGlibGUgQ2xhdWRlIENvZGUgYnVpbGQpXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gbVsyXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzV2Vidmlld1BhdGNoZWQod2Vidmlld1NyYzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB3ZWJ2aWV3U3JjLmluY2x1ZGVzKFNOSVBQRVRfQkVHSU4pO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNuaXBwZXRQYXJhbXMge1xuICBwb3J0OiBudW1iZXI7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHRleHRDbGFzczogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlsbFNuaXBwZXQodGVtcGxhdGU6IHN0cmluZywgcDogU25pcHBldFBhcmFtcyk6IHN0cmluZyB7XG4gIHJldHVybiB0ZW1wbGF0ZVxuICAgIC5yZXBsYWNlQWxsKFwiX19NV19QT1JUX19cIiwgU3RyaW5nKHAucG9ydCkpXG4gICAgLnJlcGxhY2VBbGwoXCJfX01XX1RPS0VOX19cIiwgcC50b2tlbilcbiAgICAucmVwbGFjZUFsbChcIl9fTVdfVEVYVF9DTEFTU19fXCIsIHAudGV4dENsYXNzKTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgKG9yIHJlZnJlc2gpIHRoZSBzbmlwcGV0IGF0IHRoZSBlbmQgb2YgdGhlIHdlYnZpZXcgYnVuZGxlLiBUaGVcbiAqIHJlbW92YWJsZSBibG9jayBpcyBleGFjdGx5IFwiXFxuXCIgKyBzbmlwcGV0KCsgXCJcXG5cIiksIHNvIHVucGF0Y2ggcmVzdG9yZXMgdGhlXG4gKiBvcmlnaW5hbCBieXRlLWZvci1ieXRlIHJlZ2FyZGxlc3Mgb2YgaG93IHRoZSBidW5kbGUgaXRzZWxmIGVuZHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRjaFdlYnZpZXdCdW5kbGUoXG4gIHdlYnZpZXdTcmM6IHN0cmluZyxcbiAgZmlsbGVkU25pcHBldDogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgYmFzZSA9IHVucGF0Y2hXZWJ2aWV3QnVuZGxlKHdlYnZpZXdTcmMpO1xuICBjb25zdCBzbmlwcGV0ID0gZmlsbGVkU25pcHBldC5lbmRzV2l0aChcIlxcblwiKVxuICAgID8gZmlsbGVkU25pcHBldFxuICAgIDogZmlsbGVkU25pcHBldCArIFwiXFxuXCI7XG4gIHJldHVybiBiYXNlICsgXCJcXG5cIiArIHNuaXBwZXQ7XG59XG5cbi8qKiBSZW1vdmUgb3VyIHNuaXBwZXQgYmxvY2ssIHJldHVybmluZyB0aGUgc3RvY2sgYnVuZGxlIHRleHQuICovXG5leHBvcnQgZnVuY3Rpb24gdW5wYXRjaFdlYnZpZXdCdW5kbGUod2Vidmlld1NyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc3RhcnQgPSB3ZWJ2aWV3U3JjLmluZGV4T2YoU05JUFBFVF9CRUdJTik7XG4gIGlmIChzdGFydCA9PT0gLTEpIHJldHVybiB3ZWJ2aWV3U3JjO1xuICBjb25zdCBlbmQgPSB3ZWJ2aWV3U3JjLmluZGV4T2YoU05JUFBFVF9FTkQpO1xuICBpZiAoZW5kID09PSAtMSkgcmV0dXJuIHdlYnZpZXdTcmM7IC8vIGhhbGYgYSBtYXJrZXIgXHUyMDE0IGxlYXZlIGl0IGFsb25lXG4gIGxldCBibG9ja1N0YXJ0ID0gc3RhcnQ7XG4gIGlmIChibG9ja1N0YXJ0ID4gMCAmJiB3ZWJ2aWV3U3JjW2Jsb2NrU3RhcnQgLSAxXSA9PT0gXCJcXG5cIikgYmxvY2tTdGFydC0tO1xuICBsZXQgYmxvY2tFbmQgPSBlbmQgKyBTTklQUEVUX0VORC5sZW5ndGg7XG4gIGlmICh3ZWJ2aWV3U3JjW2Jsb2NrRW5kXSA9PT0gXCJcXG5cIikgYmxvY2tFbmQrKztcbiAgcmV0dXJuIHdlYnZpZXdTcmMuc2xpY2UoMCwgYmxvY2tTdGFydCkgKyB3ZWJ2aWV3U3JjLnNsaWNlKGJsb2NrRW5kKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQ3NwUGF0Y2hlZChleHRlbnNpb25TcmM6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gZXh0ZW5zaW9uU3JjLmluY2x1ZGVzKENTUF9DT05ORUNUKTtcbn1cblxuLyoqIEluc2VydCBjb25uZWN0LXNyYyBmb3IgdGhlIGxvb3BiYWNrIGludG8gdGhlIHdlYnZpZXcgQ1NQIHRlbXBsYXRlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoRXh0ZW5zaW9uQ3NwKGV4dGVuc2lvblNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKGlzQ3NwUGF0Y2hlZChleHRlbnNpb25TcmMpKSByZXR1cm4gZXh0ZW5zaW9uU3JjO1xuICBpZiAoIUNTUF9BTkNIT1JfUkUudGVzdChleHRlbnNpb25TcmMpKSB7XG4gICAgdGhyb3cgbmV3IFBhdGNoQW5jaG9yRXJyb3IoXG4gICAgICBcIkNTUCBhbmNob3Igbm90IGZvdW5kIChpbmNvbXBhdGlibGUgQ2xhdWRlIENvZGUgYnVpbGQpXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZXh0ZW5zaW9uU3JjLnJlcGxhY2UoQ1NQX0FOQ0hPUl9SRSwgYCQxJHtDU1BfQ09OTkVDVH07ICQyYCk7XG59XG5cbi8qKiBSZW1vdmUgb3VyIGNvbm5lY3Qtc3JjIGZyb20gdGhlIENTUCB0ZW1wbGF0ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bnBhdGNoRXh0ZW5zaW9uQ3NwKGV4dGVuc2lvblNyYzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGV4dGVuc2lvblNyYy5yZXBsYWNlKGAke0NTUF9DT05ORUNUfTsgYCwgXCJcIik7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7QUFDQSx5QkFBMkI7QUFDM0IsSUFBQUEsa0JBQTZCO0FBQzdCLElBQUFDLG9CQUFxQjtBQUNyQixxQkFBOEI7OztBQ0o5QixJQUFBQyxrQkFRTztBQUNQLElBQUFDLGtCQUF3QjtBQUN4QixJQUFBQyxvQkFBK0I7OztBQ1QvQixxQkFBd0I7QUFDeEIsdUJBQXFCO0FBQ3JCLHFCQUFvRDtBQW9CN0MsU0FBUyxlQUF1QjtBQUNyQyxRQUFNLFVBQU0sMkJBQUssd0JBQVEsR0FBRyxZQUFZO0FBQ3hDLE1BQUk7QUFDRixRQUFJLEtBQUMsMkJBQVcsR0FBRyxFQUFHLCtCQUFVLEtBQUssRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLEVBQzFELFFBQVE7QUFBQSxFQUVSO0FB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RUFBRTtBQUFBLElBQ2xEO0FBQ0EsVUFBTSxJQUFJLElBQUksa0NBQWtDLElBQUksU0FBUyxXQUFXLENBQUM7QUFDekUsVUFBTSxJQUFJLElBQUksa0NBQWtDLE9BQU8sRUFBRSxDQUFDO0FBQzFELFVBQU0sSUFBSSxJQUFJLG9DQUFvQyxPQUFPLEdBQUcsQ0FBQztBQUFBLEVBQy9EO0FBR0EsUUFBTSxPQUFPLFFBQVEsTUFBTTtBQUFBLElBQ3pCLHNCQUFrQix3QkFBSyxRQUFRLElBQUksR0FBRyxNQUFNO0FBQUEsSUFDNUMsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLEVBQ1QsQ0FBQztBQUNELFFBQU0sdUJBQXVCLENBQUMsS0FBSyxZQUFZLElBQUk7QUFHbkQsUUFBTSxJQUFJLFFBQVEsUUFBUTtBQUMxQixRQUFNLGNBQWMsRUFBRSxJQUFJLENBQUM7QUFDM0IsUUFBTSx3QkFBd0IsRUFBRSxhQUFhLFFBQVEsUUFBUSxDQUFDO0FBQzlELGFBQVcsS0FBSyxTQUFTO0FBQ3ZCLFVBQU0sT0FBTyxFQUFFLElBQUksTUFBTSxHQUFHLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQztBQUN6QyxVQUFNLElBQUksVUFBVSxJQUFJLEVBQUUsR0FBRztBQUM3QjtBQUFBLE1BQ0UsSUFBSSxJQUFJO0FBQUEsTUFDUixRQUFJLDhCQUFhLEVBQUUsV0FBVyxNQUFNLENBQUMsTUFBTSxHQUFHO0FBQUEsSUFDaEQ7QUFDQTtBQUFBLE1BQ0UsSUFBSSxJQUFJO0FBQUEsTUFDUixRQUFJLDhCQUFhLEVBQUUsYUFBYSxNQUFNLENBQUMsTUFBTSxHQUFHO0FBQUEsSUFDbEQ7QUFBQSxFQUNGO0FBQ0EsUUFBTSx5QkFBeUIsQ0FBQyxRQUFRLFVBQVUsQ0FBQztBQUVuRCxVQUFRLElBQUksYUFBYSxJQUFJLGVBQWU7QUFBQSxFQUFLLFFBQVEsV0FBVztBQUNwRSxVQUFRLEtBQUssYUFBYSxJQUFJLElBQUksQ0FBQztBQUNyQztBQUVBLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtBQUNsQixVQUFRLE1BQU0seUJBQXlCLENBQUM7QUFDeEMsVUFBUSxLQUFLLENBQUM7QUFDaEIsQ0FBQzsiLAogICJuYW1lcyI6IFsiaW1wb3J0X25vZGVfZnMiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9vcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX2ZzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiZmFpbHVyZXMiXQp9Cg==
