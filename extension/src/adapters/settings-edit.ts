/**
 * Pure edit logic for ~/.claude/settings.json. No filesystem access here —
 * the adapter owns IO, backups, and policy; these functions own correctness
 * of the JSON transforms and are unit-tested in isolation.
 *
 * Claude Code reads two keys we care about (shapes per the extension's
 * claude-code-settings.schema.json):
 *   - statusLine:   { type: "command", command: string, padding?: number }
 *   - spinnerVerbs: { mode: "append" | "replace", verbs: string[] }
 *     (thinking-verb override, CC >= 2.1.143; consumed by BOTH the terminal
 *     spinner and the VS Code webview spinner component)
 */

/** Marker that identifies a statusLine command as ours. */
export const STATUSLINE_MARKER = ".meanwhile/statusline.mjs";

export interface PrevValues {
  hadStatusLine: boolean;
  statusLine?: unknown;
  hadSpinnerVerbs: boolean;
  spinnerVerbs?: unknown;
}

export interface ApplyOptions {
  /** Absolute command to run for the status line. */
  statuslineCommand: string;
  /** Spinner verbs to install, or null to leave the key untouched. */
  verbs: string[] | null;
  /** Overwrite a pre-existing foreign spinnerVerbs value. The adapter passes
   *  true only when its patch-state proves the current value is ours. */
  overwriteForeignVerbs: boolean;
}

export interface ApplyResult {
  next: string;
  prev: PrevValues;
  changed: boolean;
  conflicts: ("statusline_foreign" | "spinnerverbs_foreign")[];
}

type SettingsObject = Record<string, unknown>;

function parse(src: string): SettingsObject {
  const trimmed = src.trim();
  if (trimmed === "") return {};
  const j = JSON.parse(trimmed) as unknown;
  if (j === null || typeof j !== "object" || Array.isArray(j)) {
    throw new Error("settings.json is not an object");
  }
  return j as SettingsObject;
}

function stringify(obj: SettingsObject): string {
  return JSON.stringify(obj, null, 2) + "\n";
}

export function isOurStatusLine(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { command?: unknown }).command === "string" &&
    ((v as { command: string }).command).includes(STATUSLINE_MARKER)
  );
}

/**
 * Upsert our statusLine + spinnerVerbs. Never touches any other key, never
 * reorders what JSON.stringify would not, and refuses to clobber config the
 * user wrote themselves (reported via `conflicts`).
 */
export function applySponsorSettings(
  src: string,
  opts: ApplyOptions,
): ApplyResult {
  const obj = parse(src);
  const conflicts: ApplyResult["conflicts"] = [];

  const prev: PrevValues = {
    hadStatusLine: "statusLine" in obj,
    statusLine: obj.statusLine,
    hadSpinnerVerbs: "spinnerVerbs" in obj,
    spinnerVerbs: obj.spinnerVerbs,
  };

  let changed = false;

  // statusLine: ours is identified by the marker; a foreign one is the
  // user's own config and stays.
  const existing = obj.statusLine;
  if (existing !== undefined && !isOurStatusLine(existing)) {
    conflicts.push("statusline_foreign");
  } else {
    const want = {
      type: "command",
      command: opts.statuslineCommand,
      padding: 0,
    };
    if (JSON.stringify(existing) !== JSON.stringify(want)) {
      obj.statusLine = want;
      changed = true;
    }
  }

  // spinnerVerbs: the value carries no ownership marker, so the adapter's
  // patch-state decides whether an existing value is ours. Written in the
  // schema shape: { mode: "replace", verbs: [...] }.
  if (opts.verbs !== null) {
    const hasForeign = prev.hadSpinnerVerbs && !opts.overwriteForeignVerbs;
    const want = { mode: "replace", verbs: opts.verbs };
    if (hasForeign) {
      conflicts.push("spinnerverbs_foreign");
    } else if (JSON.stringify(obj.spinnerVerbs) !== JSON.stringify(want)) {
      obj.spinnerVerbs = want;
      changed = true;
    }
  }

  return { next: stringify(obj), prev, changed, conflicts };
}

/**
 * Revert exactly the keys we manage to their pre-patch values. Other keys —
 * including ones Claude Code itself rewrote since we patched — are preserved.
 */
export function revertSponsorSettings(src: string, prev: PrevValues): string {
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
