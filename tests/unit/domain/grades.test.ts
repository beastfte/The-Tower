import { describe, expect, it } from "vitest";
import {
  EXTRA_STAT_RANGES,
  GRADE_ORDER,
  GRADES,
  bandFor,
  eliteStats,
  gradedValue,
  rollGear,
  rollGold,
  rollMonsterDrop,
} from "../../../src/domain/character/grades";

/** Deterministic mulberry32, so the distribution checks never flake. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("gradedValue (034 C1)", () => {
  it("is round(v × 1.1^n) and never decreases, for small and large values", () => {
    for (let v = 1; v <= 20; v++) {
      let prev = 0;
      GRADE_ORDER.forEach((grade, n) => {
        const value = gradedValue(v, grade);
        expect(value).toBe(Math.round(v * Math.pow(1.1, n)));
        expect(value).toBeGreaterThanOrEqual(prev);
        prev = value;
      });
    }
  });

  it("lets small stats tie but raises larger ones every grade", () => {
    expect(GRADE_ORDER.map((g) => gradedValue(3, g))).toEqual([3, 3, 4, 4, 4]);
    expect(GRADE_ORDER.map((g) => gradedValue(1, g))).toEqual([1, 1, 1, 1, 1]);
    expect(new Set(GRADE_ORDER.map((g) => gradedValue(14, g))).size).toBe(5);
  });
});

describe("rollGear (034 C2)", () => {
  it("gives exactly 0..4 distinct extras, each inside its range", () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      GRADE_ORDER.forEach((grade, n) => {
        const item = rollGear("sword", grade, rng);
        const ids = Object.keys(item.extras) as (keyof typeof EXTRA_STAT_RANGES)[];
        expect(ids).toHaveLength(n);
        expect(GRADES[grade].extraCount).toBe(n);
        for (const id of ids) {
          const pct = Math.round(item.extras[id]! * 100);
          expect(pct).toBeGreaterThanOrEqual(EXTRA_STAT_RANGES[id].min);
          expect(pct).toBeLessThanOrEqual(EXTRA_STAT_RANGES[id].max);
        }
      });
    }
  });
});

describe("bandFor (034 FR-012)", () => {
  it("maps floors to leather/wood, mail/sword and plate/diamond", () => {
    expect(bandFor(1)).toEqual({ material: "leather", weapon: "woodSword" });
    expect(bandFor(7)).toEqual({ material: "leather", weapon: "woodSword" });
    expect(bandFor(8)).toEqual({ material: "mail", weapon: "sword" });
    expect(bandFor(14)).toEqual({ material: "mail", weapon: "sword" });
    expect(bandFor(15)).toEqual({ material: "plate", weapon: "diamondSword" });
    expect(bandFor(20)).toEqual({ material: "plate", weapon: "diamondSword" });
    expect(bandFor(25)).toEqual({ material: "plate", weapon: "diamondSword" });
  });
});

describe("rollMonsterDrop (034 C5)", () => {
  const N = 20000;
  const run = (floor: number, elite: boolean, seed: number) => {
    const rng = seeded(seed);
    return Array.from({ length: N }, () => rollMonsterDrop(floor, elite, rng));
  };
  const share = (drops: ReturnType<typeof run>, pick: (d: (typeof drops)[number]) => boolean) =>
    drops.filter(pick).length / drops.length;

  it("regular monsters: ~20% gear, ~20% nothing, ~60% gold", () => {
    const drops = run(3, false, 7);
    expect(share(drops, (d) => !!d.gear)).toBeGreaterThan(0.17);
    expect(share(drops, (d) => !!d.gear)).toBeLessThan(0.23);
    expect(share(drops, (d) => !d.gear && !d.currency)).toBeGreaterThan(0.17);
    expect(share(drops, (d) => !d.gear && !d.currency)).toBeLessThan(0.23);
    expect(share(drops, (d) => !!d.currency)).toBeGreaterThan(0.56);
    expect(share(drops, (d) => !!d.currency)).toBeLessThan(0.64);
  });

  it("elite monsters: ~50% gear, the rest gold, never nothing", () => {
    const drops = run(3, true, 8);
    expect(share(drops, (d) => !!d.gear)).toBeGreaterThan(0.46);
    expect(share(drops, (d) => !!d.gear)).toBeLessThan(0.54);
    expect(drops.every((d) => !!d.gear || !!d.currency)).toBe(true);
  });

  it("grades follow 10:5:3:2:1 for regular and elite alike", () => {
    for (const elite of [false, true]) {
      const gear = run(3, elite, elite ? 11 : 12).flatMap((d) => (d.gear ? [d.gear] : []));
      const expected = [10 / 21, 5 / 21, 3 / 21, 2 / 21, 1 / 21];
      GRADE_ORDER.forEach((grade, i) => {
        const seen = gear.filter((g) => g.grade === grade).length / gear.length;
        expect(Math.abs(seen - expected[i]!)).toBeLessThan(0.03);
      });
    }
  });

  it("only drops the floor band's tier, whatever the grade, and covers all five slot types", () => {
    const bands: [number, string, string][] = [
      [3, "leather", "woodSword"],
      [7, "leather", "woodSword"],
      [10, "mail", "sword"],
      [14, "mail", "sword"],
      [17, "plate", "diamondSword"],
      [20, "plate", "diamondSword"],
    ];
    for (const [floor, material, weapon] of bands) {
      const keys = new Set<string>();
      for (const d of run(floor, true, floor)) if (d.gear) keys.add(d.gear.key);
      expect([...keys].sort()).toEqual(
        [weapon, ...["helm", "chest", "legs", "boots"].map((s) => `${material}:${s}`)].sort(),
      );
    }
  });

  it("gold is a whole number in range with the intended mean", () => {
    const regular = run(3, false, 21).flatMap((d) => (d.currency ? [d.currency] : []));
    const elite = run(3, true, 22).flatMap((d) => (d.currency ? [d.currency] : []));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(regular.every((g) => Number.isInteger(g) && g >= 1 && g <= 10)).toBe(true);
    expect(mean(regular)).toBeGreaterThan(3.5);
    expect(mean(regular)).toBeLessThan(5);
    expect(elite.every((g) => Number.isInteger(g) && g >= 10 && g <= 30)).toBe(true);
    expect(mean(elite)).toBeGreaterThan(19);
    expect(mean(elite)).toBeLessThan(21);
  });

  it("rollGold re-rolls out-of-range values instead of clamping", () => {
    const rng = seeded(3);
    const values = Array.from({ length: 5000 }, () => rollGold(3, 3, 1, 10, rng));
    expect(Math.min(...values)).toBe(1);
    // clamping would pile roughly 16% of rolls on 1; re-rolling leaves 1 near its natural share
    expect(values.filter((v) => v === 1).length / values.length).toBeLessThan(0.16);
  });
});

describe("eliteStats (034 C8)", () => {
  const stats = { hp: 11, damage: 5, defence: 3 };
  it("leaves a non-elite alone, including an unflagged end boss", () => {
    expect(eliteStats({ stats })).toBe(stats);
    expect(eliteStats({ stats, isElite: false })).toBe(stats);
  });
  it("multiplies HP, damage and defence by 1.5, rounded up", () => {
    expect(eliteStats({ stats, isElite: true })).toEqual({ hp: 17, damage: 8, defence: 5 });
  });
});

describe("rollGold with a stuck random source", () => {
  it("terminates and returns an in-range value", () => {
    expect(rollGold(3, 3, 1, 10, () => 0.5)).toBe(3);
    const elite = rollGold(20, 5, 10, 30, () => 0.5);
    expect(elite).toBeGreaterThanOrEqual(10);
    expect(elite).toBeLessThanOrEqual(30);
  });
});
