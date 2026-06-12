import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/ext-auth";
import { bearer, jsonResponse, preflight } from "@/lib/http";
import { getEarnings } from "@/lib/serving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const token = bearer(req);
  const userId = token ? await verifyAccessToken(token) : null;
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401);
  return jsonResponse(await getEarnings(userId));
}
