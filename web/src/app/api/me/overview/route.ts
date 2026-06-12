import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  availableBalanceMicro,
  lifetimeCreditedMicro,
  MIN_PAYOUT_MICRO,
  recentCreditedEvents,
  todayCreditedMicro,
} from "@/lib/earnings";
import { jsonResponse } from "@/lib/http";
import { microToUsdString } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the dashboard needs in one call. Session-cookie auth. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return jsonResponse({ error: "unauthorized" }, 401);
  const uid = session.user.id;

  const [lifetime, today, balance, events] = await Promise.all([
    lifetimeCreditedMicro(uid),
    todayCreditedMicro(uid),
    availableBalanceMicro(uid),
    recentCreditedEvents(uid, 50),
  ]);

  return jsonResponse({
    user: { email: session.user.email, name: session.user.name },
    lifetimeUsd: microToUsdString(lifetime),
    todayUsd: microToUsdString(today),
    balanceUsd: microToUsdString(balance),
    minPayoutUsd: microToUsdString(MIN_PAYOUT_MICRO),
    canRequestPayout: balance >= MIN_PAYOUT_MICRO,
    events: events.map((e) => ({
      id: e.id,
      event: e.event,
      surface: e.surface,
      creditedUsd: microToUsdString(e.creditedMicro),
      at: e.createdAt.toISOString(),
    })),
  });
}
