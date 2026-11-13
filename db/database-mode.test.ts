import { describe, expect, it } from "vitest";
import { databaseModeProblem } from "./database-mode";

describe("databaseModeProblem", () => {
  it("accepts a database used in the same mode", () => {
    expect(databaseModeProblem("mock", "mock")).toBeNull();
    expect(databaseModeProblem("live", "live")).toBeNull();
  });

  it("refuses to run real money on a practice database", () => {
    expect(databaseModeProblem("mock", "live")).toMatch(/practice/i);
    expect(databaseModeProblem("mock", "live")).toMatch(/DATABASE_URL/);
  });

  it("refuses practice mode on a live database", () => {
    expect(databaseModeProblem("live", "mock")).toMatch(/real money/i);
  });

  it("leaves an unclaimed database to be claimed by the first mode that uses it", () => {
    expect(databaseModeProblem(null, "live")).toBeNull();
    expect(databaseModeProblem(null, "mock")).toBeNull();
  });

  it("treats an unknown stored value as a problem", () => {
    expect(databaseModeProblem("staging", "live")).not.toBeNull();
  });
});
