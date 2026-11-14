import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createEngine, loadEngineConfig } from "./index";
import { parseApiKey } from "./gateway/token";
import { generateSignerKey, parseSignerKey } from "./signing/keys";
import { MemoryVaultStore } from "./vault/store";

// Throwaway keys, made fresh for the test run.
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const apiKeyJson = JSON.stringify({ key_id: "k-test", private_key: privateKey.export({ format: "jwk" }) });
const signer = generateSignerKey();
const signerJson = JSON.stringify(signer);

describe("live config on a host without key files (Vercel)", () => {
  it("takes both keys from environment variables holding the files' contents", () => {
    const config = loadEngineConfig({ GATEWAY_MODE: "live", TM_API_KEY: apiKeyJson, SIGNER_KEY: signerJson });
    expect(config).toMatchObject({ mode: "live", apiBase: "https://api.truemarkets.co" });
    const engine = createEngine(config, new MemoryVaultStore());
    expect(engine.guard.signerPublicKey).toBe(signer.signer_public_key);
  });

  it("still takes key files, as on a developer's computer", () => {
    const config = loadEngineConfig({ GATEWAY_MODE: "live", TM_KEY_FILE: ".secrets/api-key.json", SIGNER_KEY_FILE: ".secrets/signer-key.json" });
    expect(config).toMatchObject({ apiKeyFile: ".secrets/api-key.json", signerKeyFile: ".secrets/signer-key.json" });
  });

  it("refuses to start live without each key, naming both ways to give it", () => {
    expect(() => loadEngineConfig({ GATEWAY_MODE: "live", SIGNER_KEY: signerJson })).toThrow(/TM_API_KEY.*TM_KEY_FILE/);
    expect(() => loadEngineConfig({ GATEWAY_MODE: "live", TM_API_KEY: apiKeyJson })).toThrow(/SIGNER_KEY.*SIGNER_KEY_FILE/);
  });
});

describe("key parsing", () => {
  it("accepts the files' contents", () => {
    expect(parseApiKey(apiKeyJson, "TM_API_KEY").key_id).toBe("k-test");
    expect(parseSignerKey(signerJson, "SIGNER_KEY").signer_public_key).toBe(signer.signer_public_key);
  });

  it("never repeats key material in its errors", () => {
    const secretish = "d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f";
    for (const attempt of [
      () => parseApiKey(`{"key_id": "x", "private_key": "${secretish}"`, "TM_API_KEY"), // broken JSON
      () => parseSignerKey(`{"signer_private_key": "${secretish}", "signer_public_key": "02ab"}`, "SIGNER_KEY"), // wrong shape
      () => parseSignerKey(`${secretish}`, "SIGNER_KEY"), // not JSON at all
    ]) {
      let message = "";
      try {
        attempt();
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(secretish);
    }
  });

  it("rejects a signer key whose public half doesn't match its private half", () => {
    const other = generateSignerKey();
    expect(() => parseSignerKey(JSON.stringify({ ...signer, signer_public_key: other.signer_public_key }), "SIGNER_KEY")).toThrow(/does not match/);
  });
});
