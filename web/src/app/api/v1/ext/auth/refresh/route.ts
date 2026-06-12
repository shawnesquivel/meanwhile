import type { NextRequest } from "next/server";
import { rotateRefresh } from "@/lib/ext-auth";
import { jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    refreshToken?: string;
  } | null;
  if (!body?.refreshToken) {
    return jsonResponse({ error: "missing refreshToken" }, 400);
  }
  const tokens = await rotateRefresh(body.refreshToken);
  if (!tokens) return jsonResponse({ error: "invalid refresh token" }, 401);
  return jsonResponse(tokens);
}
