import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PortfolioResponse,
  Sponsor,
  Surface,
} from "../../shared/contract";
import { routes } from "../../shared/contract";
import type { AuthService } from "./auth";
import { meanwhileDir } from "./config";
import { fetchJson } from "./http";
import { dlog } from "./log";

/** On-disk cache consumed by the CLI surfaces (statusline script, wrappers).
 *  Tokens never appear here — only displayable sponsor data. */
export interface SponsorCacheFile {
  updatedAtMs: number;
  ttlMs: number;
  rotationIntervalMs: number;
  viewThresholdMs: number;
  sponsors: Sponsor[];
}

export const SPONSOR_CACHE_FILE = "sponsors.json";

/**
 * Fetches and caches the sponsor portfolio. One service instance serves every
 * surface: webviews pull from memory via the loopback, CLI scripts read the
 * JSON cache this writes after each refresh.
 */
export class PortfolioService {
  private current: PortfolioResponse | null = null;
  private fetchedAtMs = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly base: string,
    private readonly clientId: string,
  ) {}

  get portfolio(): PortfolioResponse | null {
    return this.current;
  }

  get stale(): boolean {
    if (!this.current) return true;
    return Date.now() - this.fetchedAtMs > this.current.ttlMs;
  }

  /** The sponsor for "now": time-slot rotation through the queue so every
   *  surface shows the same line at the same moment without coordination. */
  currentSponsor(): Sponsor | null {
    const p = this.current;
    if (!p || p.sponsors.length === 0) return null;
    const slot = Math.floor(Date.now() / Math.max(p.rotationIntervalMs, 5000));
    return p.sponsors[slot % p.sponsors.length];
  }

  async refresh(surface: Surface = "cc_webview"): Promise<PortfolioResponse | null> {
    try {
      const p = await this.auth.withAuth((bearer) =>
        fetchJson<PortfolioResponse>(
          this.base + routes.portfolio(surface, this.clientId),
          {
            headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
          },
        ),
      );
      this.current = p;
      this.fetchedAtMs = Date.now();
      this.writeCliCache(p);
      dlog("portfolio", "refreshed", {
        n: p.sponsors.length,
        signedIn: this.auth.signedIn,
      });
      return p;
    } catch (e) {
      dlog("portfolio", "refresh failed", { e: String(e) });
      return null;
    }
  }

  /** Mirror the latest portfolio for out-of-process CLI surfaces. */
  private writeCliCache(p: PortfolioResponse): void {
    const file: SponsorCacheFile = {
      updatedAtMs: Date.now(),
      ttlMs: p.ttlMs,
      rotationIntervalMs: p.rotationIntervalMs,
      viewThresholdMs: p.viewThresholdMs,
      sponsors: p.sponsors,
    };
    try {
      writeFileSync(
        join(meanwhileDir(), SPONSOR_CACHE_FILE),
        JSON.stringify(file, null, 2) + "\n",
        { mode: 0o600 },
      );
    } catch (e) {
      dlog("portfolio", "cli cache write failed", { e: String(e) });
    }
  }
}
