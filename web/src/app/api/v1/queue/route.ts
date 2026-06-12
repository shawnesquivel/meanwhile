import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaign } from "@/db/schema";
import { jsonResponse, preflight } from "@/lib/http";
import { microToUsdString } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Public live queue for the landing page. Leaderboard-visible inventory
 *  only; demo rows are flagged so the UI can label the preview pool. */
export async function GET() {
  const rows = await db
    .select()
    .from(campaign)
    .where(
      and(
        eq(campaign.status, "active"),
        eq(campaign.showOnLeaderboard, true),
        ne(campaign.status, "draft"),
        sql`(${campaign.impressionsPurchased} = 0 OR ${campaign.impressionsServed} < ${campaign.impressionsPurchased})`,
      ),
    )
    .orderBy(desc(campaign.pricePerThousandMicro), desc(campaign.createdAt))
    .limit(25);

  return jsonResponse({
    queue: rows.map((c, i) => ({
      rank: i + 1,
      brand: c.brand,
      text: c.text,
      tier: c.tier,
      pricePerThousandUsd: microToUsdString(c.pricePerThousandMicro),
      impressionsServed: Number(c.impressionsServed),
      impressionsPurchased: Number(c.impressionsPurchased),
      demo: c.isDemo,
    })),
  });
}
