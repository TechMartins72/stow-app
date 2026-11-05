// The SigningGuard is the only code that holds the signer key. Every order and
// transfer goes create -> rule check -> sign -> execute through here, so locks
// and guardrails cannot be skipped. Creating an order or transfer moves
// nothing; when a rule blocks it, the guard simply never signs.

import { dec, toDecimalString } from "../decimal";
import type { GatewayClient } from "../gateway/client";
import type { Asset, BalanceItem, OrderDetail, TransferDetail, UnsignedPayload } from "../gateway/types";
import { checkAction, type RuleContext } from "../vault/rules";
import type { VaultStore } from "../vault/store";
import type { Actor, Debit, ProposedAction, Violation } from "../vault/types";
import { createStamper, payloadDigest, type Stamper } from "./stamp";

export interface GuardUser {
  /** App user id (locks, guardrails, log). */
  id: string;
  /** Gateway user id (`TM-On-Behalf-Of`). */
  gatewayUserId: string;
}

export type GuardOutcome<T> =
  | { status: "blocked"; violations: Violation[] }
  | { status: "not_created"; issues: string[] }
  | { status: "executed"; result: T };

export interface MarketOrderInput {
  asset: Asset;
  side: "buy" | "sell";
  /** Buy: USDC to spend. Sell: base asset quantity. Decimal string. */
  amount: string;
  actor: Actor;
}

export interface WithdrawInput {
  asset: Asset;
  qty: string;
  to: string;
  actor: Actor;
}

interface GuardDeps {
  client: GatewayClient;
  store: VaultStore;
  signerPrivateKeyHex: string;
  now?: () => Date;
}

export class SigningGuard {
  private readonly stamper: Stamper;
  private readonly client: GatewayClient;
  private readonly store: VaultStore;
  private readonly now: () => Date;

  constructor(deps: GuardDeps) {
    this.client = deps.client;
    this.store = deps.store;
    this.now = deps.now ?? (() => new Date());
    this.stamper = createStamper(deps.signerPrivateKeyHex);
  }

  /** The public half to register as `signer_public_key` when creating users. */
  get signerPublicKey(): string {
    return this.stamper.publicKey;
  }

  async placeMarketOrder(user: GuardUser, input: MarketOrderInput): Promise<GuardOutcome<OrderDetail>> {
    const { asset, side, amount, actor } = input;
    const productType = asset.type === "perp" ? "perp" : "spot";

    // Rules that need no quote run first, so a perp order is never even created.
    const ctx = await this.context(user);
    const early = checkAction(
      { kind: side, actor, assetId: asset.id, symbol: asset.symbol, productType, debits: [], notionalUsd: "0" },
      { ...ctx, guardrails: { ...ctx.guardrails, maxDailySpendUsd: undefined, maxSingleTradeUsd: undefined } },
    );
    if (!early.allowed) return this.block(user, actor, side, asset, "0", early.violations);

    const order = await this.client.createOrder(user.gatewayUserId, {
      asset_id: asset.id,
      side,
      type: "market",
      qty: amount,
      // Market buys must be in quote units; DeFi sells must be in base units.
      qty_unit: side === "buy" ? "quote" : "base",
    });
    if (!order.order_id) return { status: "not_created", issues: order.quote?.issues ?? [] };

    const quote = order.quote ?? {};
    const quoteSymbol = quote.quote_asset ?? "USDC";
    let debits: Debit[];
    let notionalUsd: string;
    if (side === "buy") {
      // Spend the quoted input plus any fee charged in the same asset.
      let spend = dec(quote.qty ?? amount);
      if (quote.fee && (quote.fee_asset ?? quoteSymbol) === quoteSymbol) spend += dec(quote.fee);
      debits = [{ assetId: quoteAssetId(ctx.balances, quoteSymbol, asset.chain), symbol: quoteSymbol, qty: toDecimalString(spend) }];
      notionalUsd = amount;
    } else {
      debits = [{ assetId: asset.id, symbol: asset.symbol, qty: amount }];
      notionalUsd = quote.qty_out ?? (await this.valueInUsd(user, asset, amount));
    }

    const action: ProposedAction = { kind: side, actor, assetId: asset.id, symbol: asset.symbol, productType, debits, notionalUsd };
    const decision = checkAction(action, ctx);
    // Blocked: the unsigned order is left to expire. Nothing moved.
    if (!decision.allowed) return this.block(user, actor, side, asset, notionalUsd, decision.violations);

    const signatures = this.sign(order.payloads ?? []);
    let final: OrderDetail;
    try {
      await this.client.executeOrder(user.gatewayUserId, order.order_id, signatures);
      final = await this.client.waitForOrder(user.gatewayUserId, order.order_id);
    } catch (err) {
      await this.log(user, action, "failed", [], order.order_id);
      throw err;
    }
    await this.log(user, action, final.status === "failed" ? "failed" : "executed", [], order.order_id);
    return { status: "executed", result: final };
  }

