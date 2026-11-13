// A database belongs to one Gateway mode for life. Practice (mock) users have
// mock True Markets ids and practice locks; using them with real money would
// send fake ids to the live API and could apply practice locks to real funds.
// So each database records the mode that first used it, and refuses the other.

export type GatewayMode = "mock" | "live";

/** Null when `current` may use a database marked `stored`; otherwise what to do, in plain words. */
export function databaseModeProblem(stored: string | null, current: GatewayMode): string | null {
  if (stored === null || stored === current) return null;
  if (stored === "mock" && current === "live") {
    return "This database holds practice accounts and practice locks, so it can't be used with real money. Point DATABASE_URL at a separate database for live mode and run `npm run db:migrate` on it.";
  }
  if (stored === "live" && current === "mock") {
    return "This database holds accounts with real money, so practice mode can't use it. Point DATABASE_URL at your practice database, or set GATEWAY_MODE=live.";
  }
  return `This database is marked for "${stored}" mode, which this app doesn't recognise. Check DATABASE_URL.`;
}
