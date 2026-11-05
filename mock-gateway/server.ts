// A local stand-in for the True Markets Gateway: same paths, same shapes,
// in-memory balances, fixed prices. It verifies payload stamps against each
// user's signer key, so the real signing code is exercised for free.
//
// Run: npm run mock   (listens on MOCK_GATEWAY_PORT, default 4010)
// Fund a user: POST /mock/fund {"user_id","asset_id","amount"}

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { dec, div, mul, toDecimalString, ZERO } from "../engine/decimal";
import type { Asset, BalanceItem, GatewayUser, OrderDetail, TransferDetail, UnsignedPayload } from "../engine/gateway/types";
import { payloadDigest, verifyStamp } from "../engine/signing/stamp";

const ORG_ID = "org_mock";
const FEE_RATE = dec("0.001"); // 0.1%, charged in USDC

const ASSETS: (Asset & { price: string })[] = [
  { id: "00000000-0000-4000-8000-000000000001", symbol: "USDC", name: "USD Coin", chain: "solana", venue: "defi", asset_class: "crypto", type: "spot", stable: true, decimals: 6, price: "1" },
  { id: "00000000-0000-4000-8000-000000000002", symbol: "SOL", name: "Solana", chain: "solana", venue: "defi", asset_class: "crypto", type: "spot", stable: false, decimals: 9, price: "150" },
  { id: "00000000-0000-4000-8000-000000000003", symbol: "USDC", name: "USD Coin", chain: "base", venue: "defi", asset_class: "crypto", type: "spot", stable: true, decimals: 6, price: "1" },
  { id: "00000000-0000-4000-8000-000000000004", symbol: "AAPLC", name: "Apple (tokenized)", chain: "base", venue: "defi", asset_class: "stock", type: "spot", stable: false, decimals: 8, price: "220" },
  { id: "00000000-0000-4000-8000-000000000005", symbol: "BTC-PERP", name: "Bitcoin perpetual", chain: "hypercore-perp", venue: "defi", asset_class: "crypto", type: "perp", stable: false, decimals: 5, price: "100000" },
];

interface MockUser extends GatewayUser {
  signerPublicKey: string;
  balances: Map<string, string>; // asset id -> available
}

interface PendingOrder {
  detail: OrderDetail;
  userId: string;
  payloads: UnsignedPayload[];
  apply: () => void;
}

interface PendingTransfer {
  detail: TransferDetail;
  userId: string;
  apply: () => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function createMockGateway(): Server {
  const users = new Map<string, MockUser>(); // by user_id
  const orders = new Map<string, PendingOrder>();
  const transfers = new Map<string, PendingTransfer>();

  const assetById = (id: string) => {
    const asset = ASSETS.find((a) => a.id === id);
    if (!asset) throw new HttpError(404, "not_found", `Unknown asset ${id}`);
    return asset;
  };
  const usdcOn = (chain: string | null) => ASSETS.find((a) => a.symbol === "USDC" && a.chain === chain) ?? ASSETS[0];
  const balanceOf = (user: MockUser, assetId: string) => dec(user.balances.get(assetId) ?? "0");
  const adjust = (user: MockUser, assetId: string, delta: bigint) =>
    user.balances.set(assetId, toDecimalString(balanceOf(user, assetId) + delta));
  const makePayload = (kind: string, id: string): UnsignedPayload => {
    const payload = `${JSON.stringify({ type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2", kind, id, nonce: randomUUID() })}\n`;
    return { payload, digest: payloadDigest(payload) };
  };

  const requireUser = (req: IncomingMessage) => {
    const id = req.headers["tm-on-behalf-of"];
    const user = typeof id === "string" ? users.get(id) : undefined;
    if (!user) throw new HttpError(403, "permission_denied", "TM-On-Behalf-Of does not name a user in your organization");
    return user;
  };

  const checkSignatures = (user: MockUser, payloads: UnsignedPayload[], body: { signatures?: string[]; auth_type?: string }) => {
    if (body.auth_type !== "api_key") throw new HttpError(400, "invalid_argument", "auth_type must be api_key");
    const sigs = body.signatures ?? [];
    if (sigs.length !== payloads.length) throw new HttpError(400, "invalid_argument", "One signature per payload");
    payloads.forEach((p, i) => {
      if (!verifyStamp(sigs[i], p.payload, user.signerPublicKey)) {
        throw new HttpError(403, "permission_denied", `Signature ${i} does not verify against the user's signer key`);
      }
    });
  };

  // Request bodies are untyped JSON; each route reads only the fields it checks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const route = async (req: IncomingMessage, url: URL, body: Record<string, any>): Promise<[number, unknown]> => {
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "POST" && path === "/v1/auth/api-key/token") {
      if (!body.key_id || !body.signature) throw new HttpError(400, "invalid_argument", "key_id and signature are required");
      const claims = Buffer.from(JSON.stringify({ tm: { organization_id: ORG_ID } })).toString("base64url");
      const expires = new Date(Date.now() + 3600_000).toISOString();
      return [200, { access_token: `mock.${claims}.sig`, token_type: "Bearer", expires_in: expires }];
    }

