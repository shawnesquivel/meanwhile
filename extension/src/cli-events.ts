import { existsSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { MetricEvent, Surface } from "../../shared/contract";
import { ALL_SURFACES, BILLABLE_EVENTS } from "../../shared/contract";
import { meanwhileDir } from "./config";
import { eventNonce } from "./ids";
import { dlog } from "./log";
import type { MetricsClient } from "./metrics";

const EVENTS_FILE = "cli-events.jsonl";

interface CliEventLine {
  event?: string;
  sponsorId?: string;
  campaignId?: string;
  sessionToken?: string;
  surface?: string;
  visibleMs?: number;
  ts?: string;
}

/**
 * Drain impression events written by out-of-process CLI surfaces (the
 * statusline script, the Codex wrapper). The file is renamed before reading
 * so concurrent appends from a live CLI session land in a fresh file instead
 * of being lost.
 */
export function drainCliEvents(metrics: MetricsClient, clientId: string): number {
  const file = join(meanwhileDir(), EVENTS_FILE);
  if (!existsSync(file)) return 0;

  const tmp = file + ".draining";
  try {
    renameSync(file, tmp);
  } catch {
    return 0; // another drain raced us; fine
  }

  let drained = 0;
  try {
    const lines = readFileSync(tmp, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let j: CliEventLine;
      try {
        j = JSON.parse(t) as CliEventLine;
      } catch {
        continue;
      }
      const event = j.event as MetricEvent;
      const surface = j.surface as Surface;
      if (!BILLABLE_EVENTS.includes(event)) continue;
      if (!ALL_SURFACES.includes(surface)) continue;
      if (!j.sponsorId || !j.campaignId) continue;
      metrics.enqueue({
        event,
        sponsorId: j.sponsorId,
        campaignId: j.campaignId,
        surface,
        clientId,
        sessionToken: j.sessionToken ?? "",
        nonce: eventNonce(),
        ts: j.ts || new Date().toISOString(),
        ...(typeof j.visibleMs === "number" ? { visibleMs: j.visibleMs } : {}),
      });
      drained++;
    }
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* already gone */
    }
  }
  if (drained > 0) dlog("cli-events", "drained", { drained });
  return drained;
}
