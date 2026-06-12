/**
 * Pure patch logic for Claude Code's VS Code bundles. IO lives in the
 * adapter; these functions transform bundle text and are unit-tested
 * against synthetic and real bundles.
 *
 * Two transforms:
 *  1. webview/index.js — append the Meanwhile runtime snippet (marker
 *     delimited, idempotent, placeholders substituted).
 *  2. extension.js — add `connect-src http://127.0.0.1:*` to the webview
 *     CSP template so the snippet can reach the loopback.
 */

export const SNIPPET_BEGIN = "/*<<MEANWHILE_SNIPPET>>*/";
export const SNIPPET_END = "/*<</MEANWHILE_SNIPPET>>*/";
export const CSP_CONNECT = "connect-src http://127.0.0.1:*";

/** Matches the CSS-module map of the spinner component:
 *  var X={container:"container_h...",icon:"icon_h...",text:"text_h..."} */
const TEXT_CLASS_RE =
  /\{container:"container_([A-Za-z0-9_-]+)",icon:"icon_\1",text:"(text_\1)"\}/;

/** The CSP meta template inside getHtmlForWebview. Anchored on the literal
 *  prefix, tolerant of minified variable names that follow. */
const CSP_ANCHOR_RE = /(content="default-src 'none'; )(\$\{)/;

export class PatchAnchorError extends Error {}

export function extractSpinnerTextClass(webviewSrc: string): string {
  const m = webviewSrc.match(TEXT_CLASS_RE);
  if (!m) {
    throw new PatchAnchorError(
      "spinner text class anchor not found (incompatible Claude Code build)",
    );
  }
  return m[2];
}

export function isWebviewPatched(webviewSrc: string): boolean {
  return webviewSrc.includes(SNIPPET_BEGIN);
}

export interface SnippetParams {
  port: number;
  token: string;
  textClass: string;
}

export function fillSnippet(template: string, p: SnippetParams): string {
  return template
    .replaceAll("__MW_PORT__", String(p.port))
    .replaceAll("__MW_TOKEN__", p.token)
    .replaceAll("__MW_TEXT_CLASS__", p.textClass);
}

/**
 * Append (or refresh) the snippet at the end of the webview bundle. The
 * removable block is exactly "\n" + snippet(+ "\n"), so unpatch restores the
 * original byte-for-byte regardless of how the bundle itself ends.
 */
export function patchWebviewBundle(
  webviewSrc: string,
  filledSnippet: string,
): string {
  const base = unpatchWebviewBundle(webviewSrc);
  const snippet = filledSnippet.endsWith("\n")
    ? filledSnippet
    : filledSnippet + "\n";
  return base + "\n" + snippet;
}

/** Remove our snippet block, returning the stock bundle text. */
export function unpatchWebviewBundle(webviewSrc: string): string {
  const start = webviewSrc.indexOf(SNIPPET_BEGIN);
  if (start === -1) return webviewSrc;
  const end = webviewSrc.indexOf(SNIPPET_END);
  if (end === -1) return webviewSrc; // half a marker — leave it alone
  let blockStart = start;
  if (blockStart > 0 && webviewSrc[blockStart - 1] === "\n") blockStart--;
  let blockEnd = end + SNIPPET_END.length;
  if (webviewSrc[blockEnd] === "\n") blockEnd++;
  return webviewSrc.slice(0, blockStart) + webviewSrc.slice(blockEnd);
}

export function isCspPatched(extensionSrc: string): boolean {
  return extensionSrc.includes(CSP_CONNECT);
}

/** Insert connect-src for the loopback into the webview CSP template. */
export function patchExtensionCsp(extensionSrc: string): string {
  if (isCspPatched(extensionSrc)) return extensionSrc;
  if (!CSP_ANCHOR_RE.test(extensionSrc)) {
    throw new PatchAnchorError(
      "CSP anchor not found (incompatible Claude Code build)",
    );
  }
  return extensionSrc.replace(CSP_ANCHOR_RE, `$1${CSP_CONNECT}; $2`);
}

/** Remove our connect-src from the CSP template. */
export function unpatchExtensionCsp(extensionSrc: string): string {
  return extensionSrc.replace(`${CSP_CONNECT}; `, "");
}
