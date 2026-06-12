import { execFile } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { meanwhileDir } from "../config";
import { dlog } from "../log";
import { addRcBlock, removeRcBlock } from "./rc-edit";

/**
 * Codex CLI adapter. Codex ships as a plain binary with no settings hook, so
 * the surface is a PATH shim: ~/.meanwhile/bin/codex prints one sponsor line
 * (interactive runs only), then exec's the real binary. PATH is injected via
 * a marker-delimited block in the user's shell rc files.
 */

const STATE_FILE = "codex-cli-state.json";

interface CodexState {
  rcFilesEdited: string[];
  appliedAtMs: number;
}

export interface CodexDetection {
  realCodexPath: string | null;
  version: string | null;
  rcFiles: string[];
}

function binDir(): string {
  return join(meanwhileDir(), "bin");
}

function statePath(): string {
  return join(meanwhileDir(), STATE_FILE);
}

/** First codex on PATH that is not our shim. */
function findRealCodex(): string | null {
  const ours = binDir();
  for (const d of (process.env.PATH || "").split(delimiter)) {
    if (!d || d === ours) continue;
    const p = join(d, "codex");
    try {
      if (existsSync(p)) return p;
    } catch {
      /* permission issues on odd PATH entries */
    }
  }
  return null;
}

function codexVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, ["--version"], { timeout: 8000 }, (err, stdout) =>
      resolve(err ? null : String(stdout).trim() || null),
    );
  });
}

/** rc files we manage: zsh always (macOS default), bash only if present. */
function rcFiles(): string[] {
  const h = homedir();
  const files = [join(h, ".zshrc")];
  for (const f of [join(h, ".bashrc"), join(h, ".bash_profile")]) {
    if (existsSync(f)) files.push(f);
  }
  return files;
}

export class CodexCliAdapter {
  readonly id = "codex_cli";

  async detect(): Promise<CodexDetection> {
    const real = findRealCodex();
    return {
      realCodexPath: real,
      version: real ? await codexVersion(real) : null,
      rcFiles: rcFiles(),
    };
  }

  isPatched(): boolean {
    return existsSync(statePath());
  }

  /** Install the shim + banner and inject PATH. Idempotent. */
  async patch(opts: { extensionDistDir: string }): Promise<{
    ok: boolean;
    detail?: string;
  }> {
    const det = await this.detect();
    if (!det.realCodexPath) {
      dlog("codex", "no codex on PATH — skipping");
      return { ok: false, detail: "codex not installed" };
    }

    mkdirSync(binDir(), { recursive: true });
    const shimSrc = join(opts.extensionDistDir, "adapters", "codex-shim.asset.sh");
    const bannerSrc = join(
      opts.extensionDistDir,
      "adapters",
      "codex-banner.asset.mjs",
    );
    const shim = join(binDir(), "codex");
    const banner = join(meanwhileDir(), "codex-banner.mjs");
    copyFileSync(shimSrc, shim);
    chmodSync(shim, 0o755);
    copyFileSync(bannerSrc, banner);
    chmodSync(banner, 0o644);

    const edited: string[] = [];
    for (const rc of rcFiles()) {
      try {
        const src = existsSync(rc) ? readFileSync(rc, "utf8") : "";
        const next = addRcBlock(src, binDir());
        if (next !== src) writeFileSync(rc, next);
        edited.push(rc);
      } catch (e) {
        dlog("codex", "rc edit failed", { rc, e: String(e) });
      }
    }
    if (edited.length === 0) return { ok: false, detail: "no rc file editable" };

    const state: CodexState = { rcFilesEdited: edited, appliedAtMs: Date.now() };
    writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");
    dlog("codex", "patched", { edited });
    return { ok: true };
  }

  /** Remove the shim and strip the PATH block from every rc we edited. */
  restore(): { ok: boolean; detail?: string } {
    let state: CodexState | null = null;
    try {
      state = JSON.parse(readFileSync(statePath(), "utf8")) as CodexState;
    } catch {
      /* not patched */
    }
    if (!state) return { ok: true, detail: "nothing to restore" };

    try {
      for (const rc of state.rcFilesEdited) {
        try {
          if (!existsSync(rc)) continue;
          const src = readFileSync(rc, "utf8");
          const next = removeRcBlock(src);
          if (next !== src) writeFileSync(rc, next);
        } catch (e) {
          dlog("codex", "rc restore failed", { rc, e: String(e) });
        }
      }
      rmSync(binDir(), { recursive: true, force: true });
      rmSync(join(meanwhileDir(), "codex-banner.mjs"), { force: true });
      rmSync(statePath(), { force: true });
      dlog("codex", "restored");
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: String(e) };
    }
  }
}
