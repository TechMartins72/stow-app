import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GatewayClient } from "./gateway/client";
import { ApiKeyTokenProvider, loadApiKeyFile, type ApiKeyFile } from "./gateway/token";
import { SigningGuard } from "./signing/guard";
import { generateSignerKey, loadSignerKeyFile } from "./signing/keys";
import type { VaultStore } from "./vault/store";

export type GatewayMode = "mock" | "live";

export interface EngineConfig {
  mode: GatewayMode;
  apiBase: string;
  apiKeyFile?: string;
  signerKeyFile: string;
}

const MOCK_SIGNER_KEY_FILE = ".secrets/signer-key.mock.json";

/** Mock is the default; real money needs GATEWAY_MODE=live spelled out. */
export function loadEngineConfig(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  const mode: GatewayMode = env.GATEWAY_MODE === "live" ? "live" : "mock";
  if (mode === "mock") {
    return {
      mode,
      apiBase: env.MOCK_GATEWAY_URL ?? "http://localhost:4010",
      signerKeyFile: env.SIGNER_KEY_FILE_MOCK ?? MOCK_SIGNER_KEY_FILE,
    };
  }
  if (!env.TM_KEY_FILE) throw new Error("GATEWAY_MODE=live needs TM_KEY_FILE (your organization API key file)");
  if (!env.SIGNER_KEY_FILE) throw new Error("GATEWAY_MODE=live needs SIGNER_KEY_FILE");
  return {
    mode,
    apiBase: env.TM_API_BASE ?? "https://api.truemarkets.co",
    apiKeyFile: env.TM_KEY_FILE,
    signerKeyFile: env.SIGNER_KEY_FILE,
  };
}

export function createEngine(config: EngineConfig, store: VaultStore) {
  const apiKey = config.mode === "live" ? loadApiKeyFile(config.apiKeyFile!) : mockApiKey();
  if (config.mode === "mock" && !existsSync(config.signerKeyFile)) {
    // The mock keeps users for as long as it runs, so reuse one signer key across script runs.
    mkdirSync(dirname(config.signerKeyFile), { recursive: true });
    writeFileSync(config.signerKeyFile, JSON.stringify(generateSignerKey()), { mode: 0o600 });
  }
  const signer = loadSignerKeyFile(config.signerKeyFile);

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
