/* eslint-disable no-console */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { ClaudeWebviewAdapter, findTargets } from "../src/adapters/claude-webview";
import { CSP_CONNECT, SNIPPET_BEGIN } from "../src/adapters/webview-patch";
import { setDebug } from "../src/log";

/**
 * LIVE M1e test: patches every installed Claude Code build (Cursor +
 * VS Code), proves the patched bundles still parse as JavaScript and carry
 * the loopback wiring, then restores byte-exact originals (hash-verified).
 */

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " — " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function parses(src: string): boolean {
  try {
    transformSync(src, { loader: "js", minify: false });
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

  const originals = new Map<string, { wv: string; ext: string }>();
  for (const t of targets) {
    originals.set(t.dir, {
      wv: sha(readFileSync(t.webviewJs, "utf8")),
      ext: sha(readFileSync(t.extensionJs, "utf8")),
    });
  }

  // 1) patch all builds with a fake-but-shaped loopback identity
  const adapter = new ClaudeWebviewAdapter();
  const res = adapter.patch({
    extensionDistDir: join(process.cwd(), "dist"),
    port: 48757,
    token: "tok_live_test",
  });
  check("patch reported changes", res.changedAny, res);
  check("no per-build failures", res.failures.length === 0, res.failures);
  check("adapter reports patched", adapter.isPatched());

  for (const t of targets) {
    const name = t.dir.split("/").slice(-1)[0];
    const wv = readFileSync(t.webviewJs, "utf8");
    const ext = readFileSync(t.extensionJs, "utf8");
    check(`[${name}] snippet present`, wv.includes(SNIPPET_BEGIN));
    check(`[${name}] port+token baked in`, wv.includes("48757") && wv.includes("tok_live_test"));
    check(
      `[${name}] text class baked in`,
      /var TEXT_CLASS = "text_[A-Za-z0-9_-]+"/.test(wv),
    );
    check(`[${name}] CSP has loopback connect-src`, ext.includes(CSP_CONNECT));
    check(`[${name}] patched webview parses as JS`, parses(wv));
    check(`[${name}] patched extension parses as JS`, parses(ext));
  }

  // 2) idempotency: second patch with same params changes nothing
  const res2 = adapter.patch({
    extensionDistDir: join(process.cwd(), "dist"),
    port: 48757,
    token: "tok_live_test",
  });
  check("re-patch is a no-op", !res2.changedAny, res2);

  // 3) restore → byte-exact originals
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  check("restored every build", r.restored === targets.length, r);
  for (const t of targets) {
    const name = t.dir.split("/").slice(-1)[0];
    const o = originals.get(t.dir);
    check(
      `[${name}] webview byte-identical after restore`,
      sha(readFileSync(t.webviewJs, "utf8")) === o?.wv,
    );
    check(
      `[${name}] extension byte-identical after restore`,
      sha(readFileSync(t.extensionJs, "utf8")) === o?.ext,
    );
  }
  check("adapter state cleared", !adapter.isPatched());

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("webview-live crashed:", e);
  process.exit(1);
});
