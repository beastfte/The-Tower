import { describe, expect, it } from "vitest";
import { advanceBattle, startBattle, type CombatantStats } from "../../../src/domain/combat/battle";
import { formatSurvival, survivalChance, threatTier } from "../../../src/domain/combat/survival";

/** Local fixtures only — never the live tower (Constitution IV). */
const fighter = (overrides: Partial<CombatantStats> = {}): CombatantStats => ({
  hp: 100,
  attack: 10,
  defence: 0,
  attackIntervalSec: 1,
  critChance: 0,
  critDamageBonus: 0,
  dodgeChance: 0,
  ...overrides,
});

/** mulberry32 — a tiny seeded generator so the simulation is deterministic. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Win rate of real `advanceBattle` fights (0.25s steps; every interval below is a multiple of it). */
function simulate(player: CombatantStats, monster: CombatantStats, maxHp: number, potions: number, fights = 10_000): number {
  const rng = seeded(1234);
  let wins = 0;
  for (let i = 0; i < fights; i++) {
    let state = startBattle(player, monster, maxHp, potions);
    while (state.outcome === "ongoing") state = advanceBattle(state, 0.25, rng).state;
    if (state.outcome === "victory") wins++;
  }
  return wins / fights;
}

const matchups = {
  easy: {
    player: fighter({ hp: 100, attack: 12, critChance: 0.1, dodgeChance: 0.05 }),
    monster: fighter({ hp: 40, attack: 6, attackIntervalSec: 1.5, critChance: 0.05, dodgeChance: 0.1 }),
    potions: 0,
  },
  close: {
    player: fighter({ hp: 60, attack: 9, critChance: 0.2, critDamageBonus: 0.3, dodgeChance: 0.1 }),
    monster: fighter({ hp: 70, attack: 11, attackIntervalSec: 1.25, critChance: 0.1, dodgeChance: 0.15, defence: 2 }),
    potions: 0,
  },
  closeWithPotions: {
    player: fighter({ hp: 60, attack: 9, critChance: 0.2, critDamageBonus: 0.3, dodgeChance: 0.1 }),
    monster: fighter({ hp: 70, attack: 11, attackIntervalSec: 1.25, critChance: 0.1, dodgeChance: 0.15, defence: 2 }),
    potions: 3,
  },
  hopeless: {
    player: fighter({ hp: 30, attack: 3, attackIntervalSec: 1.5 }),
    monster: fighter({ hp: 200, attack: 20, attackIntervalSec: 0.5, critChance: 0.2, dodgeChance: 0.2 }),
    potions: 0,
  },
};

describe("survivalChance (038 C5)", () => {
  it.each(Object.entries(matchups))("%s: within 2 points of 10,000 real fights", (_name, m) => {
    const maxHp = m.player.hp;
    const { win } = survivalChance(m.player, m.monster, maxHp, m.potions);
    const observed = simulate(m.player, m.monster, maxHp, m.potions);
    expect(Math.abs(win - observed)).toBeLessThan(0.02);
  });

  it("gives the identical answer every time for the same state", () => {
    const m = matchups.close;
    const first = survivalChance(m.player, m.monster, 60, 2);
    for (let i = 0; i < 5; i++) expect(survivalChance({ ...m.player }, { ...m.monster }, 60, 2)).toEqual(first);
  });

  it("never lowers the win chance when a potion is added, and turns a likely loss around", () => {
    const m = matchups.close;
    const wins = [0, 1, 2, 3, 4].map((n) => survivalChance(m.player, m.monster, 60, n).win);
    for (let i = 1; i < wins.length; i++) expect(wins[i]!).toBeGreaterThanOrEqual(wins[i - 1]!);
    expect(wins[3]!).toBeGreaterThan(wins[0]! + 0.05);
  });

  it("awards a tie to the player: equal speed, one-hit kills on both sides", () => {
    const one = fighter({ hp: 10, attack: 10 });
    expect(survivalChance(one, { ...one }, 10, 0)).toEqual({ win: 1, lose: 0 });
  });

  it("is certain loss when the player cannot hurt the monster", () => {
    const { win, lose } = survivalChance(fighter({ attack: 0 }), fighter({ hp: 50, attack: 10 }), 100, 0);
    expect(win).toBe(0);
    expect(lose).toBeGreaterThan(0.999);
  });
});

describe("formatSurvival (FR-013a)", () => {
  it("shows 100% and 0% only when certain", () => {
    expect(formatSurvival({ win: 1, lose: 0 })).toBe("100%");
    expect(formatSurvival({ win: 0, lose: 1 })).toBe("0%");
  });

  it("shows >99% and <1% when merely very likely or unlikely", () => {
    expect(formatSurvival({ win: 0.9997, lose: 0.0003 })).toBe(">99%");
    expect(formatSurvival({ win: 0.002, lose: 0.998 })).toBe("<1%");
  });

  it("rounds everything else to a whole percent", () => {
    expect(formatSurvival({ win: 0.5, lose: 0.5 })).toBe("50%");
    expect(formatSurvival({ win: 0.874, lose: 0.126 })).toBe("87%");
  });
});

describe("threatTier (041 C1)", () => {
  const tier = (win: number) => threatTier({ win, lose: 1 - win });

  it("is Trivial for a certain win, >99% and 99%", () => {
    expect(threatTier({ win: 1, lose: 0 })).toBe("Trivial");
    expect(tier(0.9997)).toBe("Trivial");
    expect(tier(0.99)).toBe("Trivial");
  });

  it("judges the displayed percentage: a true 98.6% shows 99% and is Trivial", () => {
    expect(tier(0.986)).toBe("Trivial");
  });

  it("puts each boundary in the safer band", () => {
    expect(tier(0.98)).toBe("Safe");
    expect(tier(0.9)).toBe("Safe");
    expect(tier(0.89)).toBe("Risky");
    expect(tier(0.6)).toBe("Risky");
    expect(tier(0.59)).toBe("Dangerous");
    expect(tier(0.25)).toBe("Dangerous");
    expect(tier(0.24)).toBe("Deadly");
  });

  it("is Deadly for <1% and a certain loss", () => {
    expect(tier(0.002)).toBe("Deadly");
    expect(threatTier({ win: 0, lose: 1 })).toBe("Deadly");
  });
});
