import { describe, it, expect } from "vitest";

// Pure client-side calculator mirroring backend logic for instant UI feedback
function calcTotal(
  nominations: { place1: number; place2: number; place3: number }[],
  hasGrandPrix: boolean,
  giveaways: number,
  participants: number,
  level: "Скромный" | "Нормальный" | "Хороший"
): number {
  const costs = {
    Скромный: { "1": 650, "2": 650, "3": 650 },
    Нормальный: { "1": 4500, "2": 3000, "3": 1750 },
    Хороший: { "1": 8500, "2": 6000, "3": 3500 },
  };
  const modest = 650;
  const grandPrixCost = 12500;

  let total = 0;
  for (const nom of nominations) {
    total += nom.place1 * costs[level]["1"];
    total += nom.place2 * costs[level]["2"];
    total += nom.place3 * costs[level]["3"];
  }
  if (hasGrandPrix) total += grandPrixCost;
  total += giveaways * modest;
  total += participants * modest;
  return total;
}

describe("client-side calculator", () => {
  it("returns 0 for empty nominations", () => {
    expect(calcTotal([], false, 0, 0, "Нормальный")).toBe(0);
  });

  it("normal level is more expensive than modest", () => {
    const noms = [{ place1: 1, place2: 1, place3: 1 }];
    expect(calcTotal(noms, false, 0, 0, "Нормальный")).toBeGreaterThan(
      calcTotal(noms, false, 0, 0, "Скромный")
    );
  });

  it("good level is more expensive than normal", () => {
    const noms = [{ place1: 1, place2: 1, place3: 1 }];
    expect(calcTotal(noms, false, 0, 0, "Хороший")).toBeGreaterThan(
      calcTotal(noms, false, 0, 0, "Нормальный")
    );
  });

  it("grand prix adds fixed cost", () => {
    const without = calcTotal([], false, 0, 0, "Нормальный");
    const with_gp = calcTotal([], true, 0, 0, "Нормальный");
    expect(with_gp - without).toBe(12500);
  });

  it("giveaways add modest price each", () => {
    expect(calcTotal([], false, 3, 0, "Нормальный")).toBe(3 * 650);
  });

  it("multiple nominations sum correctly", () => {
    const noms = [
      { place1: 2, place2: 0, place3: 0 },
      { place1: 0, place2: 3, place3: 0 },
    ];
    const result = calcTotal(noms, false, 0, 0, "Нормальный");
    expect(result).toBe(2 * 4500 + 3 * 3000);
  });
});
