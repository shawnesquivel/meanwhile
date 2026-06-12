import type { NextRequest } from "next/server";
import { pollAuthRequest } from "@/lib/ext-auth";
import { jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  const state = new URL(req.url).searchParams.get("state") || "";
  if (!state) return jsonResponse({ status: "expired" });
  return jsonResponse(await pollAuthRequest(state));
}
