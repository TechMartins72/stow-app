import { createECDH, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

/** The signer key file format the developer console downloads: hex keys. */
export interface SignerKeyFile {
  signer_public_key: string; // compressed P-256 point, 66 hex characters
  signer_private_key: string; // 32-byte scalar, 64 hex characters
}

export function generateSignerKey(): SignerKeyFile {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const d = privateKey.export({ format: "jwk" }).d;
  if (!d) throw new Error("Could not export the generated key");
  const privateHex = Buffer.from(d, "base64url").toString("hex").padStart(64, "0");
  return { signer_public_key: compressedPublicKey(privateHex), signer_private_key: privateHex };
}

export function compressedPublicKey(privateKeyHex: string): string {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privateKeyHex, "hex"));
  return ecdh.getPublicKey("hex", "compressed");
}

export function loadSignerKeyFile(path: string): SignerKeyFile {
  const file = JSON.parse(readFileSync(path, "utf8")) as SignerKeyFile;
  if (!/^[0-9a-f]{64}$/i.test(file.signer_private_key ?? "")) {
    throw new Error(`${path} is not a signer key file`);
  }
  if (compressedPublicKey(file.signer_private_key) !== file.signer_public_key.toLowerCase()) {
    throw new Error(`${path}: public key does not match private key`);
  }
  return file;
}
