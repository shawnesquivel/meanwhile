import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { meanwhileDir } from "./config";

/**
 * Best-effort debug logging. Off unless `debug` is enabled in config; even
 * then, a write failure must never surface to the user — logging is a
 * diagnostic aid, not a feature path.
 */

let debugEnabled = false;

export function setDebug(on: boolean): void {
  debugEnabled = on;
}

export function dlog(scope: string, event: string, data?: unknown): void {
  if (!debugEnabled) return;
  try {
    const line =
      JSON.stringify({
        t: new Date().toISOString(),
        scope,
        event,
        ...(data !== undefined ? { data } : {}),
      }) + "\n";
    appendFileSync(join(meanwhileDir(), "debug.log"), line, "utf8");
  } catch {
    /* never break on logging */
  }
}
