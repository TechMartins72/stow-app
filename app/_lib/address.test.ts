import { describe, expect, it } from "vitest";
import { chainFamily, checkAddress, networkLabel, shortAddress } from "./address";

describe("chainFamily", () => {
  it("maps chains to wallet families", () => {
    expect(chainFamily("solana")).toBe("solana");
    expect(chainFamily("base")).toBe("evm");
    expect(chainFamily("ethereum")).toBe("evm");
    expect(chainFamily("hypercore-perp")).toBeNull();
    expect(chainFamily(null)).toBeNull();
  });
});

describe("checkAddress", () => {
  it("accepts well-formed addresses", () => {
    expect(checkAddress("solana", "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")).toBeNull();
    expect(checkAddress("evm", "0x52908400098527886E0F7030069857D2E4169EE7")).toBeNull();
    expect(checkAddress("evm", "  0x52908400098527886e0f7030069857d2e4169ee7  ")).toBeNull();
  });

  it("explains an empty or malformed address", () => {
    expect(checkAddress("solana", "")).toMatch(/Paste/);
    expect(checkAddress("solana", "0x52908400098527886E0F7030069857D2E4169EE7")).toMatch(/Ethereum-style/);
    expect(checkAddress("evm", "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")).toMatch(/Solana/);
    expect(checkAddress("solana", "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVF0l")).toMatch(/Solana address/);
    expect(checkAddress("evm", "0x1234")).toMatch(/0x/);
  });
});

describe("display helpers", () => {
  it("names networks and shortens addresses", () => {
    expect(networkLabel("solana")).toBe("Solana");
    expect(networkLabel("base")).toBe("Base");
    expect(shortAddress("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")).toBe("9xQeWv…VFin");
  });
});
