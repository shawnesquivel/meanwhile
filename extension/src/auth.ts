import * as vscode from "vscode";
import type {
  ExtAuthPollResponse,
  ExtAuthRefreshResponse,
  ExtAuthStartResponse,
} from "../../shared/contract";
import { routes } from "../../shared/contract";
import { fetchJson, HttpError } from "./http";
import { dlog } from "./log";

const SECRET_KEY = "meanwhile.tokens.v1";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Extension-side auth against our opaque token layer. The flow is
 * start → open browser → poll → store; tokens live ONLY in VS Code
 * SecretStorage (never on disk), and the refresh token rotates on every use.
 */
export class AuthService {
  private tokens: StoredTokens | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly base: string,
    private readonly clientId: string,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = await this.secrets.get(SECRET_KEY);
      if (raw) this.tokens = JSON.parse(raw) as StoredTokens;
    } catch {
      this.tokens = null;
    }
  }

  get signedIn(): boolean {
    return this.tokens !== null;
  }

  get accessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  private async persist(t: StoredTokens | null): Promise<void> {
    this.tokens = t;
    if (t) await this.secrets.store(SECRET_KEY, JSON.stringify(t));
    else await this.secrets.delete(SECRET_KEY);
  }

  /** Full interactive sign-in. Returns true when tokens were obtained. */
  async signIn(progress?: (msg: string) => void): Promise<boolean> {
    const start = await fetchJson<ExtAuthStartResponse>(
      this.base + routes.authStart(),
      { method: "POST", body: JSON.stringify({ clientId: this.clientId }) },
    );
    dlog("auth", "start ok", { state: start.state.slice(0, 6) + "…" });
    progress?.("Opening browser…");
    await vscode.env.openExternal(vscode.Uri.parse(start.authUrl));

    const deadline = Date.now() + start.expiresInSec * 1000;
    progress?.("Waiting for you to finish signing in…");
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      let poll: ExtAuthPollResponse;
      try {
        poll = await fetchJson<ExtAuthPollResponse>(
          this.base + routes.authPoll(start.state),
        );
      } catch (e) {
        dlog("auth", "poll error (retrying)", { e: String(e) });
        continue;
      }
      if (poll.status === "complete" && poll.accessToken && poll.refreshToken) {
        await this.persist({
          accessToken: poll.accessToken,
          refreshToken: poll.refreshToken,
        });
        dlog("auth", "sign-in complete");
        return true;
      }
      if (poll.status === "expired") break;
    }
    dlog("auth", "sign-in expired/abandoned");
    return false;
  }

  /** Rotate the refresh token. Single-flight so concurrent 401s refresh once. */
  async refresh(): Promise<boolean> {
    if (!this.tokens) return false;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const r = await fetchJson<ExtAuthRefreshResponse>(
          this.base + routes.authRefresh(),
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: this.tokens?.refreshToken }),
          },
        );
        await this.persist({
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
        });
        dlog("auth", "refresh ok");
        return true;
      } catch (e) {
        // Invalid/revoked refresh token → fully signed out.
        if (e instanceof HttpError && (e.status === 401 || e.status === 400)) {
          await this.persist(null);
        }
        dlog("auth", "refresh failed", { e: String(e) });
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const rt = this.tokens?.refreshToken;
    await this.persist(null);
    if (!rt) return;
    try {
      await fetchJson(this.base + routes.authSignout(), {
        method: "POST",
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch (e) {
      dlog("auth", "signout beacon failed (local state cleared)", {
        e: String(e),
      });
    }
  }

  /**
   * Run an authenticated request; on 401, refresh once and retry. Falls back
   * to an anonymous call when signed out (portfolio supports both).
   */
  async withAuth<T>(fn: (bearer: string | null) => Promise<T>): Promise<T> {
    if (!this.tokens) return fn(null);
    try {
      return await fn(this.tokens.accessToken);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        const ok = await this.refresh();
        return fn(ok ? (this.tokens?.accessToken ?? null) : null);
      }
      throw e;
    }
  }
}
