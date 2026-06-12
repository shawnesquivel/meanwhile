import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { campaign } from "@/db/schema";
import { auth } from "@/lib/auth";
import { jsonResponse } from "@/lib/http";
import { microToUsdString } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in advertiser's campaigns with delivery state. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  const rows = await db
    .select()
    .from(campaign)
    .where(eq(campaign.userId, session.user.id))
    .orderBy(desc(campaign.createdAt));

  return jsonResponse({
    campaigns: rows.map((c) => ({
      id: c.id,
      brand: c.brand,
      text: c.text,
      clickUrl: c.clickUrl,
      status: c.status,
      tier: c.tier,
      pricePerThousandUsd: microToUsdString(c.pricePerThousandMicro),
      impressionsPurchased: Number(c.impressionsPurchased),
      impressionsServed: Number(c.impressionsServed),
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
