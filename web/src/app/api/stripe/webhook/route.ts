import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { campaign } from "@/db/schema";
import { env } from "@/env";
import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe → activate the funded campaign. Signature-verified. */
export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "stripe not configured" }, 501);
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return jsonResponse({ error: "bad signature" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const campaignId = session.metadata?.campaignId;
    if (campaignId) {
      await db
        .update(campaign)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(campaign.id, campaignId));
    }
  }

  return jsonResponse({ received: true });
}
