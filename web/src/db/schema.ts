import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Database schema.
 *
 * Two groups:
 *  1. better-auth core tables (`user`, `session`, `account`, `verification`) —
 *     JS keys are camelCase to match better-auth's field names; SQL columns are
 *     snake_case. Swapping the auth provider later only changes which of these
 *     get used, not the app tables below.
 *  2. Meanwhile app tables — campaigns, the extension token layer, devices, and
 *     the raw billable-event log.
 *
 * Money columns are `bigint` micro-USD (see lib/money.ts).
 */

// --- better-auth core ------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Meanwhile app tables --------------------------------------------------

/** A sponsor campaign = one creative + its funded impression budget. */
export const campaign = pgTable(
  "campaign",
  {
    id: text("id").primaryKey(),
    /** Advertiser who owns it (null only for seeded demo inventory). */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    brand: text("brand"),
    /** The one-line sponsor text shown in the spinner (3–60 chars). */
    text: text("text").notNull(),
    clickUrl: text("click_url").notNull(),
    iconUrl: text("icon_url"),
    /** draft | active | paused | exhausted */
    status: text("status").notNull().default("draft"),
    /** µUSD charged per 1,000 impressions (drives both billing and rank). */
    pricePerThousandMicro: bigint("price_per_thousand_micro", {
      mode: "bigint",
    })
      .notNull()
      .default(sql`0`),
    impressionsPurchased: bigint("impressions_purchased", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    impressionsServed: bigint("impressions_served", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    showOnLeaderboard: boolean("show_on_leaderboard").notNull().default(true),
    /** True for seeded preview/demo inventory shown to signed-out users. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("campaign_status_idx").on(t.status),
    index("campaign_user_idx").on(t.userId),
  ],
);

/** A device running the extension. Anonymous until linked to a user on sign-in. */
export const device = pgTable("device", {
  clientId: text("client_id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  env: jsonb("env"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Pending extension sign-in. The extension mints `state`, opens the browser
 * `authUrl`, and polls. The web sign-in page binds `state` → `userId` once the
 * user authenticates (via whatever web provider). Poll then issues tokens.
 */
export const extAuthRequest = pgTable("ext_auth_request", {
  state: text("state").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  /** pending | complete | consumed | expired */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * The extension's own token session (provider-agnostic). We store only hashes;
 * refresh rotates on every use. This is the hard boundary that keeps the web
 * auth provider swappable.
 */
export const extSession = pgTable(
  "ext_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    accessExpiresAt: timestamp("access_expires_at", {
      withTimezone: true,
    }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("ext_session_access_idx").on(t.accessTokenHash)],
);

/**
 * Raw billable-event log. One row per impression/view/click beacon. We stamp
 * the advertiser charge and the user credit at ingest, so earnings = sum of
 * `creditedMicro` per user and never needs re-pricing.
 */
export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").references(() => campaign.id, {
      onDelete: "set null",
    }),
    /** The earning user (null for demo/anonymous traffic). */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    clientId: text("client_id"),
    surface: text("surface").notNull(),
    /** impression | viewable | view_tick | view_threshold_met | click | error_impression */
    event: text("event").notNull(),
    /** Client-supplied UUID; unique to dedupe retries. */
    nonce: text("nonce").notNull().unique(),
    sessionToken: text("session_token"),
    visibleMs: integer("visible_ms"),
    chargedMicro: bigint("charged_micro", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    creditedMicro: bigint("credited_micro", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("event_user_idx").on(t.userId),
    index("event_campaign_idx").on(t.campaignId),
    uniqueIndex("event_nonce_idx").on(t.nonce),
  ],
);

export type User = typeof user.$inferSelect;
export type Campaign = typeof campaign.$inferSelect;
export type Event = typeof event.$inferSelect;
export type ExtSession = typeof extSession.$inferSelect;
