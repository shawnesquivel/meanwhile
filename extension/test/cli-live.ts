/* eslint-disable no-console */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MemorySecrets } from "./vscode-stub";
import { ClaudeCliAdapter } from "../src/adapters/claude-cli";
import { AuthService } from "../src/auth";
import { drainCliEvents } from "../src/cli-events";
import { deviceId } from "../src/ids";
import { setDebug } from "../src/log";
import { MetricsClient } from "../src/metrics";
import { PortfolioService } from "../src/portfolio";

/**
 * LIVE M1c test against the real ~/.claude/settings.json (with restore at the
 * end and byte-exact original backed up by the adapter itself). Run with the
 * backend up: MEANWHILE_BASE=http://127.0.0.1:3100
 */

const BASE = (process.env.MEANWHILE_BASE || "http://127.0.0.1:3100").replace(/\/+$/, "");
const SETTINGS = join(homedir(), ".claude", "settings.json");
const MW = join(homedir(), ".meanwhile");

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " — " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};

async function main() {
  setDebug(true);
  const clientId = deviceId();
  const auth = new AuthService(new MemorySecrets() as never, BASE, clientId);
  const portfolio = new PortfolioService(auth, BASE, clientId);
  const metrics = new MetricsClient(auth, BASE, clientId);

  const originalRaw = existsSync(SETTINGS) ? readFileSync(SETTINGS, "utf8") : "{}";
  const original = JSON.parse(originalRaw || "{}");

  // 1) fresh demo portfolio → cache for the statusline script
  const p = await portfolio.refresh("cc_cli_statusline");
  check("portfolio fetched", (p?.sponsors.length ?? 0) > 0);

  // 2) patch the real settings
  const adapter = new ClaudeCliAdapter();
  const det = await adapter.detect();
  console.log("  detect:", JSON.stringify(det));
  const res = await adapter.patch({
    extensionDistDir: join(process.cwd(), "dist"),
    sponsors: p?.sponsors ?? [],
  });
  check("patch ok", res.ok, res);
  check("no conflicts on this machine", res.conflicts.length === 0, res.conflicts);

  const patched = JSON.parse(readFileSync(SETTINGS, "utf8"));
  check(
    "statusLine installed",
    typeof patched.statusLine?.command === "string" &&
      patched.statusLine.command.includes(".meanwhile/statusline.mjs"),
    patched.statusLine,
  );
  check(
    "spinnerVerbs installed (CC >= 2.1.143)",
    !det.verbsSupported || (Array.isArray(patched.spinnerVerbs) && patched.spinnerVerbs.length > 0),
    patched.spinnerVerbs,
  );
  for (const k of Object.keys(original)) {
    check(
      `original key preserved: ${k}`,
      JSON.stringify(patched[k]) === JSON.stringify(original[k]) ||
        k === "statusLine" ||
        k === "spinnerVerbs",
    );
  }
  check("byte-exact backup exists", existsSync(join(MW, "backups", "claude-settings.orig.json")));

  // 3) run the statusline script exactly as Claude Code does
  const out = execFileSync("node", [join(MW, "statusline.mjs")], {
    input: JSON.stringify({ cwd: process.cwd(), model: { id: "test" } }),
    encoding: "utf8",
    timeout: 5000,
  });
  check("statusline prints a line", out.length > 0, out);
  check("statusline is OSC-8 linked", out.includes("\u001b]8;;https://"), JSON.stringify(out.slice(0, 40)));
  const shownSponsor = (p?.sponsors ?? []).some((s) => out.includes(s.text.slice(0, 20)));
  check("statusline shows a live sponsor", shownSponsor, out);

  // re-run in the same rotation slot → no duplicate event
  execFileSync("node", [join(MW, "statusline.mjs")], { input: "{}", encoding: "utf8", timeout: 5000 });
  const eventsRaw = existsSync(join(MW, "cli-events.jsonl"))
    ? readFileSync(join(MW, "cli-events.jsonl"), "utf8").trim()
    : "";
  const eventLines = eventsRaw === "" ? [] : eventsRaw.split("\n");
  check("exactly one impression per slot", eventLines.length === 1, eventLines);

  // 4) drain → flush to backend (anon → demo sink)
  const drained = drainCliEvents(metrics, clientId);
  check("drained the impression", drained === 1, drained);
  await metrics.flush();
  check("events file consumed", !existsSync(join(MW, "cli-events.jsonl")));

  // 5) restore and verify the original came back
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  const restored = JSON.parse(readFileSync(SETTINGS, "utf8"));
  check("settings parse-equal to original", JSON.stringify(restored) === JSON.stringify(original), restored);
  check("statusline script removed", !existsSync(join(MW, "statusline.mjs")));

  // 6) claude CLI still healthy
  let version = "";
  try {
    version = execFileSync("claude", ["--version"], { encoding: "utf8", timeout: 10000 }).trim();
  } catch {
    /* PATH may differ; non-fatal */
  }
  check("claude --version still works", version.length > 0, version);

  metrics.dispose();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("cli-live crashed:", e);
  process.exit(1);
});