    if (method === "GET" && path === "/v1/gateway/assets") {
      const cls = url.searchParams.get("asset_class");
      const product = url.searchParams.get("product_type");
      const data = ASSETS.filter(
        (a) => (cls ? cls.split(",").includes(a.asset_class!) : true) && (product ? a.type === product : a.type === "spot"),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ).map(({ price, ...asset }) => asset);
      return [200, { data }];
    }

    if (!req.headers.authorization?.startsWith("Bearer ")) throw new HttpError(401, "unauthenticated", "Missing token");

    if (method === "POST" && path === "/mock/fund") {
      const user = users.get(body.user_id);
      if (!user) throw new HttpError(404, "not_found", "Unknown user");
      adjust(user, assetById(body.asset_id).id, dec(String(body.amount)));
      return [200, { ok: true }];
    }

    const userMatch = path.match(/^\/v1\/account\/organizations\/([^/]+)\/users$/);
    if (method === "POST" && userMatch) {
      if (userMatch[1] !== ORG_ID) throw new HttpError(403, "permission_denied", "Wrong organization");
      if (!/^[0-9a-f]{66}$/i.test(body.signer_public_key ?? "")) {
        throw new HttpError(400, "invalid_argument", "signer_public_key must be 66 hex characters");
      }
      const existing = [...users.values()].find((u) => u.external_ref_id === body.external_ref_id);
      if (existing) return [200, publicUser(existing)];
      const user: MockUser = {
        user_id: randomUUID(),
        external_ref_id: body.external_ref_id,
        created_at: new Date().toISOString(),
        wallets: [
          { address: `Mock${randomUUID().replace(/-/g, "").slice(0, 28)}`, chain_family: "solana" },
          { address: `0x${randomUUID().replace(/-/g, "")}${"0".repeat(8)}`, chain_family: "evm" },
        ],
        signerPublicKey: String(body.signer_public_key).toLowerCase(),
        balances: new Map(),
      };
      users.set(user.user_id, user);
      return [201, publicUser(user)];
    }

    if (method === "GET" && (path === "/v1/gateway/balances" || path === "/v1/gateway/balances/unified")) {
      const user = requireUser(req);
      const data: BalanceItem[] = [...user.balances.entries()].map(([assetId, available]) => {
        const a = assetById(assetId);
        return {
          asset_id: a.id,
          venue: a.venue,
          symbol: a.symbol,
          name: a.name,
          chain: a.chain,
          decimals: a.decimals,
          total: available,
          available,
          held: "0",
          stable: a.stable,
          tradeable: true,
        };
      });
      return [200, { data }];
    }

    if (method === "POST" && path === "/v1/gateway/quotes") {
      const asset = assetById(body.asset_id);
      const price = dec(asset.price);
      const qty = dec(String(body.qty));
      const baseQty = body.qty_unit === "quote" ? div(qty, price) : qty;
      const notional = mul(baseQty, price);
      return [200, { qty: toDecimalString(baseQty, 9), price: asset.price, notional: toDecimalString(notional, 6), fee: toDecimalString(mul(notional, FEE_RATE), 6) }];
    }

