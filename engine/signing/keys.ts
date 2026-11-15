import { createECDH, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseKeyJson } from "../key-json";

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

/**
 * Reads a signer key from the file's text (a file on disk, or the SIGNER_KEY
 * environment variable on hosts without files). `source` names where it came
 * from; errors never repeat any of the key itself (Node's JSON errors quote the input).
 */
export function parseSignerKey(text: string, source: string): SignerKeyFile {
  const file = parseKeyJson(text, source, "signer key file") as Partial<SignerKeyFile>;
  if (!file || typeof file !== "object" || !/^[0-9a-f]{64}$/i.test(file.signer_private_key ?? "") || typeof file.signer_public_key !== "string") {
    throw new Error(`${source} is not a signer key file`);
  }
  if (compressedPublicKey(file.signer_private_key!) !== file.signer_public_key.toLowerCase()) {
    throw new Error(`${source}: public key does not match private key`);
  }
  return file as SignerKeyFile;
}

export function loadSignerKeyFile(path: string): SignerKeyFile {
  return parseSignerKey(readFileSync(path, "utf8"), path);
}
