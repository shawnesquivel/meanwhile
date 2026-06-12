import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * One Postgres pool per server instance. We use node-postgres so the exact
 * same client works against a local Docker Postgres (dev/test) and Neon in
 * production (SSL is honoured from the connection string's `sslmode=require`).
 * On Vercel, connect Neon via the native integration so DATABASE_URL is
 * injected automatically.
 */
const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export { schema };