    if (method === "POST" && path === "/v1/gateway/orders") {
      const user = requireUser(req);
      const asset = assetById(body.asset_id);
      if (asset.type === "perp" && !body.leverage) throw new HttpError(400, "invalid_argument", "leverage is required for perp orders");
      if (body.type !== "market") throw new HttpError(400, "invalid_argument", "The mock only supports market orders");
      if (body.side === "buy" && body.qty_unit !== "quote") throw new HttpError(400, "invalid_argument", "Market buys need qty_unit quote");
      if (body.side === "sell" && body.qty_unit !== "base") throw new HttpError(400, "invalid_argument", "DeFi sells need qty_unit base");

      const usdc = usdcOn(asset.chain);
      const price = dec(asset.price);
      const qty = dec(String(body.qty));
      const orderId = randomUUID();
      let quote;
      let apply: () => void;
      if (body.side === "buy") {
        const fee = mul(qty, FEE_RATE);
        const out = div(qty, price);
        quote = { base_asset: asset.symbol, quote_asset: "USDC", qty: toDecimalString(qty), qty_out: toDecimalString(out, 9), fee: toDecimalString(fee, 6), fee_asset: "USDC", issues: [] as string[] };
        if (balanceOf(user, usdc.id) < qty + fee) return [201, { order_id: "", quote: { ...quote, issues: ["Insufficient balance"] } }];
        apply = () => {
          adjust(user, usdc.id, -(qty + fee));
          adjust(user, asset.id, out);
        };
      } else {
        if (balanceOf(user, asset.id) < qty) throw new HttpError(422, "failed_precondition", "Insufficient balance", "insufficient_balance");
        const gross = mul(qty, price);
        const fee = mul(gross, FEE_RATE);
        quote = { base_asset: asset.symbol, quote_asset: "USDC", qty: toDecimalString(qty), qty_out: toDecimalString(gross - fee, 6), fee: toDecimalString(fee, 6), fee_asset: "USDC", issues: [] as string[] };
        apply = () => {
          adjust(user, asset.id, -qty);
          adjust(user, usdc.id, gross - fee);
        };
      }
      const detail: OrderDetail = {
        order_id: orderId,
        asset_id: asset.id,
        asset_symbol: asset.symbol,
        base_asset: asset.symbol,
        quote_asset: "USDC",
        side: body.side,
        type: "market",
        qty: String(body.qty),
        qty_unit: body.qty_unit,
        price: asset.price,
        executed_qty: "0",
        status: "initialized",
        created_at: new Date().toISOString(),
      };
      const payloads = [makePayload("order", orderId)];
      orders.set(orderId, { detail, userId: user.user_id, payloads, apply });
      return [201, { order_id: orderId, status: "initialized", venue: "defi", payloads, quote }];
    }

    const executeOrder = path.match(/^\/v1\/gateway\/orders\/([^/]+)\/execute$/);
    if (method === "POST" && executeOrder) {
      const user = requireUser(req);
      const order = orders.get(executeOrder[1]);
      if (!order || order.userId !== user.user_id) throw new HttpError(404, "not_found", "Order not found");
      if (order.detail.status !== "initialized") throw new HttpError(409, "conflict", "Already submitted", "already_submitted");
      checkSignatures(user, order.payloads, body);
      order.apply();
      order.detail.status = "complete";
      order.detail.executed_qty =
        order.detail.side === "buy"
          ? toDecimalString(div(dec(order.detail.qty), dec(order.detail.price ?? "1")), 9)
          : order.detail.qty;
      order.detail.tx_hash = `mock_${randomUUID()}`;
      return [200, { status: "complete" }];
    }

    const getOrder = path.match(/^\/v1\/gateway\/orders\/([^/]+)$/);
    if (method === "GET" && getOrder) {
      const user = requireUser(req);
      const order = orders.get(getOrder[1]);
      if (!order || order.userId !== user.user_id) throw new HttpError(404, "not_found", "Order not found");
      return [200, order.detail];
    }

