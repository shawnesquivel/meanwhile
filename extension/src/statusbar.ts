import * as vscode from "vscode";

/** The states the status bar can render. */
export type StatusState =
  | { kind: "signedOut" }
  | { kind: "earning"; todayUsd: string; lifetimeUsd: string }
  | { kind: "incompatible" }
  | { kind: "offline" };

/**
 * Single status-bar entry. Clicking it opens the Meanwhile menu. The label is
 * intentionally terse so it sits comfortably among other status items.
 */
export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = "meanwhile.menu";
    this.set({ kind: "signedOut" });
    this.item.show();
  }

  set(state: StatusState): void {
    switch (state.kind) {
      case "signedOut":
        this.item.text = "$(sparkle) Meanwhile: Sign in";
        this.item.tooltip = "Sign in to start earning from sponsor lines.";
        break;
      case "earning":
        this.item.text = `$(sparkle) Meanwhile ($${state.todayUsd} today · $${state.lifetimeUsd})`;
        this.item.tooltip = "You're earning. Click for options.";
        break;
      case "incompatible":
        this.item.text = "$(sparkle) Meanwhile: incompatible";
        this.item.tooltip =
          "No compatible Claude Code / Codex surface found yet. Nothing was changed.";
        break;
      case "offline":
        this.item.text = "$(sparkle) Meanwhile: offline";
        this.item.tooltip = "Backend temporarily unreachable. Retrying…";
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
