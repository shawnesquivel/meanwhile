import * as vscode from "vscode";
import { AuthService } from "./auth";
import { readConfig } from "./config";
import { deviceId } from "./ids";
import { dlog, setDebug } from "./log";
import { Loopback } from "./loopback";
import { MetricsClient } from "./metrics";
import { PortfolioService } from "./portfolio";
import { StatusBar } from "./statusbar";

/**
 * Meanwhile extension entry point.
 *
 * M1b: real service loop — auth (opaque token layer), portfolio fetch + CLI
 * cache, metric queue, loopback bridge for webviews, live status bar.
 * Editor/CLI patching arrives in M1c–M1e.
 */

const TICK_MS = 30_000;

let statusBar: StatusBar | undefined;
let loopback: Loopback | undefined;
let metrics: MetricsClient | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const cfg = readConfig();
  setDebug(cfg.debug);
  const clientId = deviceId();
  dlog("ext", "activate", { backendBaseUrl: cfg.backendBaseUrl, clientId });

  const auth = new AuthService(context.secrets, cfg.backendBaseUrl, clientId);
  await auth.load();

  metrics = new MetricsClient(auth, cfg.backendBaseUrl, clientId);
  metrics.start();

  const portfolio = new PortfolioService(auth, cfg.backendBaseUrl, clientId);

  loopback = new Loopback(portfolio, metrics, clientId);
  await loopback.start();

  statusBar = new StatusBar();
  context.subscriptions.push(
    { dispose: () => statusBar?.dispose() },
    { dispose: () => loopback?.dispose() },
    { dispose: () => metrics?.dispose() },
    { dispose: () => ticker && clearInterval(ticker) },
  );

  let lastRefreshOk = true;

  const paint = () => {
    if (!statusBar) return;
    const balances = portfolio.portfolio?.balances;
    if (auth.signedIn && balances) {
      statusBar.set({
        kind: "earning",
        todayUsd: balances.todayUsd,
        lifetimeUsd: balances.lifetimeUsd,
      });
    } else if (auth.signedIn && !lastRefreshOk) {
      statusBar.set({ kind: "offline" });
    } else if (auth.signedIn) {
      statusBar.set({ kind: "earning", todayUsd: "0.00", lifetimeUsd: "0.00" });
    } else {
      statusBar.set({ kind: "signedOut" });
    }
  };

  const tick = async (force = false) => {
    if (force || portfolio.stale) {
      const p = await portfolio.refresh();
      lastRefreshOk = p !== null;
    }
    paint();
  };

  void tick(true);
  ticker = setInterval(() => void tick(), TICK_MS);

  const register = (id: string, fn: () => void | Promise<void>) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register("meanwhile.signIn", async () => {
    if (auth.signedIn) {
      vscode.window.showInformationMessage("Meanwhile: already signed in.");
      return;
    }
    const ok = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Meanwhile sign-in",
        cancellable: false,
      },
      async (p) => {
        try {
          return await auth.signIn((msg) => p.report({ message: msg }));
        } catch (e) {
          dlog("ext", "sign-in failed", { e: String(e) });
          return false;
        }
      },
    );
    if (ok) {
      vscode.window.showInformationMessage(
        "Meanwhile: signed in — you're earning on every sponsor line now.",
      );
      await tick(true);
    } else {
      vscode.window.showWarningMessage(
        "Meanwhile: sign-in didn't complete. Try again from the status bar.",
      );
    }
  });

  register("meanwhile.signOut", async () => {
    await auth.signOut();
    await tick(true);
    vscode.window.showInformationMessage(
      "Meanwhile: signed out. Sponsor lines keep showing as previews; nothing earns.",
    );
  });

  register("meanwhile.restore", async () => {
    // M1c–M1e: revert every patched surface byte-for-byte from backups.
    vscode.window.showInformationMessage(
      "Meanwhile: nothing to restore yet (no surfaces patched).",
    );
  });

  register("meanwhile.status", async () => {
    const p = portfolio.portfolio;
    vscode.window.showInformationMessage(
      [
        `Meanwhile — ${auth.signedIn ? "signed in" : "signed out"}`,
        `backend ${cfg.backendBaseUrl}`,
        `sponsors cached: ${p?.sponsors.length ?? 0}`,
        `loopback :${loopback?.port || "off"}`,
      ].join(" · "),
    );
  });

  register("meanwhile.diagnose", async () => {
    vscode.window.showInformationMessage(
      "Meanwhile: surface detection report lands with the patchers (M1c–M1e).",
    );
  });

  register("meanwhile.menu", async () => {
    const items = auth.signedIn
      ? [
          { label: "$(sign-out) Sign out", cmd: "meanwhile.signOut" },
          { label: "$(discard) Restore editor", cmd: "meanwhile.restore" },
          { label: "$(info) Show status", cmd: "meanwhile.status" },
          { label: "$(bug) Diagnose", cmd: "meanwhile.diagnose" },
        ]
      : [
          { label: "$(sign-in) Sign in", cmd: "meanwhile.signIn" },
          { label: "$(info) Show status", cmd: "meanwhile.status" },
          { label: "$(bug) Diagnose", cmd: "meanwhile.diagnose" },
        ];
    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: "Meanwhile",
    });
    if (pick) await vscode.commands.executeCommand(pick.cmd);
  });
}

export function deactivate(): void {
  dlog("ext", "deactivate");
  statusBar?.dispose();
  loopback?.dispose();
  metrics?.dispose();
  if (ticker) clearInterval(ticker);
}
