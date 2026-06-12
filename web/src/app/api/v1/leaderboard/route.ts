import { createHash } from "node:crypto";
import { desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { campaign, event } from "@/db/schema";
import { db } from "@/db";
import { jsonResponse, preflight } from "@/lib/http";
import { microToUsdString } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Anonymous, stable, non-reversible handle for the public board. */
function anonHandle(userId: string): string {
  return `dev_${createHash("sha256").update(userId).digest("hex").slice(0, 6)}`;
}

/** Public leaderboard: top earners (30d, anonymized) + top sponsors. */
export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const earners = await db
    .select({
      userId: event.userId,
      total: sql<string>`sum(${event.creditedMicro})`,
      impressions: sql<string>`count(*) filter (where ${event.event} = 'view_threshold_met')`,
      clicks: sql<string>`count(*) filter (where ${event.event} = 'click')`,
    })
    .from(event)
    .where(gte(event.createdAt, since))
    .groupBy(event.userId)
    .having(sql`${isNotNull(event.userId)} and sum(${event.creditedMicro}) > 0`)
    .orderBy(desc(sql`sum(${event.creditedMicro})`))
    .limit(20);

  const sponsors = await db
    .select({
      brand: campaign.brand,
      text: campaign.text,
      served: campaign.impressionsServed,
      tier: campaign.tier,
    })
    .from(campaign)
    .where(eq(campaign.showOnLeaderboard, true))
    .orderBy(desc(campaign.impressionsServed))
    .limit(20);

  return jsonResponse({
    earners: earners
      .filter((e) => e.userId)
      .map((e, i) => ({
        rank: i + 1,
        handle: anonHandle(e.userId as string),
        earnedUsd: microToUsdString(BigInt(e.total ?? 0)),
        impressions: Number(e.impressions ?? 0),
        clicks: Number(e.clicks ?? 0),
      })),
    sponsors: sponsors.map((s, i) => ({
      rank: i + 1,
      brand: s.brand,
      text: s.text,
      tier: s.tier,
      impressionsServed: Number(s.served),
    })),
    windowDays: 30,
  });
}
