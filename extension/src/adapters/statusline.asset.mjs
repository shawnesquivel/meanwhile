#!/usr/bin/env node
/**
 * Meanwhile — Claude Code status line.
 *
 * Installed at ~/.meanwhile/statusline.mjs and referenced from
 * ~/.claude/settings.json (statusLine.command). Claude Code runs this on
 * every status-line render, so the hot path is: read one small JSON cache,
 * print one line, exit. No network, no deps.
 *
 * It prints the current sponsor as an OSC-8 hyperlink and appends one JSONL
 * impression event per (sponsor, rotation slot) to cli-events.jsonl; the
 * Meanwhile extension picks those up and converts them into metric beacons.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".meanwhile");

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const cache = readJson(join(DIR, "sponsors.json"));
const sponsors = cache && Array.isArray(cache.sponsors) ? cache.sponsors : [];
if (sponsors.length === 0) {
  process.stdout.write("");
  process.exit(0);
}

const rotation = Math.max(Number(cache.rotationIntervalMs) || 30000, 5000);
const slot = Math.floor(Date.now() / rotation);
const s = sponsors[slot % sponsors.length];

const label = s.brand ? `${s.text} — ${s.brand}` : s.text;
const osc = (url, text) => `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
const line = `\u2731 ${osc(s.clickUrl, label)}`;

// One impression per sponsor per rotation slot, deduped via a state file so
// re-renders inside the same slot don't double-log.
try {
  const statePath = join(DIR, ".statusline-state.json");
  const key = `${s.sponsorId}:${slot}`;
  const st = readJson(statePath);
  if (!st || st.lastKey !== key) {
    writeFileSync(statePath, JSON.stringify({ lastKey: key }));
    appendFileSync(
      join(DIR, "cli-events.jsonl"),
      JSON.stringify({
        event: "view_threshold_met",
        sponsorId: s.sponsorId,
        campaignId: s.campaignId,
        sessionToken: s.sessionToken || "",
        surface: "cc_cli_statusline",
        slot,
        visibleMs: rotation,
        ts: new Date().toISOString(),
      }) + "\n",
    );
  }
} catch {
  /* metrics are best-effort; never break the status line */
}

process.stdout.write(line);
