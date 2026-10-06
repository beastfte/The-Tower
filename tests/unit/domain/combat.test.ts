import { describe, expect, it } from "vitest";
import { resolveAttack, resolveHit } from "../../../src/domain/combat/resolveAttack";

const attacker = (attack: number, attackIntervalSec: number, critDamageBonus = 0) => ({
  attack,
  attackIntervalSec,
  critDamageBonus,
});

/** 027 contract C4: every hit deals the agreed formula, rounded up last. */
describe("resolveHit (027 C4)", () => {
  it.each([
    { atk: 20, def: 5, interval: 2.0, crit: false, bonus: 0, hit: 10, note: "slow attacker" },
    { atk: 5, def: 5, interval: 0.5, crit: false, bonus: 0, hit: 3, note: "fast attacker, 2.5 rounds up" },
    { atk: 10, def: 4, interval: 1.0, crit: false, bonus: 0, hit: 6, note: "1s = pre-revamp max(0, ATK-DEF)" },
    { atk: 10, def: 4, interval: 1.0, crit: true, bonus: 0, hit: 9, note: "crit: ceil(6 x 1.5)" },
    { atk: 10, def: 4, interval: 1.0, crit: true, bonus: 0.25, hit: 11, note: "bonus is additive: ceil(6 x 1.75)" },
    { atk: 10, def: 5, interval: 0.6, crit: false, bonus: 0, hit: 7, note: "float guard: 10 - 5x0.6 is not 8" },
    { atk: 3, def: 5, interval: 1.0, crit: true, bonus: 0, hit: 0, note: "crit on 0 stays 0" },
  ])("$note → $hit", ({ atk, def, interval, crit, bonus, hit }) => {
    expect(resolveHit(attacker(atk, interval, bonus), { defence: def }, crit)).toBe(hit);
  });

  it("never returns a negative number, even when defence dwarfs attack", () => {
    expect(resolveHit(attacker(1, 2), { defence: 100 }, false)).toBe(0);
    expect(Object.is(resolveHit(attacker(1, 2), { defence: 100 }, true), -0)).toBe(false);
  });

  it("multiplies the crit after defence, not before", () => {
    // (12 - 2x2) x 1.5 = 12, whereas (12 x 1.5) - 4 would be 14.
    expect(resolveHit(attacker(12, 2), { defence: 2 }, true)).toBe(12);
  });
});

/** Trap/hazard damage is out of scope for 027 and keeps the flat rule. */
describe("resolveAttack (hazards only)", () => {
  it("deals damage minus defence", () => {
    expect(resolveAttack({ damage: 10, defence: 3, hp: 1 }, { damage: 0, defence: 4, hp: 1 })).toBe(6);
  });

  it("never deals negative damage", () => {
    expect(resolveAttack({ damage: 2, defence: 0, hp: 1 }, { damage: 0, defence: 10, hp: 1 })).toBe(0);
  });
});
