/**
 * Pure edit logic for shell rc files (~/.zshrc, ~/.bashrc). The Meanwhile
 * block is marker-delimited so install/remove are idempotent and never touch
 * anything the user wrote. IO and policy live in the Codex adapter.
 */

export const RC_BEGIN = "# >>> meanwhile >>>";
export const RC_END = "# <<< meanwhile <<<";

export function rcBlock(binDir: string): string {
  return [
    RC_BEGIN,
    "# Adds the Meanwhile sponsor shim for the codex CLI. Managed by the",
    '# Meanwhile extension — run "Meanwhile: Restore" to remove.',
    `export PATH="${binDir}:$PATH"`,
    RC_END,
  ].join("\n");
}

export function hasRcBlock(src: string): boolean {
  return src.includes(RC_BEGIN) && src.includes(RC_END);
}

/** Append (or refresh) the managed block. Returns the new content. */
export function addRcBlock(src: string, binDir: string): string {
  const without = removeRcBlock(src);
  const sep = without.length === 0 || without.endsWith("\n") ? "" : "\n";
  return `${without}${sep}\n${rcBlock(binDir)}\n`;
}

/** Strip the managed block (and exactly one surrounding blank line). */
export function removeRcBlock(src: string): string {
  if (!hasRcBlock(src)) return src;
  const start = src.indexOf(RC_BEGIN);
  const end = src.indexOf(RC_END);
  if (start === -1 || end === -1 || end < start) return src;
  let head = src.slice(0, start);
  let tail = src.slice(end + RC_END.length);
  // Swallow the newline we added before the block and after it.
  head = head.replace(/\n\n$/, "\n");
  tail = tail.replace(/^\n/, "");
  return head + tail;
}
