#!/usr/bin/env node
/**
 * Meanwhile — Codex CLI banner. Invoked by the codex shim once per
 * interactive launch: prints the current sponsor as an OSC-8 hyperlink and
 * logs one impression event for the extension to flush. Must stay fast and
 * silent on any failure.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".meanwhile");

let cache;
try {
  cache = JSON.parse(readFileSync(join(DIR, "sponsors.json"), "utf8"));
} catch {
  process.exit(0);
}
const sponsors = Array.isArray(cache?.sponsors) ? cache.sponsors : [];
if (sponsors.length === 0) process.exit(0);

const rotation = Math.max(Number(cache.rotationIntervalMs) || 30000, 5000);
const slot = Math.floor(Date.now() / rotation);
const s = sponsors[slot % sponsors.length];

const label = s.brand ? `${s.text} — ${s.brand}` : s.text;
const osc = (url, text) => `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
const dim = (t) => `\u001b[2m${t}\u001b[0m`;
process.stdout.write(`${dim("\u2731 sponsor")} ${osc(s.clickUrl, label)}\n`);

try {
  appendFileSync(
    join(DIR, "cli-events.jsonl"),
    JSON.stringify({
      event: "view_threshold_met",
      sponsorId: s.sponsorId,
      campaignId: s.campaignId,
      sessionToken: s.sessionToken || "",
      surface: "codex_cli",
      visibleMs: Number(cache.viewThresholdMs) || 3000,
      ts: new Date().toISOString(),
    }) + "\n",
  );
} catch {
  /* best-effort */
}
