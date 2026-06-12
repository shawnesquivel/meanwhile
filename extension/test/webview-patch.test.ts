import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CSP_CONNECT,
  extractSpinnerTextClass,
  fillSnippet,
  isCspPatched,
  isWebviewPatched,
  patchExtensionCsp,
  patchWebviewBundle,
  unpatchExtensionCsp,
  unpatchWebviewBundle,
} from "../src/adapters/webview-patch";

const SNIPPET_TEMPLATE = readFileSync(
  join(__dirname, "..", "src", "adapters", "webview-snippet.asset.js"),
  "utf8",
);

// Synthetic minimal stand-ins for the real bundles.
const FAKE_WEBVIEW = `var rG={container:"container_abc123",icon:"icon_abc123",text:"text_abc123"};function spinner(){}`;
const FAKE_EXTENSION = `return \`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; \${p}; \${f}; \${m}; script-src 'nonce-\${u}'; \${g};">\``;

describe("snippet fill + webview patch", () => {
  it("extracts the spinner text class", () => {
    expect(extractSpinnerTextClass(FAKE_WEBVIEW)).toBe("text_abc123");
  });

  it("throws a clear anchor error on incompatible bundles", () => {
    expect(() => extractSpinnerTextClass("nothing here")).toThrow(/anchor/);
  });

  it("fills all placeholders", () => {
    const filled = fillSnippet(SNIPPET_TEMPLATE, {
      port: 48757,
      token: "tok_x",
      textClass: "text_abc123",
    });
    expect(filled).toContain('"48757"');
    expect(filled).toContain("tok_x");
    expect(filled).toContain("text_abc123");
    expect(filled).not.toContain("__MW_");
  });

  it("patch is idempotent and round-trips byte-exact", () => {
    const filled = fillSnippet(SNIPPET_TEMPLATE, {
      port: 1,
      token: "t",
      textClass: "text_abc123",
    });
    const once = patchWebviewBundle(FAKE_WEBVIEW, filled);
    const twice = patchWebviewBundle(once, filled);
    expect(isWebviewPatched(once)).toBe(true);
    expect(twice).toBe(once);
    expect(unpatchWebviewBundle(once)).toBe(FAKE_WEBVIEW);
  });

  it("re-patching swaps in fresh port/token", () => {
    const a = patchWebviewBundle(
      FAKE_WEBVIEW,
      fillSnippet(SNIPPET_TEMPLATE, { port: 1, token: "tok_AAA", textClass: "c" }),
    );
    const b = patchWebviewBundle(
      a,
      fillSnippet(SNIPPET_TEMPLATE, { port: 2, token: "tok_BBB", textClass: "c" }),
    );
    expect(b).not.toContain("tok_AAA");
    expect(b).toContain("tok_BBB");
    // exactly one begin marker + one end marker
    expect(b.split("MEANWHILE_SNIPPET").length).toBe(3);
  });
});

describe("extension CSP patch", () => {
  it("inserts connect-src and round-trips", () => {
    const patched = patchExtensionCsp(FAKE_EXTENSION);
    expect(isCspPatched(patched)).toBe(true);
    expect(patched).toContain(`default-src 'none'; ${CSP_CONNECT}; \${p}`);
    expect(unpatchExtensionCsp(patched)).toBe(FAKE_EXTENSION);
  });

  it("is idempotent", () => {
    const once = patchExtensionCsp(FAKE_EXTENSION);
    expect(patchExtensionCsp(once)).toBe(once);
  });

  it("throws on incompatible bundles", () => {
    expect(() => patchExtensionCsp("no anchor here")).toThrow(/anchor/);
  });
});

// Run the same logic against every REAL installed Claude Code build (read
// only — no writes). Skipped automatically on machines without it.
describe("real Claude Code bundles", () => {
  const roots = [
    join(homedir(), ".cursor", "extensions"),
    join(homedir(), ".vscode", "extensions"),
  ];
  const dirs: string[] = [];
  for (const root of roots) {
    try {
      for (const e of require("node:fs").readdirSync(root) as string[]) {
        if (e.startsWith("anthropic.claude-code-")) dirs.push(join(root, e));
      }
    } catch {
      /* editor not installed */
    }
  }

  it.skipIf(dirs.length === 0)("anchors exist in every installed build", () => {
    for (const dir of dirs) {
      const wv = join(dir, "webview", "index.js");
      const ext = join(dir, "extension.js");
      if (!existsSync(wv) || !existsSync(ext)) continue;
      // The live install may currently be patched (that's the product
      // working as intended) — normalize to pristine before round-tripping.
      const webviewSrc = unpatchWebviewBundle(readFileSync(wv, "utf8"));
      const extensionSrc = unpatchExtensionCsp(readFileSync(ext, "utf8"));

      const cls = extractSpinnerTextClass(webviewSrc);
      expect(cls).toMatch(/^text_/);

      const patched = patchExtensionCsp(extensionSrc);
      expect(isCspPatched(patched)).toBe(true);
      expect(unpatchExtensionCsp(patched)).toBe(extensionSrc);

      const filled = fillSnippet(SNIPPET_TEMPLATE, {
        port: 48757,
        token: "tk",
        textClass: cls,
      });
      const wvPatched = patchWebviewBundle(webviewSrc, filled);
      expect(unpatchWebviewBundle(wvPatched)).toBe(webviewSrc);
    }
  });
});
