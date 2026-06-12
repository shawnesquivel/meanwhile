import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindAuthRequest } from "@/lib/ext-auth";
import { jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * Browser-side step of the extension sign-in: the signed-in web session
 * claims a pending `state` minted by the extension. This is the ONLY route
 * where the web auth provider meets the extension token layer.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as { state?: string } | null;
  const state = (body?.state || "").trim();
  if (!state) return jsonResponse({ error: "missing state" }, 400);

  const ok = await bindAuthRequest(state, session.user.id);
  return jsonResponse(ok ? { ok: true } : { error: "expired or used" }, ok ? 200 : 410);
}
