import "server-only";

import { isGatewayError, isNetworkFailure, type Engine } from "@/engine";
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
  // No answer at all (connection refused, timed out, cut, or the name didn't resolve):
  // show "we can't reach your wallet" instead of an error page.
  if (isNetworkFailure(err)) return { ok: false, reason: "gateway_unreachable", mode };
  // Not a Gateway problem. If it's a stuck database pool, start a fresh one for the next request.
  recoverFromDbError(err);
  throw err;
}
