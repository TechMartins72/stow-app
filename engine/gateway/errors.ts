// Gateway error envelope: branch on `code`, fall back to `type`, never on `message`.
// https://docs.truemarkets.co/developer-resources/errors

export type ErrorType =
  | "invalid_argument"
  | "unauthenticated"
  | "permission_denied"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "failed_precondition"
  | "resource_exhausted"
  | "unavailable"
  | "internal";

export class GatewayError extends Error {
  readonly status: number;
  readonly type: ErrorType | string;
  readonly code?: string;
  readonly requestId?: string;
  readonly fieldViolations?: unknown;
  readonly metadata?: Record<string, string>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === "string" ? body.message : `Gateway request failed (${status})`);
    this.name = "GatewayError";
    this.status = status;
    this.type = typeof body.type === "string" ? body.type : "unknown";
    this.code = typeof body.code === "string" ? body.code : undefined;
    this.requestId = typeof body.request_id === "string" ? body.request_id : undefined;
    this.fieldViolations = body.field_violations;
    this.metadata = body.metadata as Record<string, string> | undefined;
  }
}

export function isGatewayError(err: unknown, code?: string): err is GatewayError {
  return err instanceof GatewayError && (code === undefined || err.code === code);
}

/** Connection-level failure codes from Node's fetch (undici) and the OS: no answer was received. */
const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/**
 * True when a request to True Markets never got an answer: the connection couldn't be
 * opened, timed out or was cut. (fetch throws "fetch failed" with the reason in `cause`.)
 */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof GatewayError) return false;
  for (let e = err, depth = 0; e && typeof e === "object" && depth < 3; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && NETWORK_CODES.has(code)) return true;
  }
  return false;
}

export async function errorFromResponse(res: Response): Promise<GatewayError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error bodies (proxies, timeouts) still become a GatewayError.
  }
  return new GatewayError(res.status, body);
}
