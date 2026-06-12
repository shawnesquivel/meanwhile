import { db } from "./index";
import { campaign, user } from "./schema";
import { usdToMicro } from "../lib/money";

/**
 * Seed local/dev inventory:
 *  - a fixed test user (for signed-in testing via the dev-login route)
 *  - demo sponsors (shown to signed-out users; credit no one)
 *  - house sponsors (non-demo, active; credit the signed-in user 50%)
 *
 * Idempotent: fixed ids + onConflictDoNothing, so re-running is safe.
 */

const TEST_USER_ID = "usr_test";

type SeedCampaign = {
  id: string;
  brand: string;
  text: string;
  clickUrl: string;
  pricePerThousandUsd: number;
  isDemo: boolean;
};

// Tasteful, dev-relevant "sponsors" (not spammy ads).
const SPONSORS: SeedCampaign[] = [
  { id: "cmp_demo_linear", brand: "Linear", text: "Linear — issue tracking built for speed", clickUrl: "https://linear.app", pricePerThousandUsd: 12, isDemo: true },
  { id: "cmp_demo_neon", brand: "Neon", text: "Neon — serverless Postgres for builders", clickUrl: "https://neon.tech", pricePerThousandUsd: 10, isDemo: true },
  { id: "cmp_demo_vercel", brand: "Vercel", text: "Ship faster on Vercel", clickUrl: "https://vercel.com", pricePerThousandUsd: 9, isDemo: true },
  { id: "cmp_demo_stripe", brand: "Stripe", text: "Stripe — payments for developers", clickUrl: "https://stripe.com", pricePerThousandUsd: 8, isDemo: true },
  { id: "cmp_demo_resend", brand: "Resend", text: "Resend — email for developers", clickUrl: "https://resend.com", pricePerThousandUsd: 6, isDemo: true },
  { id: "cmp_demo_turso", brand: "Turso", text: "Turso — SQLite for the edge", clickUrl: "https://turso.tech", pricePerThousandUsd: 5, isDemo: true },
  { id: "cmp_demo_posthog", brand: "PostHog", text: "PostHog — product analytics, self-host or cloud", clickUrl: "https://posthog.com", pricePerThousandUsd: 5, isDemo: true },
  { id: "cmp_demo_railway", brand: "Railway", text: "Railway — deploy anything in seconds", clickUrl: "https://railway.app", pricePerThousandUsd: 4, isDemo: true },
  // House (crediting) inventory for signed-in testing:
  { id: "cmp_house_1", brand: "Meanwhile", text: "You're earning on this line right now", clickUrl: "https://github.com/shawnesquivel/meanwhile", pricePerThousandUsd: 20, isDemo: false },
  { id: "cmp_house_2", brand: "Meanwhile", text: "Meanwhile — get paid while you code", clickUrl: "https://github.com/shawnesquivel/meanwhile", pricePerThousandUsd: 15, isDemo: false },
  { id: "cmp_house_3", brand: "Meanwhile", text: "Open source. Reversible. Yours.", clickUrl: "https://github.com/shawnesquivel/meanwhile", pricePerThousandUsd: 12, isDemo: false },
];

async function main() {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test@meanwhile.local",
      emailVerified: true,
    })
    .onConflictDoNothing({ target: user.id });

  for (const s of SPONSORS) {
    await db
      .insert(campaign)
      .values({
        id: s.id,
        userId: null,
        brand: s.brand,
        text: s.text,
        clickUrl: s.clickUrl,
        status: "active",
        pricePerThousandMicro: usdToMicro(s.pricePerThousandUsd),
        impressionsPurchased: 0n, // 0 = unlimited (house/demo inventory)
        isDemo: s.isDemo,
      })
      .onConflictDoNothing({ target: campaign.id });
  }

  const demo = SPONSORS.filter((s) => s.isDemo).length;
  const house = SPONSORS.length - demo;
  console.log(
    `[seed] ok — test user + ${demo} demo + ${house} house sponsors`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
