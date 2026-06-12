/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MemorySecrets, openedUrls } from "./vscode-stub";
import { setDebug } from "../src/log";
import { AuthService } from "../src/auth";
import { MetricsClient } from "../src/metrics";
import { PortfolioService } from "../src/portfolio";
import { Loopback } from "../src/loopback";
import { deviceId } from "../src/ids";

/**
 * Headless integration test for the M1b service layer, run against a live
 * backend (MEANWHILE_BASE, default http://localhost:3100). Exercises:
 *   anonymous portfolio → dev-login tokens → signed-in portfolio → CLI cache
 *   → loopback sponsors/metrics/click → beacon flush → earnings delta.
 */

const BASE = (process.env.MEANWHILE_BASE || "http://localhost:3100").replace(
  /\/+$/,
  "",
);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : " — " + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return (await r.json()) as T;
}

async function main(): Promise<void> {
  setDebug(true);
  const clientId = deviceId();
  const secrets = new MemorySecrets();
  const auth = new AuthService(
    secrets as never,
    BASE,
    clientId,
  );
  await auth.load();

  // 1) anonymous portfolio
  const portfolio = new PortfolioService(auth, BASE, clientId);
  const anon = await portfolio.refresh("cc_webview");
  check("anon portfolio served", (anon?.sponsors.length ?? 0) > 0);
  check(
    "anon portfolio is demo-only",
    anon?.sponsors.every((s) => s.demo === true) ?? false,
    anon?.sponsors.map((s) => s.demo),
  );

  // 2) dev-login (bypasses browser flow; same token layer)
  const tokens = await json<{ accessToken: string; refreshToken: string }>(
    `${BASE}/api/v1/ext/auth/dev-login`,
    { method: "POST" },
  );
  await secrets.store("meanwhile.tokens.v1", JSON.stringify(tokens));
  await auth.load();
  check("tokens loaded → signedIn", auth.signedIn);

  // 3) signed-in portfolio + balances + CLI cache file
  const before = await json<{ lifetimeUsd: string }>(
    `${BASE}/api/v1/earnings`,
    { headers: { authorization: `Bearer ${tokens.accessToken}` } },
  );
  const signed = await portfolio.refresh("cc_cli_statusline");
  check("signed-in portfolio served", (signed?.sponsors.length ?? 0) > 0);
  check(
    "signed-in portfolio non-demo",
    signed?.sponsors.every((s) => !s.demo) ?? false,
  );
  check("balances present", signed?.balances != null);
  const cache = JSON.parse(
    readFileSync(join(homedir(), ".meanwhile", "sponsors.json"), "utf8"),
  ) as { sponsors: unknown[] };
  check("CLI cache written", cache.sponsors.length > 0);
  check("rotation picks a sponsor", portfolio.currentSponsor() !== null);

  // 4) loopback bridge
  const metrics = new MetricsClient(auth, BASE, clientId);
  const loop = new Loopback(portfolio, metrics, clientId);
  await loop.start();
  check("loopback listening", loop.port > 0);
  const lb = `http://127.0.0.1:${loop.port}`;

  const health = await json<{ ok: boolean }>(`${lb}/health`);
  check("loopback /health", health.ok);

  const bad = await fetch(`${lb}/v1/sponsors?t=WRONG`);
  check("loopback rejects bad token", bad.status === 403);

  const sp = await json<{ sponsors: { sponsorId: string; campaignId: string; sessionToken: string; clickUrl: string }[] }>(
    `${lb}/v1/sponsors?t=${loop.token}`,
  );
  check("loopback serves sponsors", sp.sponsors.length > 0);

  const s0 = sp.sponsors[0];
  const beat = await json<{ ok: boolean }>(
    `${lb}/v1/metrics?t=${loop.token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "view_threshold_met",
        sponsorId: s0.sponsorId,
        campaignId: s0.campaignId,
        surface: "cc_webview",
        sessionToken: s0.sessionToken,
        visibleMs: 3200,
      }),
    },
  );
  check("loopback accepts metric", beat.ok);

  const click = await json<{ ok: boolean }>(
    `${lb}/v1/click?t=${loop.token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "click",
        sponsorId: s0.sponsorId,
        campaignId: s0.campaignId,
        surface: "cc_webview",
        sessionToken: s0.sessionToken,
        clickUrl: s0.clickUrl,
      }),
    },
  );
  check("loopback click ok", click.ok);
  check("click opened browser (stub)", openedUrls.length === 1, openedUrls);

  // 5) flush beacons → earnings increased by exactly impression/2 + click/2
  await metrics.flush();
  const after = await json<{ lifetimeUsd: string }>(
    `${BASE}/api/v1/earnings`,
    { headers: { authorization: `Bearer ${auth.accessToken}` } },
  );
  const delta =
    Math.round(
      (parseFloat(after.lifetimeUsd) - parseFloat(before.lifetimeUsd)) * 100,
    ) / 100;
  // Top house sponsor is $20/1k → impression credit $0.01, click credit $0.50.
  check("earnings delta == $0.51", delta === 0.51, {
    before: before.lifetimeUsd,
    after: after.lifetimeUsd,
    delta,
  });

  // 6) refresh rotation + signout
  const refreshed = await auth.refresh();
  check("refresh rotates", refreshed && auth.signedIn);
  await auth.signOut();
  check("signout clears", !auth.signedIn);

  loop.dispose();
  metrics.dispose();

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("harness crashed:", e);
  process.exit(1);
});
