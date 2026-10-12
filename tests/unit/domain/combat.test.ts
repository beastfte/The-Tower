import { describe, expect, it } from "vitest";
import { DEFENCE_K, formatDamage, resolveAttack, resolveHit } from "../../../src/domain/combat/resolveAttack";

const attacker = (attack: number, attackIntervalSec: number, critDamageBonus = 0) => ({
  attack,
  attackIntervalSec,
  critDamageBonus,
});

/** 038: a hit lands at K / (K + defence) of its size, then crit multiplies; no rounding. */
describe("resolveHit (038)", () => {
  it.each([
    { atk: 12, def: 0, crit: false, bonus: 0, hit: 12, note: "no defence: the full hit" },
    { atk: 12, def: 10, crit: false, bonus: 0, hit: 6, note: "defence = K halves it" },
    { atk: 12, def: 30, crit: false, bonus: 0, hit: 3, note: "defence = 3K quarters it" },
    { atk: 1.5, def: 5, crit: false, bonus: 0, hit: 1, note: "fractional, not rounded" },
    { atk: 12, def: 10, crit: true, bonus: 0, hit: 9, note: "crit after defence: 6 x 1.5" },
    { atk: 12, def: 10, crit: true, bonus: 0.25, hit: 10.5, note: "bonus is additive: 6 x 1.75" },
  ])("$note → $hit", ({ atk, def, crit, bonus, hit }) => {
    expect(resolveHit(attacker(atk, 1, bonus), { defence: def }, crit)).toBeCloseTo(hit, 10);
  });

  it("never reaches 0 however high defence goes, and never goes negative", () => {
    expect(resolveHit(attacker(1, 2), { defence: 1000 }, false)).toBeGreaterThan(0);
    expect(resolveHit(attacker(-5, 1), { defence: 0 }, true)).toBe(0);
  });

  it("each extra point of defence helps, but less than the one before", () => {
    const taken = (def: number) => resolveHit(attacker(10, 1), { defence: def }, false);
    for (let d = 0; d < 30; d++) {
      expect(taken(d + 1)).toBeLessThan(taken(d));
      expect(taken(d) - taken(d + 1)).toBeGreaterThan(taken(d + 1) - taken(d + 2));
    }
  });

  it("does not depend on attack speed, so equal raw DPS stays equal DPS", () => {
    const slow = resolveHit(attacker(20, 2), { defence: 5 }, false) / 2;
    const fast = resolveHit(attacker(5, 0.5), { defence: 5 }, false) / 0.5;
    expect(slow).toBeCloseTo(fast, 10);
  });

  it("uses K = 10", () => {
    expect(DEFENCE_K).toBe(10);
  });
});

describe("resolveAttack (hazards)", () => {
  it("uses the same diminishing defence as combat", () => {
    expect(resolveAttack({ damage: 8, defence: 3, hp: 1 }, { damage: 0, defence: 10, hp: 1 })).toBe(4);
  });

  it("never deals negative damage", () => {
    expect(resolveAttack({ damage: -2, defence: 0, hp: 1 }, { damage: 0, defence: 10, hp: 1 })).toBe(0);
  });
});

describe("formatDamage", () => {
  it.each([
    [6, "6"],
    [1.36, "1.4"],
    [0.04, "0"],
    [10.5, "10.5"],
  ])("%d → %s", (d, s) => {
    expect(formatDamage(d)).toBe(s);
  });
});
