import { errorFromResponse, GatewayError } from "./errors";
import type { TokenProvider } from "./token";
import type {
  Asset,
  BalanceItem,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateTransferRequest,
  GatewayUser,
  OrderDetail,
  OrderStatus,
  Page,
  QuoteRequest,
  QuoteResponse,
  TransactionRow,
  TransferDetail,
} from "./types";

const FINAL_ORDER_STATUSES: OrderStatus[] = ["complete", "canceled", "failed", "active"];
const RETRYABLE_STATUSES = [429, 500, 503];

interface RequestOptions {
  /** Gateway user id for the `TM-On-Behalf-Of` header. */
  onBehalfOf?: string;
  query?: Record<string, string | number | undefined>;
  /** Public endpoints (the asset catalog) need no token. */
  auth?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thin typed client for the True Markets Gateway API.
 * Moving money needs signatures, which only the SigningGuard produces;
 * this client only carries them.
 */
export class GatewayClient {
  constructor(
    readonly baseUrl: string,
    private readonly tokens: TokenProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  // ---- Catalog ----

  async listAssets(filter: { asset_class?: string; product_type?: string } = {}): Promise<Asset[]> {
    const page = await this.get<Page<Asset>>("/v1/gateway/assets", { query: filter, auth: false });
    return page.data;
  }

  // ---- Users ----

  /** Creates the user, or returns the existing one for the same external ref. Retries while wallets are provisioned. */
  async createUser(externalRefId: string, signerPublicKey: string): Promise<GatewayUser> {
    const organizationId = await this.tokens.getOrganizationId();
    for (let attempt = 1; ; attempt++) {
      try {
        const user = await this.post<GatewayUser>(`/v1/account/organizations/${organizationId}/users`, {
          external_ref_id: externalRefId,
          signer_public_key: signerPublicKey,
        });
        if (user.wallets.length) return user;
      } catch (err) {
        // A 503 means the wallets aren't ready yet; the same request finishes them.
        if (!(err instanceof GatewayError) || err.status !== 503 || attempt >= 5) throw err;
      }
      if (attempt >= 5) throw new Error("User wallets were not ready after 5 attempts");
      await sleep(2000);
    }
  }

  // ---- Balances ----

  async getBalances(userId: string): Promise<BalanceItem[]> {
    const page = await this.get<Page<BalanceItem>>("/v1/gateway/balances", { onBehalfOf: userId });
    return page.data;
  }

  async getPortfolio(userId: string): Promise<Record<string, unknown>> {
    return this.get("/v1/gateway/portfolio", { onBehalfOf: userId });
  }

  // ---- Orders ----

  async quote(userId: string, req: QuoteRequest): Promise<QuoteResponse> {
    return this.post("/v1/gateway/quotes", req, { onBehalfOf: userId });
  }

  async createOrder(userId: string, req: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.post("/v1/gateway/orders", req, { onBehalfOf: userId });
  }

  async executeOrder(userId: string, orderId: string, signatures: string[]): Promise<{ status: OrderStatus }> {
    return this.post(`/v1/gateway/orders/${orderId}/execute`, { signatures, auth_type: "api_key" }, { onBehalfOf: userId });
  }

  async getOrder(userId: string, orderId: string): Promise<OrderDetail> {
    return this.get(`/v1/gateway/orders/${orderId}`, { onBehalfOf: userId });
  }

  /** Polls until the order reaches a final status (or rests, for a limit order). */
  async waitForOrder(userId: string, orderId: string, { intervalMs = 2000, timeoutMs = 120_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const order = await this.getOrder(userId, orderId);
      if (FINAL_ORDER_STATUSES.includes(order.status)) return order;
      if (Date.now() > deadline) return order;
      await sleep(intervalMs);
    }
  }

  // ---- Transfers ----

  async createTransfer(userId: string, req: CreateTransferRequest): Promise<TransferDetail> {
    return this.post("/v1/gateway/transfers", req, { onBehalfOf: userId });
  }

  async executeTransfer(userId: string, transferId: string, signatures: string[]): Promise<TransferDetail> {
    return this.post(
      `/v1/gateway/transfers/${transferId}/execute`,
      { signatures, auth_type: "api_key" },
      { onBehalfOf: userId },
    );
  }

  async getTransfer(userId: string, transferId: string): Promise<TransferDetail> {
    return this.get(`/v1/gateway/transfers/${transferId}`, { onBehalfOf: userId });
  }

  async waitForTransfer(userId: string, transferId: string, { intervalMs = 2000, timeoutMs = 120_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const transfer = await this.getTransfer(userId, transferId);
      if (transfer.status === "completed" || transfer.status === "failed") return transfer;
      if (Date.now() > deadline) return transfer;
      await sleep(intervalMs);
    }
  }

  // ---- Activity ----

  async listTransactions(userId: string, query: { type?: "order" | "transfer"; cursor?: string; limit?: number } = {}) {
    return this.get<Page<TransactionRow>>("/v1/gateway/transactions", { onBehalfOf: userId, query });
  }

  // ---- HTTP ----

  private get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, undefined, opts);
  }

  private post<T>(path: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, body, opts);
  }

  private async request<T>(method: "GET" | "POST", path: string, body: unknown, opts: RequestOptions): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let refreshedToken = false;
    for (let attempt = 1; ; attempt++) {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (opts.auth !== false) headers.Authorization = `Bearer ${await this.tokens.getToken()}`;
      if (opts.onBehalfOf) headers["TM-On-Behalf-Of"] = opts.onBehalfOf;

      const res = await this.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        // Money data must always be live. `no-store` stops caching; a fresh signal
        // stops Next.js from reusing an identical GET within one render (otherwise a
        // balance read after funding returns the stale, earlier answer).
        cache: "no-store",
        signal: new AbortController().signal,
      });
      if (res.ok) return (await res.json()) as T;

      const err = await errorFromResponse(res);
      // Refresh an expired token once; retrying unchanged would fail the same way.
      if (err.status === 401 && opts.auth !== false && !refreshedToken) {
        this.tokens.invalidate();
        refreshedToken = true;
        continue;
      }
      // Only reads, and POSTs rejected by rate limiting, are safe to resend blindly.
      const retryable = method === "GET" ? RETRYABLE_STATUSES.includes(err.status) : err.status === 429;
      if (retryable && attempt < 4) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw err;
    }
  }
}
