import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { db } from "@/db";
import { campaign } from "@/db/schema";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { jsonResponse } from "@/lib/http";
import { newId } from "@/lib/ids";
import {
  BLOCK_IMPRESSIONS,
  MAX_BLOCKS,
  pricePerThousandMicro,
  TEXT_MAX,
  TEXT_MIN,
  tierById,
} from "@/lib/rate-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(TEXT_MIN).max(TEXT_MAX),
  clickUrl: z.string().url().startsWith("https://"),
  brand: z.string().max(40).optional(),
  tier: z.string(),
  blocks: z.number().int().min(1).max(MAX_BLOCKS),
  showOnLeaderboard: z.boolean().default(true),
});

/**
 * Create a campaign and a Stripe Checkout session for it. Without a Stripe
 * key (local dev) the campaign activates immediately so the full serve loop
 * stays testable end-to-end.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonResponse({ error: "invalid input", detail: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const tier = tierById(input.tier);
  if (!tier) return jsonResponse({ error: "unknown tier" }, 400);

  const id = newId("cmp");
  const impressions = BLOCK_IMPRESSIONS * BigInt(input.blocks);
  const totalUsd = tier.usdPerBlock * input.blocks;

  await db.insert(campaign).values({
    id,
    userId: session.user.id,
    brand: input.brand || null,
    text: input.text,
    clickUrl: input.clickUrl,
    status: "pending_payment",
    tier: tier.id,
    pricePerThousandMicro: pricePerThousandMicro(tier),
    impressionsPurchased: impressions,
    showOnLeaderboard: input.showOnLeaderboard,
    contactEmail: session.user.email ?? null,
    isDemo: false,
  });

  // Dev mode: no Stripe configured → activate instantly.
  if (!env.STRIPE_SECRET_KEY) {
    await db
      .update(campaign)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(campaign.id, id));
    return jsonResponse({ ok: true, campaignId: id, dev: true, checkoutUrl: null });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email ?? undefined,
    line_items: [
      {
        quantity: input.blocks,
        price_data: {
          currency: "usd",
          unit_amount: tier.usdPerBlock * 100,
          product_data: {
            name: `Meanwhile ${tier.name} block — 1,000 spinner impressions`,
            description: `"${input.text}"`,
          },
        },
      },
    ],
    metadata: { campaignId: id },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/sponsor?paid=1&campaign=${id}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/sponsor?canceled=1`,
  });

  await db
    .update(campaign)
    .set({ stripeSessionId: checkout.id, updatedAt: new Date() })
    .where(eq(campaign.id, id));

  return jsonResponse({
    ok: true,
    campaignId: id,
    dev: false,
    checkoutUrl: checkout.url,
    totalUsd,
  });
}