    if (method === "POST" && path === "/v1/gateway/transfers") {
      const user = requireUser(req);
      const asset = assetById(body.asset_id);
      const qty = dec(String(body.qty));
      if (qty <= ZERO) throw new HttpError(400, "invalid_argument", "qty must be positive");
      if (balanceOf(user, asset.id) < qty) throw new HttpError(403, "permission_denied", "Transfer exceeds wallet balance");
      const id = randomUUID();
      const now = new Date().toISOString();
      const detail: TransferDetail = {
        id,
        status: "awaiting_signature",
        asset_id: asset.id,
        asset_symbol: asset.symbol,
        chain: asset.chain,
        to: body.to,
        qty: String(body.qty),
        sent: "0",
        fee: "0",
        received: "0",
        tx_hash: "",
        payloads: [makePayload("transfer", id)],
        created_at: now,
        updated_at: now,
      };
      transfers.set(id, { detail, userId: user.user_id, apply: () => adjust(user, asset.id, -qty) });
      return [201, detail];
    }

    const executeTransfer = path.match(/^\/v1\/gateway\/transfers\/([^/]+)\/execute$/);
    if (method === "POST" && executeTransfer) {
      const user = requireUser(req);
      const transfer = transfers.get(executeTransfer[1]);
      if (!transfer || transfer.userId !== user.user_id) throw new HttpError(404, "not_found", "Transfer not found");
      if (transfer.detail.status !== "awaiting_signature") throw new HttpError(409, "conflict", "Already submitted", "already_submitted");
      checkSignatures(user, transfer.detail.payloads, body);
      transfer.apply();
      Object.assign(transfer.detail, {
        status: "completed",
        sent: transfer.detail.qty,
        received: transfer.detail.qty,
        tx_hash: `mock_${randomUUID()}`,
        payloads: [],
        updated_at: new Date().toISOString(),
      });
      return [200, transfer.detail];
    }

    const getTransfer = path.match(/^\/v1\/gateway\/transfers\/([^/]+)$/);
    if (method === "GET" && getTransfer) {
      const user = requireUser(req);
      const transfer = transfers.get(getTransfer[1]);
      if (!transfer || transfer.userId !== user.user_id) throw new HttpError(404, "not_found", "Transfer not found");
      return [200, transfer.detail];
    }

    if (method === "GET" && path === "/v1/gateway/transactions") {
      const user = requireUser(req);
      const rows = [
        ...[...orders.values()].filter((o) => o.userId === user.user_id && o.detail.status !== "initialized").map((o) => ({ id: o.detail.order_id, type: "order", status: o.detail.status === "complete" ? "completed" : o.detail.status, order: o.detail, created_at: o.detail.created_at })),
        ...[...transfers.values()].filter((t) => t.userId === user.user_id && t.detail.status !== "awaiting_signature").map((t) => ({ id: t.detail.id, type: "transfer", status: t.detail.status, transfer: t.detail, created_at: t.detail.created_at })),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return [200, { data: rows, pagination: { next_cursor: null, limit: 50 } }];
    }

    throw new HttpError(404, "not_found", `The mock Gateway has no route for ${method} ${path}`);
  };

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = randomUUID();
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString();
      const body = raw ? JSON.parse(raw) : {};
      const [status, payload] = await route(req, url, body);
      send(res, status, payload);
    } catch (err) {
      if (err instanceof HttpError) {
        send(res, err.status, { type: err.type, code: err.code, message: err.message, request_id: requestId });
      } else {
        send(res, 500, { type: "internal", message: String(err), request_id: requestId });
      }
    }
  });
}

function publicUser(user: MockUser): GatewayUser {
  return { user_id: user.user_id, external_ref_id: user.external_ref_id, created_at: user.created_at, wallets: user.wallets };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.MOCK_GATEWAY_PORT ?? 4010);
  createMockGateway().listen(port, () => console.log(`Mock Gateway listening on http://localhost:${port}`));
}
