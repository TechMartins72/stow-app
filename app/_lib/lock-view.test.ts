import { describe, expect, it } from "vitest";
import { dec } from "@/engine/decimal";
import { buildSchedule } from "@/engine/vault/schedule";
import type { Lock } from "@/engine/vault/types";
import { sortLockViews, toLockView } from "./lock-view";

const schedule = buildSchedule({
  total: "4000",
  decimals: 6,
  firstAt: new Date("2026-12-05T00:00:00Z"),
  every: "month",
  split: { kind: "percent", percent: "25" },
});
const sandra: Lock = {
  id: "s",
  userId: "u",
  assetId: "usdc",
  symbol: "USDC",
  amount: "4000",
  unlockAt: schedule.at(-1)!.releaseAt,
  schedule,
  status: "active",
  goalName: "Monthly budget",
  createdAt: new Date("2026-11-05T00:00:00Z"),
};

describe("toLockView", () => {
  it("shows Sandra's lock after two releases", () => {
    const v = toLockView(sandra, new Date("2027-01-10T00:00:00Z"), dec("1"));
    expect(v).toMatchObject({
      lockedAmount: "2000",
      lockedUsd: "2000",
      parts: 4,
      partsReleased: 2,
      releasedShare: 0.5,
      finished: false,
      next: { amount: "1000" },
    });
    expect(v.schedule.map((p) => p.released)).toEqual([true, true, false, false]);
  });

  it("is finished once every part has freed itself", () => {
    const v = toLockView(sandra, new Date("2027-04-01T00:00:00Z"), dec("1"));
    expect(v).toMatchObject({ finished: true, lockedAmount: "0", partsReleased: 4, releasedShare: 1, next: undefined });
  });

  it("treats a closed lock as fully released", () => {
    const v = toLockView({ ...sandra, status: "released" }, new Date("2026-11-06T00:00:00Z"), dec("1"));
    expect(v.finished).toBe(true);
    expect(v.schedule.every((p) => p.released)).toBe(true);
  });
});

describe("sortLockViews", () => {
  it("splits active from finished and orders by the next release", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const soon: Lock = { ...sandra, id: "soon", schedule: undefined, unlockAt: new Date("2026-11-20T00:00:00Z") };
    const done: Lock = { ...sandra, id: "done", schedule: undefined, unlockAt: new Date("2026-11-01T00:00:00Z") };
    const { active, finished } = sortLockViews([sandra, done, soon].map((l) => toLockView(l, now, dec("1"))));
    expect(active.map((v) => v.id)).toEqual(["soon", "s"]);
    expect(finished.map((v) => v.id)).toEqual(["done"]);
  });
});
