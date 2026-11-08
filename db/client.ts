import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(
    postgres(url, {
      // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
      prepare: false,
      max: 5,
      // The pooler silently drops idle client connections. postgres.js keeps idle
      // connections forever by default, so after a quiet spell (overnight, a laptop
      // sleep) queries hung on dead sockets. Close idle ones first, recycle the rest.
      idle_timeout: 20,
      max_lifetime: 10 * 60,
      connect_timeout: 10,
      // Fail a request rather than hang it when every connection is busy or stuck.
      queue_timeout: 15,
    }),
    { schema },
  );
}

export type Db = ReturnType<typeof createDb>;
