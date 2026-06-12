import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { payoutRequest } from "@/db/schema";
import { auth } from "@/lib/auth";
import { availableBalanceMicro, MIN_PAYOUT_MICRO } from "@/lib/earnings";
import { jsonResponse } from "@/lib/http";
import { newId } from "@/lib/ids";
import { microToUsdString } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  const rows = await db
    .select()
    .from(payoutRequest)
    .where(eq(payoutRequest.userId, session.user.id))
    .orderBy(desc(payoutRequest.createdAt));

  return jsonResponse({
    payouts: rows.map((p) => ({
      id: p.id,
      amountUsd: microToUsdString(p.amountMicro),
      status: p.status,
      method: p.method,
      requestedAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
    })),
  });
}

const bodySchema = z.object({
  /** Free-text destination, e.g. "paypal: you@example.com". */
  method: z.string().min(5).max(200),
});

/** Requests the FULL available balance (≥ minimum). Keeps the ledger simple. */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "invalid input" }, 400);

  const balance = await availableBalanceMicro(session.user.id);
  if (balance < MIN_PAYOUT_MICRO) {
    return jsonResponse(
      {
        error: `minimum payout is $${microToUsdString(MIN_PAYOUT_MICRO)}`,
        balanceUsd: microToUsdString(balance),
      },
      400,
    );
  }

  const id = newId("pay");
  await db.insert(payoutRequest).values({
    id,
    userId: session.user.id,
    amountMicro: balance,
    method: parsed.data.method,
    status: "pending",
  });

  return jsonResponse({
    ok: true,
    id,
    amountUsd: microToUsdString(balance),
    status: "pending",
  });
}
