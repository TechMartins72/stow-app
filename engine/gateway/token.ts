import { createPrivateKey, sign, type JsonWebKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { errorFromResponse } from "./errors";

// Organization tokens last one hour and have no refresh token, so mint a new
// one this long before expiry.
const REFRESH_MARGIN_MS = 5 * 60_000;

export interface ApiKeyFile {
  key_id: string;
  private_key: JsonWebKey;
}

export interface TokenProvider {
  getToken(): Promise<string>;
  getOrganizationId(): Promise<string>;
  invalidate(): void;
}

export function loadApiKeyFile(path: string): ApiKeyFile {
  const file = JSON.parse(readFileSync(path, "utf8")) as ApiKeyFile;
  if (!file.key_id || !file.private_key) throw new Error(`${path} is not an organization API key file`);
  return file;
}

/** Signs `{key_id}.{timestamp}` with the organization API key and exchanges it for a token. */
export class ApiKeyTokenProvider implements TokenProvider {
  private token?: string;
  private expiresAt = 0;
  private organizationId?: string;
  private pending?: Promise<string>;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: ApiKeyFile,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getToken(): Promise<string> {
    if (this.token && this.expiresAt - Date.now() > REFRESH_MARGIN_MS) return this.token;
    // Concurrent callers share one mint.
    this.pending ??= this.mint().finally(() => (this.pending = undefined));
    return this.pending;
  }

  async getOrganizationId(): Promise<string> {
    await this.getToken();
    if (!this.organizationId) throw new Error("Token did not name an organization");
    return this.organizationId;
  }

  invalidate(): void {
    this.token = undefined;
    this.expiresAt = 0;
  }

  private async mint(): Promise<string> {
    // Minting moves nothing, so a dropped connection is simply tried again (3 tries).
    let res: Response | undefined;
    for (let attempt = 1; !res; attempt++) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = sign("sha256", Buffer.from(`${this.apiKey.key_id}.${timestamp}`), {
        key: createPrivateKey({ key: this.apiKey.private_key, format: "jwk" }),
        dsaEncoding: "ieee-p1363", // r and s concatenated, which the API expects
      }).toString("base64url");
      try {
        res = await this.fetchImpl(`${this.baseUrl}/v1/auth/api-key/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key_id: this.apiKey.key_id, timestamp, signature }),
        });
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      }
    }
    if (!res.ok) throw await errorFromResponse(res);

    const minted = (await res.json()) as { access_token: string; expires_in: string | number };
    const claims = JSON.parse(Buffer.from(minted.access_token.split(".")[1], "base64url").toString()) as {
      tm?: { organization_id?: string };
    };
    this.token = minted.access_token;
    this.expiresAt = parseExpiry(minted.expires_in);
    this.organizationId = claims.tm?.organization_id;
    return this.token;
  }
}

// The docs show `expires_in` as an RFC 3339 timestamp; accept seconds too.
function parseExpiry(value: string | number): number {
  if (typeof value === "number") return Date.now() + value * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? Date.now() + Number(value) * 1000 : at;
}
