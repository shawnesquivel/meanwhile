import { execFile } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Sponsor } from "../../../shared/contract";
import { meanwhileDir } from "../config";
import { dlog } from "../log";
import {
  applySponsorSettings,
  revertSponsorSettings,
  type PrevValues,
} from "./settings-edit";

/**
 * Claude Code CLI adapter. Two sub-surfaces, both driven from
 * ~/.claude/settings.json:
 *
 *   statusline — a clickable OSC-8 sponsor line rendered by our script
 *                (every Claude Code version that supports statusLine)
 *   spinner    — the thinking-verb override (Claude Code >= 2.1.143)
 *
 * Patching only upserts the two keys; restore puts back exactly what was
 * there before. A byte-exact backup of the first-seen settings.json is kept
 * as a belt-and-suspenders escape hatch.
 */

const STATE_FILE = "claude-cli-state.json";
const SCRIPT_NAME = "statusline.mjs";
const MIN_VERBS_VERSION: [number, number, number] = [2, 1, 143];

interface PatchState {
  prev: PrevValues;
  verbsApplied: boolean;
  appliedAtMs: number;
}

export interface ClaudeCliDetection {
  settingsPath: string;
  settingsDirExists: boolean;
  version: string | null;
  verbsSupported: boolean;
}

function settingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

function statePath(): string {
  return join(meanwhileDir(), STATE_FILE);
}

function scriptPath(): string {
  return join(meanwhileDir(), SCRIPT_NAME);
}

function parseVersion(s: string): [number, number, number] | null {
  const m = s.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function gte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

const CLAUDE_CANDIDATES = [
  "claude",
  join(homedir(), ".local", "bin", "claude"),
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
];

function claudeVersion(): Promise<string | null> {
  const tryOne = (bin: string) =>
    new Promise<string | null>((resolve) => {
      execFile(bin, ["--version"], { timeout: 8000 }, (err, stdout) => {
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

export class ClaudeCliAdapter {
  readonly id = "claude_cli";
  private versionCache: string | null | undefined;

  async detect(): Promise<ClaudeCliDetection> {
    if (this.versionCache === undefined) {
      this.versionCache = await claudeVersion();
    }
    const v = this.versionCache ? parseVersion(this.versionCache) : null;
    return {
      settingsPath: settingsPath(),
      settingsDirExists: existsSync(join(homedir(), ".claude")),
      version: this.versionCache ?? null,
      verbsSupported: v !== null && gte(v, MIN_VERBS_VERSION),
    };
  }

  isPatched(): boolean {
    return existsSync(statePath());
  }

  private loadState(): PatchState | null {
    try {
      return JSON.parse(readFileSync(statePath(), "utf8")) as PatchState;
    } catch {
      return null;
    }
  }

  /** Install/refresh the statusline script asset (idempotent). */
  private installScript(extensionDistDir: string): void {
    const asset = join(extensionDistDir, "adapters", "statusline.asset.mjs");
    copyFileSync(asset, scriptPath());
    chmodSync(scriptPath(), 0o755);
  }

  /** Spinner verbs derived from the sponsor queue (text only — the spinner
   *  is not clickable). Claude Code appends its own ellipsis/timer. */
  private verbsFrom(sponsors: Sponsor[]): string[] {
    const verbs = sponsors
      .map((s) => (s.brand ? `${s.text} — ${s.brand}` : s.text))
      .map((t) => t.slice(0, 60));
    return verbs.length > 0 ? verbs : [];
  }

  /**
   * Apply (or re-apply) the patch. Safe to call on every portfolio refresh:
   * it rewrites settings.json only when the desired state actually differs.
   */
  async patch(opts: {
    extensionDistDir: string;
    sponsors: Sponsor[];
  }): Promise<{ ok: boolean; conflicts: string[] }> {
    const det = await this.detect();
    if (!det.settingsDirExists) {
      dlog("cc-cli", "no ~/.claude — skipping");
      return { ok: false, conflicts: ["no_claude_dir"] };
    }

    mkdirSync(meanwhileDir(), { recursive: true });
    this.installScript(opts.extensionDistDir);

    const sp = settingsPath();
    const src = existsSync(sp) ? readFileSync(sp, "utf8") : "{}";

    // First-ever patch: keep a byte-exact copy of the original.
    const backupDir = join(meanwhileDir(), "backups");
    mkdirSync(backupDir, { recursive: true });
    const origBackup = join(backupDir, "claude-settings.orig.json");
    if (!existsSync(origBackup)) writeFileSync(origBackup, src);
    writeFileSync(join(backupDir, "claude-settings.last.json"), src);

    const prior = this.loadState();
    const verbs = det.verbsSupported ? this.verbsFrom(opts.sponsors) : null;

    let result;
    try {
      result = applySponsorSettings(src, {
        statuslineCommand: `node "${scriptPath()}"`,
        verbs: verbs && verbs.length > 0 ? verbs : null,
        // If we patched before, the current spinnerVerbs value is ours and
        // may be rewritten freely; otherwise an existing value is the user's.
        overwriteForeignVerbs: prior?.verbsApplied === true,
      });
    } catch (e) {
      dlog("cc-cli", "settings parse failed; refusing to touch", {
        e: String(e),
      });
      return { ok: false, conflicts: ["settings_unparseable"] };
    }

    if (result.changed) writeFileSync(sp, result.next);

    // Preserve the ORIGINAL prev across re-patches so restore always reverts
    // to the true pre-Meanwhile state.
    const state: PatchState = {
      prev: prior?.prev ?? result.prev,
      verbsApplied:
        prior?.verbsApplied === true ||
        (verbs !== null &&
          verbs.length > 0 &&
          !result.conflicts.includes("spinnerverbs_foreign")),
      appliedAtMs: Date.now(),
    };
    writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");

    dlog("cc-cli", "patched", {
      changed: result.changed,
      conflicts: result.conflicts,
      verbs: verbs?.length ?? 0,
    });
    return { ok: true, conflicts: result.conflicts };
  }

  /** Revert our keys to their pre-patch values and drop the state file. */
  restore(): { ok: boolean; detail?: string } {
    const state = this.loadState();
    const sp = settingsPath();
    if (!state) {
      return { ok: true, detail: "nothing to restore" };
    }
    try {
      const src = existsSync(sp) ? readFileSync(sp, "utf8") : "{}";
      const next = revertSponsorSettings(src, state.prev);
      writeFileSync(sp, next);
      unlinkSync(statePath());
      try {
        unlinkSync(scriptPath());
      } catch {
        /* script may already be gone */
      }
      dlog("cc-cli", "restored");
      return { ok: true };
    } catch (e) {
      dlog("cc-cli", "restore failed", { e: String(e) });
      return { ok: false, detail: String(e) };
    }
  }
}
