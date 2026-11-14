import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GatewayClient } from "./gateway/client";
import { ApiKeyTokenProvider, loadApiKeyFile, parseApiKey, type ApiKeyFile } from "./gateway/token";
import { SigningGuard } from "./signing/guard";
import { generateSignerKey, loadSignerKeyFile, parseSignerKey } from "./signing/keys";
import type { VaultStore } from "./vault/store";

export type GatewayMode = "mock" | "live";

export interface EngineConfig {
  mode: GatewayMode;
  apiBase: string;
  /** The API key as a file path (a developer's computer)… */
  apiKeyFile?: string;
  /** …or as the file's contents, from an environment variable (Vercel has no key files). */
  apiKeyJson?: string;
  signerKeyFile?: string;
  signerKeyJson?: string;
}

const MOCK_SIGNER_KEY_FILE = ".secrets/signer-key.mock.json";

/** Mock is the default; real money needs GATEWAY_MODE=live spelled out. */
export function loadEngineConfig(env: Record<string, string | undefined> = process.env): EngineConfig {
  const mode: GatewayMode = env.GATEWAY_MODE === "live" ? "live" : "mock";
  if (mode === "mock") {
    return {
      mode,
      apiBase: env.MOCK_GATEWAY_URL ?? "http://localhost:4010",
      signerKeyFile: env.SIGNER_KEY_FILE_MOCK ?? MOCK_SIGNER_KEY_FILE,
    };
  }
  // Each key comes either as the file's contents in an environment variable (hosts like
  // Vercel have no key files) or as a path to the file (a developer's computer).
  if (!env.TM_API_KEY && !env.TM_KEY_FILE) {
    throw new Error("GATEWAY_MODE=live needs TM_API_KEY (the API key file's contents) or TM_KEY_FILE (its path)");
  }
  if (!env.SIGNER_KEY && !env.SIGNER_KEY_FILE) {
    throw new Error("GATEWAY_MODE=live needs SIGNER_KEY (the signer key file's contents) or SIGNER_KEY_FILE (its path)");
  }
  return {
    mode,
    apiBase: env.TM_API_BASE ?? "https://api.truemarkets.co",
    ...(env.TM_API_KEY ? { apiKeyJson: env.TM_API_KEY } : { apiKeyFile: env.TM_KEY_FILE }),
    ...(env.SIGNER_KEY ? { signerKeyJson: env.SIGNER_KEY } : { signerKeyFile: env.SIGNER_KEY_FILE }),
  };
}

export function createEngine(config: EngineConfig, store: VaultStore) {
  const apiKey =
    config.mode !== "live" ? mockApiKey() : config.apiKeyJson ? parseApiKey(config.apiKeyJson, "TM_API_KEY") : loadApiKeyFile(config.apiKeyFile!);
  if (config.mode === "mock" && !config.signerKeyJson && config.signerKeyFile && !existsSync(config.signerKeyFile)) {
    // The mock keeps users for as long as it runs, so reuse one signer key across script runs.
    mkdirSync(dirname(config.signerKeyFile), { recursive: true });
    writeFileSync(config.signerKeyFile, JSON.stringify(generateSignerKey()), { mode: 0o600 });
  }
  const signer = config.signerKeyJson ? parseSignerKey(config.signerKeyJson, "SIGNER_KEY") : loadSignerKeyFile(config.signerKeyFile!);

  const tokens = new ApiKeyTokenProvider(config.apiBase, apiKey);
  const client = new GatewayClient(config.apiBase, tokens);
  const guard = new SigningGuard({ client, store, signerPrivateKeyHex: signer.signer_private_key });
  return { config, tokens, client, guard, store };
}

export type Engine = ReturnType<typeof createEngine>;

// The mock accepts any well-formed token request, so a throwaway key is enough.
function mockApiKey(): ApiKeyFile {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { key_id: "mock", private_key: privateKey.export({ format: "jwk" }) };
}

export { GatewayClient } from "./gateway/client";
export { GatewayError, isGatewayError, isNetworkFailure } from "./gateway/errors";
export type * from "./gateway/types";
export { SigningGuard, type GuardOutcome, type GuardUser } from "./signing/guard";
export { createLock, releaseLock, LockError } from "./vault/locks";
export { accessibleBalance, checkAction } from "./vault/rules";
export {
  addInterval,
  buildSchedule,
  lockedNow,
  MAX_TRANCHES,
  nextRelease,
  tranchesOf,
  validateSchedule,
  type Interval,
  type Split,
} from "./vault/schedule";
export { MemoryVaultStore, type VaultStore } from "./vault/store";
export type * from "./vault/types";
