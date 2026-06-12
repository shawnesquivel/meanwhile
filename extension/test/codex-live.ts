/* eslint-disable no-console */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MemorySecrets } from "./vscode-stub";
import { CodexCliAdapter } from "../src/adapters/codex-cli";
import { hasRcBlock } from "../src/adapters/rc-edit";
import { AuthService } from "../src/auth";
import { deviceId } from "../src/ids";
import { setDebug } from "../src/log";
import { PortfolioService } from "../src/portfolio";

/**
 * LIVE M1d test: installs the codex shim + PATH block on this machine,
 * proves the shim chain (banner on TTY, silence when piped, correct exec of
 * the real binary), then restores everything.
 */

const BASE = (process.env.MEANWHILE_BASE || "http://127.0.0.1:3100").replace(/\/+$/, "");
const MW = join(homedir(), ".meanwhile");
const ZSHRC = join(homedir(), ".zshrc");

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
  await portfolio.refresh("codex_cli");

  const zshrcBefore = existsSync(ZSHRC) ? readFileSync(ZSHRC, "utf8") : "";
  rmSync(join(MW, "cli-events.jsonl"), { force: true });

  // 1) detect + patch
  const adapter = new CodexCliAdapter();
  const det = await adapter.detect();
  console.log("  detect:", JSON.stringify(det));
  check("codex found", det.realCodexPath !== null, det);
  const realVersion = det.version ?? "";

  const res = await adapter.patch({ extensionDistDir: join(process.cwd(), "dist") });
  check("patch ok", res.ok, res);
  check("shim installed", existsSync(join(MW, "bin", "codex")));
  check("banner installed", existsSync(join(MW, "codex-banner.mjs")));
  check("zshrc has block", hasRcBlock(readFileSync(ZSHRC, "utf8")));

  // 2) shim chain: piped (non-TTY) → version only, no banner
  const shimPath = `${join(MW, "bin")}:${process.env.PATH}`;
  const piped = execFileSync(join(MW, "bin", "codex"), ["--version"], {
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, PATH: shimPath },
  });
  check("piped run returns real version", piped.trim() === realVersion, { piped, realVersion });
  check("piped run has no banner", !piped.includes("sponsor"), piped);

  // 3) TTY run via `expect` (allocates a real pty) → banner + version
  let tty = "";
  try {
    tty = execSync(
      `expect -c 'spawn -noecho "${join(MW, "bin", "codex")}" --version' -c 'expect eof'`,
      { encoding: "utf8", timeout: 20000, env: { ...process.env, PATH: shimPath } },
    );
  } catch (e) {
    check("tty run executed", false, String(e));
  }
  check("tty run shows banner", tty.includes("sponsor"), JSON.stringify(tty.slice(0, 120)));
  check("tty run shows OSC-8 link", tty.includes("\u001b]8;;https://"));
  check("tty run still prints version", tty.includes(realVersion), tty);

  // 4) impression event logged exactly once (TTY run only)
  const ev = existsSync(join(MW, "cli-events.jsonl"))
    ? readFileSync(join(MW, "cli-events.jsonl"), "utf8").trim().split("\n")
    : [];
  check("one codex impression logged", ev.length === 1, ev);
  if (ev.length === 1) {
    const j = JSON.parse(ev[0]);
    check("event surface is codex_cli", j.surface === "codex_cli", j);
  }

  // 5) restore
  const r = adapter.restore();
  check("restore ok", r.ok, r);
  check("shim removed", !existsSync(join(MW, "bin")));
  const zshrcAfter = readFileSync(ZSHRC, "utf8");
  check("zshrc block removed", !hasRcBlock(zshrcAfter));
  check("zshrc byte-identical to before", zshrcAfter === zshrcBefore);
  const direct = execFileSync("codex", ["--version"], { encoding: "utf8", timeout: 20000 }).trim();
  check("codex direct still healthy", direct === realVersion, direct);

  rmSync(join(MW, "cli-events.jsonl"), { force: true });
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("codex-live crashed:", e);
  process.exit(1);
});
