// Turns True Markets' refusal of a withdrawal into words for people, plus the raw
// facts for "Details" and the server log. Branches on `code` (then `type`), never on
// the message text, per the Gateway's error guidance.

export interface GatewayRefusal {
  type: string;
  code?: string;
  message?: string;
  /** String values scoped to `code`; which keys appear isn't documented, so all are kept. */
  metadata?: Record<string, string>;
  fieldViolations?: unknown;
}

const NOTHING_SENT = "Nothing was sent.";

/** A metadata value that looks like the minimum amount (key mentions "min", value is a number). */
function minimumFrom(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) return undefined;
  const hit = Object.entries(metadata).find(([k, v]) => /min/i.test(k) && /^\d+(\.\d+)?$/.test(v));
  return hit?.[1];
}

export function describeTransferRefusal(err: GatewayRefusal, symbol: string): { message: string; detail: string } {
  const head = [err.type, err.code].filter(Boolean).join(" / ") + (err.message ? `: ${err.message}` : "");
  const extras = [
    ...Object.entries(err.metadata ?? {}).map(([k, v]) => `${k}=${v}`),
    ...(err.fieldViolations ? [`fields=${JSON.stringify(err.fieldViolations)}`] : []),
  ];
  const detail = extras.length ? `${head} (${extras.join(", ")})` : head;

  switch (err.code) {
    case "amount_below_minimum": {
      const min = minimumFrom(err.metadata);
      return {
        message: min
          ? `That's below the smallest ${symbol} transfer True Markets allows: the smallest ${symbol} transfer is ${min} ${symbol}. ${NOTHING_SENT}`
          : `That's below the smallest ${symbol} transfer True Markets allows. ${NOTHING_SENT} Try a larger amount.`,
        detail,
      };
    }
    case "amount_above_maximum":
      return { message: `That's above the largest ${symbol} transfer True Markets allows. ${NOTHING_SENT} Try a smaller amount.`, detail };
    case "insufficient_native_balance":
      return { message: `There isn't enough left to pay the network fee. ${NOTHING_SENT} Try sending a little less.`, detail };
    case "invalid_qty_precision":
      return { message: `That amount has more decimal places than ${symbol} allows. ${NOTHING_SENT}`, detail };
    case "chain_not_supported":
      return { message: `True Markets doesn't support sending ${symbol} on this network. ${NOTHING_SENT}`, detail };
    default:
      return { message: `True Markets couldn't prepare this transfer, so nothing was sent.`, detail };
  }
}
