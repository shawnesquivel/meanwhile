import type { NextRequest } from "next/server";
import { z } from "zod";
import type { MetricBeacon } from "@shared/contract";
import { ALL_SURFACES, BILLABLE_EVENTS } from "@shared/contract";
import { verifyAccessToken } from "@/lib/ext-auth";
import { bearer, jsonResponse, preflight } from "@/lib/http";
import { ingestMetric } from "@/lib/serving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const beaconSchema = z.object({
  event: z.enum(BILLABLE_EVENTS as unknown as [string, ...string[]]),
  sponsorId: z.string().min(1),
  campaignId: z.string().min(1),
  surface: z.enum(ALL_SURFACES as unknown as [string, ...string[]]),
  clientId: z.string().min(1),
  sessionToken: z.string().default(""),
  nonce: z.string().min(8),
  ts: z.string().min(1),
  visibleMs: z.number().int().nonnegative().optional(),
  client: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = beaconSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "invalid beacon" }, 400);
  }
  const token = bearer(req);
  const userId = token ? await verifyAccessToken(token) : null;
  const result = await ingestMetric(parsed.data as MetricBeacon, userId);
  return jsonResponse({ ok: true, accepted: result.accepted });
}
