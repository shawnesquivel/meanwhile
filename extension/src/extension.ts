import * as vscode from "vscode";
import { readConfig } from "./config";
import { dlog, setDebug } from "./log";
import { StatusBar } from "./statusbar";

/**
 * Meanwhile extension entry point.
 *
 * M0 scaffold: activates, resolves config, renders the status bar, and wires
 * every command so the surface is real and reversible from day one. The
 * ad-serving loop, auth, and editor patching land in M1 (see milestones).
 */

let statusBar: StatusBar | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const cfg = readConfig();
  setDebug(cfg.debug);
  dlog("ext", "activate", { backendBaseUrl: cfg.backendBaseUrl });

  statusBar = new StatusBar();
  context.subscriptions.push({ dispose: () => statusBar?.dispose() });

  const register = (id: string, fn: () => void | Promise<void>) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register("meanwhile.signIn", async () => {
    // M1: backend-brokered sign-in via our own token layer.
    vscode.window.showInformationMessage(
      "Meanwhile sign-in lands in M1. Backend: " + cfg.backendBaseUrl,
    );
  });

  register("meanwhile.signOut", async () => {
    vscode.window.showInformationMessage("Meanwhile: signed out.");
    statusBar?.set({ kind: "signedOut" });
  });

  register("meanwhile.restore", async () => {
    // M1: revert every patched surface byte-for-byte from backups.
    vscode.window.showInformationMessage(
      "Meanwhile: nothing to restore yet (no surfaces patched in M0).",
    );
  });

  register("meanwhile.status", async () => {
    vscode.window.showInformationMessage(
      `Meanwhile — backend ${cfg.backendBaseUrl}, debug ${cfg.debug ? "on" : "off"}.`,
    );
  });

  register("meanwhile.diagnose", async () => {
    vscode.window.showInformationMessage(
      "Meanwhile: diagnostics land in M1 (surface detection report).",
    );
  });

  register("meanwhile.menu", async () => {
    const pick = await vscode.window.showQuickPick(
      [
        { label: "$(sign-in) Sign in", cmd: "meanwhile.signIn" },
        { label: "$(sign-out) Sign out", cmd: "meanwhile.signOut" },
        { label: "$(discard) Restore editor", cmd: "meanwhile.restore" },
        { label: "$(info) Show status", cmd: "meanwhile.status" },
        { label: "$(bug) Diagnose", cmd: "meanwhile.diagnose" },
      ],
      { placeHolder: "Meanwhile" },
    );
    if (pick) await vscode.commands.executeCommand(pick.cmd);
  });
}

export function deactivate(): void {
  dlog("ext", "deactivate");
  statusBar?.dispose();
}
