// Gateway API shapes, trimmed to the fields the app uses.
// Source: https://docs.truemarkets.co/openapi/gateway.yaml

export type Side = "buy" | "sell";
export type QtyUnit = "base" | "quote";
export type Venue = "defi" | "cefi";
export type ProductType = "spot" | "perp";
export type AssetClass = "crypto" | "stock";

export type OrderStatus =
  | "initialized"
  | "pending"
  | "cancel_pending"
  | "complete"
  | "canceled"
  | "active"
  | "failed";

export type TransferStatus = "awaiting_signature" | "pending" | "completed" | "failed";

export interface Asset {
  id: string;
  symbol: string;
  name?: string;
  chain: string | null;
  venue: Venue;
  asset_class?: AssetClass;
  type?: ProductType;
  stable?: boolean;
  decimals?: number;
  [key: string]: unknown;
}

export interface Wallet {
  address: string;
  chain_family: "solana" | "evm";
}

export interface GatewayUser {
  user_id: string;
  external_ref_id: string;
  created_at: string;
  wallets: Wallet[];
}

export interface BalanceItem {
  asset_id: string;
  venue: Venue;
  symbol: string;
  name?: string;
  chain: string | null;
  decimals?: number;
  total: string;
  available: string;
  held: string;
  stable?: boolean;
  tradeable?: boolean;
}

export interface UnsignedPayload {
  digest: string;
  payload: string;
}

export interface QuoteDetails {
  base_asset?: string;
  quote_asset?: string;
  qty?: string;
  qty_out?: string;
  fee?: string;
  fee_asset?: string;
  issues?: string[];
}

export interface CreateOrderRequest {
  asset_id: string;
  side: Side;
  type: "market" | "limit";
  qty: string;
  qty_unit: QtyUnit;
  price?: string;
}

export interface CreateOrderResponse {
  order_id: string;
  status?: OrderStatus;
  venue?: Venue;
  payloads?: UnsignedPayload[];
  quote?: QuoteDetails;
}

export interface OrderDetail {
  order_id: string;
  asset_id?: string | null;
  asset_symbol?: string | null;
  base_asset?: string;
  quote_asset?: string;
  side: Side;
  type: "market" | "limit";
  qty: string;
  qty_unit: QtyUnit;
  /** Market orders: the reference price at creation. */
  price?: string | null;
  executed_qty?: string;
  executed_vwap?: string;
  fee?: string;
  tx_hash?: string;
  explorer_url?: string;
  failure_reason?: string;
  status: OrderStatus;
  created_at?: string;
}

export interface QuoteRequest {
  asset_id: string;
  side: Side;
  qty: string;
  qty_unit: QtyUnit;
}

export interface QuoteResponse {
  qty: string;
  price: string;
  notional: string;
  fee: string;
}

export interface CreateTransferRequest {
  asset_id: string;
  qty: string;
  qty_unit: "base";
  to: string;
}

export interface TransferDetail {
  id: string;
  status: TransferStatus;
  asset_id: string;
  asset_symbol: string;
  chain: string | null;
  to: string;
  qty: string;
  sent: string;
  fee: string;
  received: string;
  tx_hash: string;
  explorer_url?: string | null;
  payloads: UnsignedPayload[];
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  type: "order" | "transfer" | "ramp";
  status: "pending" | "completed" | "failed" | "canceled";
  order?: OrderDetail;
  transfer?: TransferDetail;
  [key: string]: unknown;
}

export interface Page<T> {
  data: T[];
  pagination?: { next_cursor: string | null; limit?: number };
}
