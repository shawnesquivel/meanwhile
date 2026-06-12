import { usdToMicro } from "./money";

/**
 * Fixed-price rate card — the deliberate difference from auction-style
 * spinner ads. Every block is 1,000 counted impressions at a flat price;
 * Boost costs more and serves ahead of Standard because the queue orders by
 * price. No bidding wars, no surprise CPMs.
 */

export interface Tier {
  id: "standard" | "boost";
  name: string;
  usdPerBlock: number; // 1 block = 1,000 counted impressions
  blurb: string;
}

export const BLOCK_IMPRESSIONS = 1000n;

export const TIERS: readonly Tier[] = [
  {
    id: "standard",
    name: "Standard",
    usdPerBlock: 5,
    blurb: "Joins the rotation. $5 per 1,000 counted impressions.",
  },
  {
    id: "boost",
    name: "Boost",
    usdPerBlock: 15,
    blurb: "Serves ahead of Standard. $15 per 1,000 counted impressions.",
  },
] as const;

export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function pricePerThousandMicro(tier: Tier): bigint {
  return usdToMicro(tier.usdPerBlock);
}

export const MAX_BLOCKS = 100;
export const TEXT_MIN = 3;
export const TEXT_MAX = 60;
