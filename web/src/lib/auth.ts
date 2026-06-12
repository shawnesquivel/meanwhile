import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";

/**
 * Web auth provider. This is the ONLY place the web app's auth library lives.
 * The extension never imports this — it uses our own opaque-token layer
 * (`src/lib/ext-auth.ts` + `/api/v1/ext/auth/*`). So swapping better-auth for
 * Clerk/Auth.js later means editing this file and the sign-in page, nothing in
 * the extension or the ad-serving APIs.
 */

const socialProviders = {
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders,
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
