import { createAuthRequest } from "@/lib/ext-auth";
import { env } from "@/env";
import { jsonResponse, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST() {
  const { state, expiresInSec } = await createAuthRequest();
  const authUrl = `${env.NEXT_PUBLIC_APP_URL}/ext/authorize?state=${encodeURIComponent(state)}`;
  return jsonResponse({ state, authUrl, expiresInSec });
}
