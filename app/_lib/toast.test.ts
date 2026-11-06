import { describe, expect, it } from "vitest";
import { parseFlash } from "./toast";

const enc = (v: unknown) => encodeURIComponent(JSON.stringify(v));

describe("parseFlash", () => {
  it("reads a well-formed toast", () => {
    expect(parseFlash(enc({ tone: "success", title: "Locked", href: "/vault/1", linkLabel: "View lock" }))).toEqual({
      tone: "success",
      title: "Locked",
      body: undefined,
      href: "/vault/1",
      linkLabel: "View lock",
    });
  });

  it("drops malformed values and unknown tones", () => {
    expect(parseFlash(undefined)).toBeNull();
    expect(parseFlash("not json")).toBeNull();
    expect(parseFlash(enc({ tone: "party", title: "x" }))).toBeNull();
    expect(parseFlash(enc({ tone: "info" }))).toBeNull();
  });

  it("never links off-site", () => {
    expect(parseFlash(enc({ tone: "info", title: "x", href: "https://evil.example" }))?.href).toBeUndefined();
    expect(parseFlash(enc({ tone: "info", title: "x", href: "//evil.example" }))?.href).toBeUndefined();
  });
});
