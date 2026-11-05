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

export async function errorFromResponse(res: Response): Promise<GatewayError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error bodies (proxies, timeouts) still become a GatewayError.
  }
  return new GatewayError(res.status, body);
}
