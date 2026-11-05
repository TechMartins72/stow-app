// Payload stamps for Gateway wallet transactions.
// https://docs.truemarkets.co/gateway/requests-and-signing#sign-a-wallet-transaction
//
// Only engine/signing/guard.ts may create a Stamper. Anything else that signs
// a payload would bypass the lock and guardrail rules.

import { createECDH, createHash, createPrivateKey, createPublicKey, ECDH, sign, verify } from "node:crypto";
import { compressedPublicKey } from "./keys";

const SCHEME = "SIGNATURE_SCHEME_TK_API_P256";

export interface Stamper {
  readonly publicKey: string;
  /** Signs the payload string exactly as the Gateway returned it. */
  stamp(payload: string): string;
}

interface StampEnvelope {
  publicKey: string;
  signature: string;
  scheme: string;
}

export function createStamper(privateKeyHex: string): Stamper {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privateKeyHex, "hex"));
  const point = ecdh.getPublicKey(); // 0x04 || x || y
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: Buffer.from(privateKeyHex, "hex").toString("base64url"),
      x: point.subarray(1, 33).toString("base64url"),
      y: point.subarray(33).toString("base64url"),
    },
  });
  const publicKey = compressedPublicKey(privateKeyHex);

  return {
    publicKey,
    stamp(payload: string): string {
      // DER-encoded ECDSA signature (node's default), as hex.
      const signature = sign("sha256", Buffer.from(payload), key).toString("hex");
      const envelope: StampEnvelope = { publicKey, signature, scheme: SCHEME };
      return Buffer.from(JSON.stringify(envelope)).toString("base64url");
    },
  };
}

/** Checks a stamp against a payload. Used by the mock Gateway and tests. */
export function verifyStamp(stamp: string, payload: string, expectedPublicKey?: string): boolean {
  let envelope: StampEnvelope;
  try {
    envelope = JSON.parse(Buffer.from(stamp, "base64url").toString()) as StampEnvelope;
  } catch {
    return false;
  }
  if (envelope.scheme !== SCHEME) return false;
  if (expectedPublicKey && envelope.publicKey.toLowerCase() !== expectedPublicKey.toLowerCase()) return false;

  // Expand the compressed point to 0x04 || x || y.
  const point = Buffer.from(
    ECDH.convertKey(envelope.publicKey, "prime256v1", "hex", "hex", "uncompressed") as string,
    "hex",
  );
  const key = createPublicKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: point.subarray(1, 33).toString("base64url"),
      y: point.subarray(33).toString("base64url"),
    },
  });
  return verify("sha256", Buffer.from(payload), key, Buffer.from(envelope.signature, "hex"));
}

/** The digest the Gateway sends next to each payload: lowercase hex SHA-256 of its bytes. */
export function payloadDigest(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}
