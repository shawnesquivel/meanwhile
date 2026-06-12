import type { NextRequest } from "next/server";
import { parseSurface } from "@shared/contract";
import { verifyAccessToken } from "@/lib/ext-auth";
import { bearer, jsonResponse, preflight } from "@/lib/http";
import { getPortfolio } from "@/lib/serving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const surface = parseSurface(url.searchParams.get("surface")) ?? "cc_webview";
  const clientId = url.searchParams.get("client_id") || "";
  const token = bearer(req);
  const userId = token ? await verifyAccessToken(token) : null;
  const portfolio = await getPortfolio({ userId, surface, clientId });
  return jsonResponse(portfolio);
}
