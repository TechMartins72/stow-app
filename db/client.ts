import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
}

export type Db = ReturnType<typeof createDb>;
