import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { event, payoutRequest } from "@/db/schema";
import { usdToMicro } from "./money";

/** Minimum balance before a payout can be requested. */
export const MIN_PAYOUT_MICRO = usdToMicro(10);

const CREDITED = sql<string>`coalesce(sum(${event.creditedMicro}), 0)`;

export async function lifetimeCreditedMicro(userId: string): Promise<bigint> {
  const [row] = await db
    .select({ total: CREDITED })
    .from(event)
    .where(eq(event.userId, userId));
  return BigInt(row?.total ?? 0);
}

export async function todayCreditedMicro(userId: string): Promise<bigint> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: CREDITED })
    .from(event)
    .where(and(eq(event.userId, userId), gte(event.createdAt, dayStart)));
  return BigInt(row?.total ?? 0);
}

/** Pending + paid payouts both lock funds; only rejected ones return them. */
export async function committedPayoutMicro(userId: string): Promise<bigint> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${payoutRequest.amountMicro}), 0)`,
    })
    .from(payoutRequest)
    .where(
      and(eq(payoutRequest.userId, userId), ne(payoutRequest.status, "rejected")),
    );
  return BigInt(row?.total ?? 0);
}

export async function availableBalanceMicro(userId: string): Promise<bigint> {
  const [credited, committed] = await Promise.all([
    lifetimeCreditedMicro(userId),
    committedPayoutMicro(userId),
  ]);
  return credited - committed;
}

export interface RecentEventRow {
  id: string;
  event: string;
  surface: string;
  creditedMicro: bigint;
  createdAt: Date;
}

export async function recentCreditedEvents(
  userId: string,
  limit = 50,
): Promise<RecentEventRow[]> {
  return db
    .select({
      id: event.id,
      event: event.event,
      surface: event.surface,
      creditedMicro: event.creditedMicro,
      createdAt: event.createdAt,
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        inArray(event.event, ["view_threshold_met", "click"]),
      ),
    )
    .orderBy(desc(event.createdAt))
    .limit(limit);
}
