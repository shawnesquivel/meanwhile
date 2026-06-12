import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { meanwhileDir } from "../config";
import { dlog } from "../log";
import {
  extractSpinnerTextClass,
  fillSnippet,
  isCspPatched,
  patchExtensionCsp,
  patchWebviewBundle,
  PatchAnchorError,
  unpatchExtensionCsp,
  unpatchWebviewBundle,
} from "./webview-patch";

/**
 * Claude Code VS Code/Cursor webview adapter.
 *
 * The spinner text itself is already sponsored via the spinnerVerbs setting
 * (M1c). This adapter makes the webview line measurable and clickable:
 *   webview/index.js  + Meanwhile runtime snippet (loopback-connected)
 *   extension.js      + connect-src for 127.0.0.1 in the webview CSP
 *
 * Byte-exact originals are stored under ~/.meanwhile/backups/cc-webview/
 * before any write; restore copies them back verbatim.
 */

const STATE_FILE = "cc-webview-state.json";

interface TargetState {
  dir: string;
  patchedAtMs: number;
}

interface WebviewState {
  targets: TargetState[];
}

export interface WebviewTarget {
  dir: string;
  webviewJs: string;
  extensionJs: string;
}

function statePath(): string {
  return join(meanwhileDir(), STATE_FILE);
}

function backupRoot(): string {
  return join(meanwhileDir(), "backups", "cc-webview");
}

/** Every installed Claude Code extension build across editors. */
export function findTargets(): WebviewTarget[] {
  const roots = [
    join(homedir(), ".cursor", "extensions"),
    join(homedir(), ".vscode", "extensions"),
  ];
  const targets: WebviewTarget[] = [];
  for (const root of roots) {
    let entries: string[] = [];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.startsWith("anthropic.claude-code-")) continue;
      const dir = join(root, e);
      const webviewJs = join(dir, "webview", "index.js");
      const extensionJs = join(dir, "extension.js");
      if (existsSync(webviewJs) && existsSync(extensionJs)) {
        targets.push({ dir, webviewJs, extensionJs });
      }
    }
  }
  return targets;
}

export class ClaudeWebviewAdapter {
  readonly id = "cc_webview";

  isPatched(): boolean {
    return existsSync(statePath());
  }

  private loadState(): WebviewState | null {
    try {
      return JSON.parse(readFileSync(statePath(), "utf8")) as WebviewState;
    } catch {
      return null;
    }
  }

  /**
   * Patch every detected build. Returns whether anything newly changed
   * (callers prompt for a window reload only then).
   */
  patch(opts: {
    extensionDistDir: string;
    port: number;
    token: string;
  }): { changedAny: boolean; patched: number; failures: string[] } {
    const template = readFileSync(
      join(opts.extensionDistDir, "adapters", "webview-snippet.asset.js"),
      "utf8",
    );

    const prior = this.loadState();
    const targets = findTargets();
    const state: WebviewState = { targets: [] };
    const failures: string[] = [];
    let changedAny = false;

    for (const t of targets) {
      try {
        const webviewSrc = readFileSync(t.webviewJs, "utf8");
        const extensionSrc = readFileSync(t.extensionJs, "utf8");

        // Keep the original bytes from the FIRST time we ever touch a build.
        const bdir = join(backupRoot(), basename(t.dir));
        mkdirSync(bdir, { recursive: true });
        const wvBackup = join(bdir, "webview-index.js");
        const extBackup = join(bdir, "extension.js");
        if (!existsSync(wvBackup)) {
          writeFileSync(wvBackup, unpatchWebviewBundle(webviewSrc));
        }
        if (!existsSync(extBackup)) {
          writeFileSync(extBackup, unpatchExtensionCsp(extensionSrc));
        }

        const textClass = extractSpinnerTextClass(webviewSrc);
        const filled = fillSnippet(template, {
          port: opts.port,
          token: opts.token,
          textClass,
        });

        const nextWebview = patchWebviewBundle(webviewSrc, filled);
        if (nextWebview !== webviewSrc) {
          writeFileSync(t.webviewJs, nextWebview);
          changedAny = true;
        }

        if (!isCspPatched(extensionSrc)) {
          writeFileSync(t.extensionJs, patchExtensionCsp(extensionSrc));
          changedAny = true;
        }

        state.targets.push({ dir: t.dir, patchedAtMs: Date.now() });
        dlog("cc-webview", "patched", { dir: basename(t.dir), textClass });
      } catch (e) {
        const why =
          e instanceof PatchAnchorError ? e.message : `io: ${String(e)}`;
        failures.push(`${basename(t.dir)}: ${why}`);
        dlog("cc-webview", "patch failed", { dir: t.dir, why });
      }
    }

    // Remember dirs we patched earlier even if they vanished this round
    // (uninstalled builds) so restore stays exhaustive.
    if (prior) {
      for (const old of prior.targets) {
        if (!state.targets.some((s) => s.dir === old.dir)) {
          state.targets.push(old);
        }
      }
    }

    if (state.targets.length > 0) {
      writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");
    }
    return { changedAny, patched: state.targets.length, failures };
  }

  /** Copy byte-exact originals back over every patched build. */
  restore(): { ok: boolean; restored: number; detail?: string } {
    const state = this.loadState();
    if (!state) return { ok: true, restored: 0, detail: "nothing to restore" };

    let restored = 0;
    const problems: string[] = [];
    for (const t of state.targets) {
      const bdir = join(backupRoot(), basename(t.dir));
      const wvBackup = join(bdir, "webview-index.js");
      const extBackup = join(bdir, "extension.js");
      try {
        if (!existsSync(t.dir)) continue; // build was uninstalled
        if (existsSync(wvBackup)) {
          copyFileSync(wvBackup, join(t.dir, "webview", "index.js"));
        }
        if (existsSync(extBackup)) {
          copyFileSync(extBackup, join(t.dir, "extension.js"));
        }
        restored++;
      } catch (e) {
        problems.push(`${basename(t.dir)}: ${String(e)}`);
      }
    }

    if (problems.length > 0) {
      return { ok: false, restored, detail: problems.join("; ") };
    }
    rmSync(statePath(), { force: true });
    dlog("cc-webview", "restored", { restored });
    return { ok: true, restored };
  }
}
