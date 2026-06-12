import { NextResponse } from "next/server";

/** Permissive CORS for the extension-facing API. The extension calls these
 *  from its Node process (CORS-irrelevant), but `*` lets us also exercise them
 *  from a browser during testing without friction. No cookies are used here —
 *  auth is Bearer-only — so `*` is safe. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data as object, { status, headers: CORS_HEADERS });
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Extract a Bearer access token from the Authorization header, or null. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

export const OPTIONS = preflight;
