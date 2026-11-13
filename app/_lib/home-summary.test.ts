import { describe, expect, it } from "vitest";
import { buildSchedule } from "@/engine/vault/schedule";
import type { Lock } from "@/engine/vault/types";
import { allocation, bucketOf, upcomingReleases } from "./home-summary";

describe("bucketOf", () => {
  it("puts stablecoins in cash, stocks in stocks, everything else in crypto", () => {
    expect(bucketOf({ stable: true, asset_class: "crypto" })).toBe("cash");
    expect(bucketOf({ stable: false, asset_class: "stock" })).toBe("stocks");
    expect(bucketOf({ asset_class: "crypto" })).toBe("crypto");
    expect(bucketOf({})).toBe("crypto");
  });
});

describe("allocation", () => {
  it("sums each bucket and gives its share in basis points", () => {
    const a = allocation([
      { bucket: "cash", valueUsd: "1850" },
      { bucket: "crypto", valueUsd: "975" },
      { bucket: "stocks", valueUsd: "704" },
      { bucket: "cash", valueUsd: "150" },
    ]);
    expect(a.map((x) => [x.bucket, x.valueUsd])).toEqual([
      ["cash", "2000"],
      ["crypto", "975"],
      ["stocks", "704"],
    ]);
    // 2000 / 3679 = 54.36%, 975 / 3679 = 26.50%, 704 / 3679 = 19.13% (rounded down)
    expect(a.map((x) => x.bps)).toEqual([5436, 2650, 1913]);
  });

  it("keeps empty buckets at zero and copes with an empty wallet", () => {
    expect(allocation([{ bucket: "cash", valueUsd: "10" }]).map((x) => x.bps)).toEqual([10000, 0, 0]);
    expect(allocation([]).map((x) => [x.valueUsd, x.bps])).toEqual([
      ["0", 0],
      ["0", 0],
      ["0", 0],
    ]);
  });
});

describe("upcomingReleases", () => {
  const now = new Date("2026-11-13T00:00:00Z");
  const schedule = buildSchedule({
    total: "4000",
    decimals: 6,
    firstAt: new Date("2026-12-05T00:00:00Z"),
    every: "month",
    split: { kind: "percent", percent: "25" },
  });
  const budget: Lock = {
    id: "budget",
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
  const laptop: Lock = {
    ...budget,
    id: "laptop",
    assetId: "sol",
    symbol: "SOL",
    amount: "4",
    schedule: undefined,
    unlockAt: new Date("2026-12-07T00:00:00Z"),
    goalName: "New laptop",
  };

  it("lists the next parts across all locks, soonest first", () => {
    const next = upcomingReleases([laptop, budget], now, 3);
    expect(next.map((r) => [r.lockId, r.amount, r.releaseAt.toISOString().slice(0, 10)])).toEqual([
      ["budget", "1000", "2026-12-05"],
      ["laptop", "4", "2026-12-07"],
      ["budget", "1000", "2027-01-05"],
    ]);
    expect(next[0]).toMatchObject({ goalName: "Monthly budget", symbol: "USDC", part: 1, parts: 4 });
    expect(next[1]).toMatchObject({ part: 1, parts: 1 });
  });

  it("skips parts already released and locks that are closed", () => {
    const later = new Date("2027-01-10T00:00:00Z");
    expect(upcomingReleases([budget], later, 5).map((r) => r.part)).toEqual([3, 4]);
    expect(upcomingReleases([{ ...budget, status: "released" }], now, 5)).toEqual([]);
  });

  it("names a lock without a goal after its asset", () => {
    expect(upcomingReleases([{ ...laptop, goalName: undefined }], now, 1)[0].goalName).toBe("SOL lock");
  });
});
