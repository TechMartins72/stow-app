// Generates a signer key file for GATEWAY_MODE=live. Every user you create is
// tied to this key forever (no rotation yet), so back it up before creating
// real users. For production, prefer a KMS that signs P-256 without exporting.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { generateSignerKey } from "../engine/signing/keys";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file.
}

const path = process.env.SIGNER_KEY_FILE ?? ".secrets/signer-key.json";
if (existsSync(path)) {
  console.error(`${path} already exists. Users created with it can only ever sign with it, so it is never overwritten.`);
  process.exit(1);
}

const key = generateSignerKey();
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(key, null, 2), { mode: 0o600 });
console.log(`✓ Signer key written to ${path}`);
console.log(`  public key: ${key.signer_public_key}`);
console.log("  Back this file up now. If it is lost, every user created with it can never sign again.");
