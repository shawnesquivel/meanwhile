import type { NextRequest } from "next/server";
import { revokeByRefresh } from "@/lib/ext-auth";
import { jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    refreshToken?: string;
  } | null;
  if (body?.refreshToken) await revokeByRefresh(body.refreshToken);
  return jsonResponse({ ok: true });
}