  async withdraw(user: GuardUser, input: WithdrawInput): Promise<GuardOutcome<TransferDetail>> {
    const { asset, qty, to, actor } = input;
    const ctx = await this.context(user);
    const notionalUsd = asset.stable ? qty : await this.valueInUsd(user, asset, qty);
    const action: ProposedAction = {
      kind: "transfer",
      actor,
      assetId: asset.id,
      symbol: asset.symbol,
      productType: "spot",
      debits: [{ assetId: asset.id, symbol: asset.symbol, qty }],
      notionalUsd,
    };
    const decision = checkAction(action, ctx);
    if (!decision.allowed) return this.block(user, actor, "transfer", asset, notionalUsd, decision.violations);

    const transfer = await this.client.createTransfer(user.gatewayUserId, { asset_id: asset.id, qty, qty_unit: "base", to });
    let final: TransferDetail;
    try {
      await this.client.executeTransfer(user.gatewayUserId, transfer.id, this.sign(transfer.payloads));
      final = await this.client.waitForTransfer(user.gatewayUserId, transfer.id);
    } catch (err) {
      await this.log(user, action, "failed", [], transfer.id);
      throw err;
    }
    await this.log(user, action, final.status === "failed" ? "failed" : "executed", [], transfer.id);
    return { status: "executed", result: final };
  }

  /** Runs the rules without creating anything. For previews and the Plan / Apply sheet. */
  async preview(user: GuardUser, action: ProposedAction) {
    return checkAction(action, await this.context(user));
  }

  private sign(payloads: UnsignedPayload[]): string[] {
    if (payloads.length === 0) throw new Error("Gateway returned nothing to sign");
    return payloads.map((p) => {
      // Sign only what the Gateway says it sent: the digest must match the payload bytes.
      if (p.digest && p.digest.toLowerCase() !== payloadDigest(p.payload)) {
        throw new Error("Payload digest mismatch; refusing to sign");
      }
      return this.stamper.stamp(p.payload);
    });
  }

  private async context(user: GuardUser): Promise<RuleContext & { balances: BalanceItem[] }> {
    const now = this.now();
    const [balances, locks, guardrails, spentTodayUsd] = await Promise.all([
      this.client.getBalances(user.gatewayUserId),
      this.store.listLocks(user.id),
      this.store.getGuardrails(user.id),
      this.store.spentTodayUsd(user.id, now),
    ]);
    return { balances, locks, guardrails, spentTodayUsd };
  }

  private async valueInUsd(user: GuardUser, asset: Asset, qty: string): Promise<string> {
    const quote = await this.client.quote(user.gatewayUserId, { asset_id: asset.id, side: "sell", qty, qty_unit: "base" });
    return quote.notional;
  }

  private async block<T>(
    user: GuardUser,
    actor: Actor,
    kind: ProposedAction["kind"],
    asset: Asset,
    notionalUsd: string,
    violations: Violation[],
  ): Promise<GuardOutcome<T>> {
    await this.store.appendLog({
      userId: user.id,
      actor,
      kind,
      assetId: asset.id,
      symbol: asset.symbol,
      notionalUsd,
      outcome: "blocked",
      violations,
      at: this.now(),
    });
    return { status: "blocked", violations };
  }

  private log(user: GuardUser, action: ProposedAction, outcome: "executed" | "failed", violations: Violation[], ref: string) {
    return this.store.appendLog({
      userId: user.id,
      actor: action.actor,
      kind: action.kind,
      assetId: action.assetId,
      symbol: action.symbol,
      notionalUsd: action.notionalUsd,
      outcome,
      violations,
      gatewayRef: ref,
      at: this.now(),
    });
  }
}

// The stablecoin a buy spends lives on the traded asset's chain.
function quoteAssetId(balances: BalanceItem[], symbol: string, chain: string | null): string {
  const row = balances.find((b) => b.symbol === symbol && b.chain === chain);
  return row?.asset_id ?? `${symbol}:${chain ?? "unknown"}`;
}
