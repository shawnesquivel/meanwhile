import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { jsonResponse, preflight } from "@/lib/http";
import { devIssueTokensForUser } from "@/lib/ext-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * DEV ONLY. Mints extension tokens for the seeded test user so the full
 * serve→meter→earn loop can be exercised without the browser sign-in flow.
 * Hard-gated: disabled in production and unless MEANWHILE_DEV_LOGIN=1.
 */
export async function POST() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MEANWHILE_DEV_LOGIN !== "1"
  ) {
    return jsonResponse({ error: "not found" }, 404);
  }
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, "usr_test"))
    .limit(1);
  if (!u) return jsonResponse({ error: "run db:seed first" }, 409);
  const tokens = await devIssueTokensForUser(u.id);
  return jsonResponse({ status: "complete", ...tokens });
}
