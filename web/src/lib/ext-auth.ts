import { and, eq, gt, isNull } from "drizzle-orm";
import type {
  ExtAuthPollResponse,
  ExtAuthRefreshResponse,
} from "@shared/contract";
import { db } from "@/db";
import { extAuthRequest, extSession } from "@/db/schema";
import { newId, randomToken, sha256hex } from "@/lib/ids";

/**
 * The extension's own opaque-token layer — deliberately independent of the web
 * auth provider (better-auth). The browser sign-in only needs to call
 * `bindAuthRequest(state, userId)` once a user is authenticated; everything the
 * extension sees (start/poll/refresh/signout) lives here. We store only token
 * hashes, never the raw tokens.
 */

const STATE_TTL_MS = 10 * 60 * 1000; // sign-in window
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60d

/** Step 1: extension mints a pending request and gets a `state` to poll. */
export async function createAuthRequest(): Promise<{
  state: string;
  expiresInSec: number;
}> {
  const state = randomToken(24);
  await db.insert(extAuthRequest).values({
    state,
    status: "pending",
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  return { state, expiresInSec: Math.floor(STATE_TTL_MS / 1000) };
}

/** Step 2 (web sign-in page): bind an authenticated user to the request.
 *  Idempotent-safe; only flips a still-pending, unexpired request. */
export async function bindAuthRequest(
  state: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .update(extAuthRequest)
    .set({ status: "complete", userId })
    .where(
      and(
        eq(extAuthRequest.state, state),
        eq(extAuthRequest.status, "pending"),
        gt(extAuthRequest.expiresAt, new Date()),
      ),
    )
    .returning({ state: extAuthRequest.state });
  return rows.length > 0;
}

async function issueTokens(
  userId: string,
): Promise<ExtAuthRefreshResponse> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  await db.insert(extSession).values({
    id: newId("xs"),
    userId,
    accessTokenHash: sha256hex(accessToken),
    refreshTokenHash: sha256hex(refreshToken),
    accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken };
}

/** DEV ONLY: mint a session directly for a user (used by the dev-login route).
 *  Never call from production paths — the browser sign-in flow is the real one. */
export async function devIssueTokensForUser(
  userId: string,
): Promise<ExtAuthRefreshResponse> {
  return issueTokens(userId);
}

/** Step 3: extension polls. Once complete, we mint tokens exactly once and
 *  mark the request consumed. */
export async function pollAuthRequest(
  state: string,
): Promise<ExtAuthPollResponse> {
  const [r] = await db
    .select()
    .from(extAuthRequest)
    .where(eq(extAuthRequest.state, state))
    .limit(1);
  if (!r || r.expiresAt < new Date()) return { status: "expired" };
  if (r.status === "pending") return { status: "pending" };
  if (r.status === "complete" && r.userId) {
    const tokens = await issueTokens(r.userId);
    await db
      .update(extAuthRequest)
      .set({ status: "consumed" })
      .where(eq(extAuthRequest.state, state));
    return { status: "complete", ...tokens };
  }
  // consumed already, or complete-without-user (shouldn't happen)
  return { status: "expired" };
}

/** Resolve an access token to a userId, or null if invalid/expired/revoked. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  const [s] = await db
    .select({ userId: extSession.userId })
    .from(extSession)
    .where(
      and(
        eq(extSession.accessTokenHash, sha256hex(token)),
        isNull(extSession.revokedAt),
        gt(extSession.accessExpiresAt, new Date()),
      ),
    )
    .limit(1);
  return s?.userId ?? null;
}

/** Rotate a refresh token in place, returning a fresh access+refresh pair. */
export async function rotateRefresh(
  refreshToken: string,
): Promise<ExtAuthRefreshResponse | null> {
  const [s] = await db
    .select()
    .from(extSession)
    .where(
      and(
        eq(extSession.refreshTokenHash, sha256hex(refreshToken)),
        isNull(extSession.revokedAt),
        gt(extSession.refreshExpiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!s) return null;
  const accessToken = randomToken(32);
  const newRefresh = randomToken(32);
  await db
    .update(extSession)
    .set({
      accessTokenHash: sha256hex(accessToken),
      refreshTokenHash: sha256hex(newRefresh),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      rotatedAt: new Date(),
    })
    .where(eq(extSession.id, s.id));
  return { accessToken, refreshToken: newRefresh };
}

/** Revoke the session a refresh token belongs to (sign-out). */
export async function revokeByRefresh(refreshToken: string): Promise<void> {
  await db
    .update(extSession)
    .set({ revokedAt: new Date() })
    .where(eq(extSession.refreshTokenHash, sha256hex(refreshToken)));
}
