import { and, desc, eq, gte, sql } from "drizzle-orm";
import type {
  Balances,
  EarningsResponse,
  MetricBeacon,
  PortfolioResponse,
  Sponsor,
  Surface,
} from "@shared/contract";
import { db } from "@/db";
import { campaign, device, event } from "@/db/schema";
import { newId, randomToken } from "@/lib/ids";
import { microToUsdString } from "@/lib/money";

const QUEUE_DEPTH = 10;
const TTL_MS = 90_000;
const ROTATION_MS = 30_000;
const VIEW_THRESHOLD_MS = 3_000;
/** Clicks bill at 50× a counted impression. */
const CLICK_MULTIPLIER = 50n;

type CampaignRow = typeof campaign.$inferSelect;

function toSponsor(c: CampaignRow): Sponsor {
  return {
    sponsorId: c.id,
    campaignId: c.id,
    text: c.text,
    brand: c.brand ?? undefined,
    iconUrl: c.iconUrl ?? undefined,
    clickUrl: c.clickUrl,
    sessionToken: randomToken(16),
    ...(c.isDemo ? { demo: true } : {}),
  };
}

/** Record/refresh the device and (when signed in) link it to the user. Never
 *  clobbers an existing userId with null. */
async function touchDevice(
  clientId: string,
  userId: string | null,
  env?: Record<string, unknown>,
): Promise<void> {
  if (!clientId) return;
  await db
    .insert(device)
    .values({
      clientId,
      userId: userId ?? null,
      env: env ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: device.clientId,
      set: {
        lastSeenAt: new Date(),
        ...(userId ? { userId } : {}),
        ...(env ? { env } : {}),
      },
    });
}

export async function getPortfolio(opts: {
  userId: string | null;
  surface: Surface;
  clientId: string;
}): Promise<PortfolioResponse> {
  await touchDevice(opts.clientId, opts.userId);

  const active = eq(campaign.status, "active");
  const hasBudget = sql`(${campaign.impressionsPurchased} = 0 OR ${campaign.impressionsServed} < ${campaign.impressionsPurchased})`;
  // Signed-in users get crediting (non-demo) inventory; signed-out get the
  // demo preview pool. Highest price serves first.
  const where = opts.userId
    ? and(active, hasBudget, eq(campaign.isDemo, false))
    : and(active, hasBudget, eq(campaign.isDemo, true));

  const rows = await db
    .select()
    .from(campaign)
    .where(where)
    .orderBy(desc(campaign.pricePerThousandMicro))
    .limit(QUEUE_DEPTH);

  const balances: Balances | null = opts.userId
    ? await (async () => {
        const e = await getEarnings(opts.userId as string);
        return {
          lifetimeUsd: e.lifetimeUsd,
          todayUsd: e.todayUsd,
          lastUpdatedMs: Date.now(),
        };
      })()
    : null;

  return {
    sponsors: rows.map(toSponsor),
    ttlMs: TTL_MS,
    rotationIntervalMs: ROTATION_MS,
    viewThresholdMs: VIEW_THRESHOLD_MS,
    balances,
  };
}

/** What an event costs the advertiser (µUSD). Only counted-impressions and
 *  clicks bill; first-paint and heartbeats are recorded at $0. */
function chargeForEvent(
  ev: MetricBeacon["event"],
  pricePerThousandMicro: bigint,
): bigint {
  if (ev === "view_threshold_met" || ev === "error_impression") {
    return pricePerThousandMicro / 1000n;
  }
  if (ev === "click") {
    return (pricePerThousandMicro * CLICK_MULTIPLIER) / 1000n;
  }
  return 0n;
}

/** Ingest one beacon. Deduplicated by nonce; bills the advertiser and credits
 *  the user (50%) at ingest time so earnings never need re-pricing. */
export async function ingestMetric(
  beacon: MetricBeacon,
  userId: string | null,
): Promise<{ accepted: boolean }> {
  const [c] = await db
    .select()
    .from(campaign)
    .where(eq(campaign.id, beacon.campaignId))
    .limit(1);

  const price = c?.pricePerThousandMicro ?? 0n;
  const isDemo = c?.isDemo === true || userId === null;
  const charged = c ? chargeForEvent(beacon.event, price) : 0n;
  // Demo traffic charges the advertiser but credits no user; otherwise the
  // user earns 50% of whatever the advertiser was charged for this event.
  const credited = isDemo ? 0n : charged / 2n;

  const inserted = await db
    .insert(event)
    .values({
      id: newId("ev"),
      campaignId: c?.id ?? null,
      userId: isDemo ? null : userId,
      clientId: beacon.clientId,
      surface: beacon.surface,
      event: beacon.event,
      nonce: beacon.nonce,
      sessionToken: beacon.sessionToken,
      visibleMs: beacon.visibleMs ?? null,
      chargedMicro: charged,
      creditedMicro: credited,
      isDemo,
    })
    .onConflictDoNothing({ target: event.nonce })
    .returning({ id: event.id });

  // Consume campaign budget exactly once per accepted event. A click burns
  // CLICK_MULTIPLIER impressions so total user credits can never exceed the
  // advertiser's prepaid block value.
  const budgetCost =
    beacon.event === "view_threshold_met"
      ? 1n
      : beacon.event === "click"
        ? CLICK_MULTIPLIER
        : 0n;
  if (inserted.length > 0 && c && budgetCost > 0n) {
    await db
      .update(campaign)
      .set({
        impressionsServed: sql`${campaign.impressionsServed} + ${budgetCost}`,
        updatedAt: new Date(),
      })
      .where(eq(campaign.id, c.id));
    // Flip to exhausted once a finite budget is fully consumed.
    if (c.impressionsPurchased > 0n) {
      await db
        .update(campaign)
        .set({ status: "exhausted" })
        .where(
          and(
            eq(campaign.id, c.id),
            eq(campaign.status, "active"),
            sql`${campaign.impressionsServed} >= ${campaign.impressionsPurchased}`,
          ),
        );
    }
  }

  return { accepted: inserted.length > 0 };
}

export async function getEarnings(userId: string): Promise<EarningsResponse> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [lifetime] = await db
    .select({
      v: sql<string>`coalesce(sum(${event.creditedMicro}), 0)::text`,
    })
    .from(event)
    .where(eq(event.userId, userId));

  const [today] = await db
    .select({
      v: sql<string>`coalesce(sum(${event.creditedMicro}), 0)::text`,
    })
    .from(event)
    .where(and(eq(event.userId, userId), gte(event.createdAt, startOfDay)));

  return {
    lifetimeUsd: microToUsdString(BigInt(lifetime?.v ?? "0")),
    todayUsd: microToUsdString(BigInt(today?.v ?? "0")),
  };
}
