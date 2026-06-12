/**
 * Meanwhile — shared API contract.
 *
 * The single source of truth for the wire shapes exchanged between the web
 * backend (`web/`) and the editor extension (`extension/`). Both import this
 * file directly so a contract change can never drift between the two halves.
 *
 * Design rule (modular auth): the extension NEVER talks to the web auth
 * provider (better-auth/Clerk/etc.) directly. It uses our own opaque-token
 * layer below (`/api/ext/auth/*`). Swapping the web provider later touches
 * only the browser sign-in page, never anything in here.
 */

/** API version prefix for every extension-facing route. */
export const API_VERSION = "v1" as const;

/** Where a sponsor line is being rendered. Drives per-surface billing and
 *  lets the backend segment delivery by client type. */
export type Surface =
  | "cc_webview" // Claude Code VS Code/Cursor panel (rich overlay)
  | "cc_cli_statusline" // Claude Code terminal status-bar OSC-8 link
  | "cc_cli_spinner" // Claude Code terminal thinking-verb (CC >= 2.1.143)
  | "codex_cli" // Codex CLI startup banner (PATH wrapper)
  | "codex_webview"; // Codex VS Code panel

export const ALL_SURFACES: readonly Surface[] = [
  "cc_webview",
  "cc_cli_statusline",
  "cc_cli_spinner",
  "codex_cli",
  "codex_webview",
];

export function parseSurface(raw: string | null | undefined): Surface | undefined {
  return raw && (ALL_SURFACES as readonly string[]).includes(raw)
    ? (raw as Surface)
    : undefined;
}

/** A single served sponsor creative (we call them "sponsors", not "ads"). */
export interface Sponsor {
  /** Stable id of this served impression-eligible creative. */
  sponsorId: string;
  campaignId: string;
  /** The one-line text shown in the spinner/status surface (3–60 chars). */
  text: string;
  /** Brand name for the leaderboard (optional). */
  brand?: string;
  /** Absolute https icon URL (optional; surfaces fall back to a glyph). */
  iconUrl?: string;
  /** Absolute https landing URL opened on click. */
  clickUrl: string;
  /** Opaque per-serve token the client echoes back on every metric beacon so
   *  the backend can bind an event to exactly this serve (anti-spoof). */
  sessionToken: string;
  /** True when this came from the signed-out DEMO inventory: it renders
   *  identically and the click opens the real URL, but metrics route to the
   *  demo sink (advertiser charged, no user credited). */
  demo?: boolean;
}

/** Display-only earnings for the status bar (the user's 50% share). */
export interface Balances {
  lifetimeUsd: string; // formatted decimal string, e.g. "7.11"
  todayUsd: string;
  lastUpdatedMs: number;
}

/** GET /v1/portfolio response. The extension drains `sponsors` in order,
 *  rotating every `rotationIntervalMs`, refetching when the queue empties or
 *  `ttlMs` elapses. */
export interface PortfolioResponse {
  sponsors: Sponsor[];
  /** How long the client should cache this response before refetching. */
  ttlMs: number;
  /** Minimum gap between on-disk rotations (floored server-side to protect
   *  the host from a hostile/buggy value rewriting CC's 4.6 MB bundle). */
  rotationIntervalMs: number;
  /** Cumulative visible time a sponsor must accrue before it bills as a
   *  viewable impression. */
  viewThresholdMs: number;
  /** Signed-in only; null for demo/anonymous fetches. */
  balances: Balances | null;
}

/** Billable lifecycle events. `impression` = first paint; `viewable` =
 *  crossed the view threshold; `view_tick` = periodic heartbeat while
 *  visible; `click` = anchor opened; `error_impression` = safety-net fire so
 *  a stuck-but-visible sponsor still bills once. */
export type MetricEvent =
  | "impression"
  | "viewable"
  | "view_tick"
  | "view_threshold_met"
  | "click"
  | "error_impression";

export const BILLABLE_EVENTS: readonly MetricEvent[] = [
  "impression",
  "viewable",
  "view_tick",
  "view_threshold_met",
  "click",
  "error_impression",
];

/** POST /v1/metrics body. Sent with a Bearer token when signed in, else it
 *  routes to the demo sink. `nonce` dedupes retries; `sessionToken` binds the
 *  event to a specific serve. */
export interface MetricBeacon {
  event: MetricEvent;
  sponsorId: string;
  campaignId: string;
  surface: Surface;
  /** Stable anonymous device id (minted client-side, persisted locally). */
  clientId: string;
  /** Per-serve token from the Sponsor. */
  sessionToken: string;
  /** UUID v4, unique per event; backend ignores duplicates. */
  nonce: string;
  /** ISO timestamp (client clock; backend stamps its own too). */
  ts: string;
  /** Cumulative visible ms at the moment of the event (for view/click floors). */
  visibleMs?: number;
  /** Client environment fingerprint for traffic segmentation (os/arch/editor). */
  client?: Record<string, unknown>;
}

/** GET /v1/earnings response (signed-in). */
export interface EarningsResponse {
  lifetimeUsd: string;
  todayUsd: string;
}

// --- Extension auth (our own token layer; provider-agnostic) ---------------

/** POST /v1/ext/auth/start response. The extension opens `authUrl` in the
 *  system browser and polls with `state`. */
export interface ExtAuthStartResponse {
  state: string;
  authUrl: string;
  /** How long the client should poll before giving up (seconds). */
  expiresInSec: number;
}

/** GET /v1/ext/auth/poll?state= response. */
export interface ExtAuthPollResponse {
  status: "pending" | "complete" | "expired";
  accessToken?: string;
  refreshToken?: string;
}

/** POST /v1/ext/auth/refresh body + response. The refresh token ROTATES:
 *  the response always carries a fresh one to persist. */
export interface ExtAuthRefreshRequest {
  refreshToken: string;
}
export interface ExtAuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Route builders so callers never hand-concatenate paths. Paths are relative
 *  to the backend base URL and include the Next.js `/api` mount. */
const P = `/api/${API_VERSION}` as const;

export const routes = {
  portfolio: (surface: Surface, clientId: string) =>
    `${P}/portfolio?surface=${encodeURIComponent(surface)}&client_id=${encodeURIComponent(clientId)}`,
  metrics: () => `${P}/metrics`,
  earnings: () => `${P}/earnings`,
  authStart: () => `${P}/ext/auth/start`,
  authPoll: (state: string) =>
    `${P}/ext/auth/poll?state=${encodeURIComponent(state)}`,
  authRefresh: () => `${P}/ext/auth/refresh`,
  authSignout: () => `${P}/ext/auth/signout`,
} as const;
