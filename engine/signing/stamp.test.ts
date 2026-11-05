import { describe, expect, it } from "vitest";
import { compressedPublicKey, generateSignerKey } from "./keys";
import { createStamper, payloadDigest, verifyStamp } from "./stamp";

describe("payload stamps", () => {
  const key = generateSignerKey();
  const stamper = createStamper(key.signer_private_key);
  const payload = '{"type":"ACTIVITY_TYPE_SIGN_TRANSACTION_V2"}\n';

  it("uses a 66-character compressed public key", () => {
    expect(key.signer_public_key).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(stamper.publicKey).toBe(key.signer_public_key);
    expect(compressedPublicKey(key.signer_private_key)).toBe(key.signer_public_key);
  });

  it("produces the documented envelope", () => {
    const envelope = JSON.parse(Buffer.from(stamper.stamp(payload), "base64url").toString());
    expect(envelope).toEqual({
      publicKey: key.signer_public_key,
      signature: expect.stringMatching(/^30[0-9a-f]+$/), // DER sequence, hex
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
    });
  });

  it("verifies against the exact payload and key only", () => {
    const stamp = stamper.stamp(payload);
    expect(verifyStamp(stamp, payload, key.signer_public_key)).toBe(true);
    expect(verifyStamp(stamp, payload.trimEnd(), key.signer_public_key)).toBe(false);
    expect(verifyStamp(stamp, payload, generateSignerKey().signer_public_key)).toBe(false);
  });

  it("computes the digest the Gateway sends", () => {
    expect(payloadDigest("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
