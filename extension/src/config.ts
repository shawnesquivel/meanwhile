import * as vscode from "vscode";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

/**
 * Effective extension configuration, resolved from (highest precedence first):
 *   1. VS Code settings (`meanwhile.*`)
 *   2. ~/.meanwhile/config.json  (power-user / headless override)
 *   3. environment (MEANWHILE_BASE, MEANWHILE_DEBUG)
 *   4. compiled-in defaults
 *
 * Reads are best-effort: a missing/broken file or setting falls through to the
 * next source so activation can never be broken by config.
 */

const DEFAULT_BACKEND_BASE = "http://127.0.0.1:3000";

export interface MeanwhileConfig {
  backendBaseUrl: string;
  debug: boolean;
}

export function meanwhileDir(): string {
  const dir = join(homedir(), ".meanwhile");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch {
    /* best-effort */
  }
  return dir;
}

interface FileConfig {
  backendBaseUrl?: string;
  debug?: boolean;
}

function readFileConfig(): FileConfig {
  try {
    const raw = readFileSync(join(meanwhileDir(), "config.json"), "utf8");
    const j = JSON.parse(raw) as FileConfig;
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function trimSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

export function readConfig(): MeanwhileConfig {
  const settings = vscode.workspace.getConfiguration("meanwhile");
  const file = readFileConfig();

  const settingBase = (settings.get<string>("backendBaseUrl") || "").trim();
  const fileBase = (file.backendBaseUrl || "").trim();
  const envBase = (process.env.MEANWHILE_BASE || "").trim();
  const backendBaseUrl = trimSlashes(
    settingBase || fileBase || envBase || DEFAULT_BACKEND_BASE,
  );

  const debug =
    settings.get<boolean>("debug") === true ||
    file.debug === true ||
    process.env.MEANWHILE_DEBUG === "1";

  return { backendBaseUrl, debug };
}
