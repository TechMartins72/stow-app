// Turns True Markets' refusal of a buy or sell into words for people, plus the raw
// facts for "Details" and the server log. Branches on `code`, never on the message
// text, per the Gateway's error guidance. Codes: the ErrorResponse enum in
// https://docs.truemarkets.co/openapi/gateway.yaml (clients must tolerate new ones).

import { networkLabel } from "./address";
import { refusalDetail, type GatewayRefusal } from "./transfer-refusal";

/** The coin each network charges its fees in. */
const NATIVE: Record<string, string> = {
  solana: "SOL",
  base: "ETH",
  ethereum: "ETH",
  arbitrum: "ETH",
  optimism: "ETH",
  polygon: "POL",
};

const NOTHING = "Nothing was traded.";

export function describeOrderRefusal(
  err: GatewayRefusal,
  ctx: { side: "buy" | "sell"; ticker: string; chain: string | null },
): { message: string; detail: string } {
  const detail = refusalDetail(err);
  const network = networkLabel(ctx.chain);
  const native = (ctx.chain && NATIVE[ctx.chain]) ?? "the network's own coin";
  const say = (message: string) => ({ message, detail });

  switch (err.code) {
    case "insufficient_balance":
      return say(
        ctx.side === "buy"
          ? `There isn't enough USDC on ${network} for this, including fees. ${NOTHING} Add USDC on ${network}, or try a smaller amount.`
          : `There aren't enough free ${ctx.ticker} to sell that much. ${NOTHING}`,
      );
    case "insufficient_native_balance":
      return say(
        `Your ${network} wallet needs a little ${native} on ${network} to pay the network fee. ${NOTHING} Add a small amount of ${native} on ${network}, then try again.`,
      );
    case "country_restricted":
      return say(
        `Trading ${ctx.ticker} isn't available where you are. ${NOTHING}`,
      );
    case "phone_not_verified":
      return say(
        `True Markets needs a verified phone number on this account before it can trade ${ctx.ticker}. ${NOTHING}`,
      );
    case "buy_not_allowed":
      return say(
        `True Markets isn't allowing buys of ${ctx.ticker} right now. ${NOTHING}`,
      );
    case "sell_not_allowed":
      return say(
        `True Markets isn't allowing sales of ${ctx.ticker} right now. ${NOTHING}`,
      );
    case "amount_below_minimum":
      return say(
        `That's below the smallest ${ctx.ticker} order True Markets accepts. ${NOTHING} Try a larger amount.`,
      );
    case "amount_above_maximum":
      return say(
        `That's above the largest ${ctx.ticker} order True Markets accepts. ${NOTHING} Try a smaller amount.`,
      );
    case "no_liquidity":
      return say(
        `There isn't enough trading in ${ctx.ticker} right now to fill this. ${NOTHING} Try a smaller amount, or try later.`,
      );
    case "quote_stale":
    case "price_out_of_range":
      return say(
        `The price changed before the order went through. ${NOTHING} Get a new quote and try again.`,
      );
    case "invalid_qty_precision":
      return say(
        `That amount has more decimal places than ${ctx.ticker} allows. ${NOTHING}`,
      );
    case "chain_not_supported":
      return say(
        `True Markets doesn't trade ${ctx.ticker} on ${network}. ${NOTHING}`,
      );
    case "order_rejected":
      return say(
        `The market rejected this order. ${NOTHING} Try again in a moment.`,
      );
    default:
      return say(`True Markets declined the order. ${NOTHING}`);
  }
}
