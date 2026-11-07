import { describe, expect, it } from "vitest";
import { areaPath, linePath, scalePrices } from "./chart-math";

describe("scalePrices", () => {
  it("puts the lowest price at the bottom and the highest at the top, inside the padding", () => {
    const pts = scalePrices(["100", "110", "105"], 200, 100, 0.1);
    expect(pts.map((p) => p.x)).toEqual([0, 100, 200]);
    expect(pts[0].y).toBeCloseTo(90); // lowest
    expect(pts[1].y).toBeCloseTo(10); // highest
    expect(pts[2].y).toBeCloseTo(50);
  });

  it("draws a flat series across the middle and ignores junk values", () => {
    expect(scalePrices(["5", "5", "oops"], 100, 50, 0).map((p) => p.y)).toEqual([25, 25]);
    expect(scalePrices([], 100, 50)).toEqual([]);
  });

  it("keeps tiny price differences visible without floating-point amounts", () => {
    const pts = scalePrices(["0.00002000", "0.00002001"], 10, 100, 0);
    expect(pts[0].y).toBe(100);
    expect(pts[1].y).toBe(0);
  });
});

describe("paths", () => {
  it("builds a line and a closed area", () => {
    const pts = [{ x: 0, y: 10 }, { x: 5, y: 2 }];
    expect(linePath(pts)).toBe("M0.00 10.00 L5.00 2.00");
    expect(areaPath(pts, 20)).toBe("M0.00 10.00 L5.00 2.00 L5.00 20 L0.00 20 Z");
  });
});
