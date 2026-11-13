import "server-only";

import { isGatewayError, type Engine } from "@/engine";
import { recoverFromDbError } from "./engine";

export interface GatewayFailure {
  ok: false;
  reason: "gateway_unreachable" | "gateway_error";
  mode: "mock" | "live";
  /** Shown only under "Details". */
  requestId?: string;
}

/** Turns an expected Gateway failure into a value for the UI; rethrows anything else. */
export function gatewayFailure(engine: Engine, err: unknown): GatewayFailure {
  const mode = engine.config.mode;
  if (isGatewayError(err)) return { ok: false, reason: "gateway_error", mode, requestId: err.requestId };
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") return { ok: false, reason: "gateway_unreachable", mode };
  // Not a Gateway problem. If it's a stuck database pool, start a fresh one for the next request.
  recoverFromDbError(err);
  throw err;
}
