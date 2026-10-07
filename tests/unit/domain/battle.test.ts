import { describe, expect, it } from "vitest";
import {
  advanceBattle,
  drinkPotion,
  flee,
  startBattle,
  type BattleEvent,
  type BattleState,
  type CombatantStats,
} from "../../../src/domain/combat/battle";

/** Local fixtures only — never the live tower (project rule). */
const fighter = (overrides: Partial<CombatantStats> = {}): CombatantStats => ({
  hp: 1_000_000,
  attack: 1,
  defence: 0,
  attackIntervalSec: 1,
  critChance: 0,
  critDamageBonus: 0,
  dodgeChance: 0,
  ...overrides,
});

const never = () => 1; // rng() < critChance is always false
const always = () => 0; // rng() < critChance is true for any critChance > 0

/** mulberry32 — a tiny seeded generator so the crit-rate test is deterministic. */
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

function run(state: BattleState, steps: number, dt: number, rng: () => number = never) {
  const events: BattleEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const step = advanceBattle(state, dt, rng);
    state = step.state;
    events.push(...step.events);
  }
  return { state, events };
}

const hitsOn = (events: BattleEvent[], target: "player" | "monster") =>
  events.filter((e) => e.kind === "hit" && e.target === target);

describe("startBattle", () => {
  it("starts both attack bars empty and the battle ongoing (FR-006, C2)", () => {
    const state = startBattle(fighter(), fighter(), 30, 2);
    expect(state.player.charge).toBe(0);
    expect(state.monster.charge).toBe(0);
    expect(state.outcome).toBe("ongoing");
    expect(state.potionCount).toBe(2);
    expect(state.playerMaxHp).toBe(30);
  });
});

describe("advanceBattle timing (C2, C3)", () => {
  it("runs each side on its own clock: a 0.6s attacker gets 5 hits to a 1.0s attacker's 3", () => {
    // 31 steps of 0.1s = 3.1s, safely past the 3.0s boundary both sides share.
    const state = startBattle(fighter({ attackIntervalSec: 1 }), fighter({ attackIntervalSec: 0.6 }), 1e6, 0);
    const { events } = run(state, 31, 0.1);
    expect(hitsOn(events, "monster")).toHaveLength(3); // player's attacks
    expect(hitsOn(events, "player")).toHaveLength(5); // monster's attacks
  });

  it("resolves a same-instant tie player-first (FR-007)", () => {
    const state = startBattle(fighter(), fighter(), 1e6, 0);
    const { events } = advanceBattle(state, 1, never);
    expect(events.map((e) => e.kind === "hit" && e.target)).toEqual(["monster", "player"]);
  });

  it("lands nothing after 0 HP, even an attack due on the same frame (FR-009)", () => {
    const state = startBattle(fighter({ attack: 5 }), fighter({ hp: 5, attack: 5 }), 1e6, 0);
    const step = advanceBattle(state, 1, never);
    expect(step.events).toHaveLength(1);
    expect(step.state.outcome).toBe("victory");
    expect(step.state.player.hp).toBe(1e6);
  });

  it("ends in defeat when the player reaches 0, and clamps HP at 0 (FR-013)", () => {
    const state = startBattle(fighter({ hp: 3, attackIntervalSec: 5 }), fighter({ attack: 50 }), 3, 0);
    const step = advanceBattle(state, 1, never);
    expect(step.state.outcome).toBe("defeat");
    expect(step.state.player.hp).toBe(0);
  });

  it("ignores further time once the battle has ended", () => {
    const state = startBattle(fighter({ attack: 5 }), fighter({ hp: 5 }), 1e6, 0);
    const ended = advanceBattle(state, 1, never).state;
    const after = advanceBattle(ended, 10, never);
    expect(after.events).toHaveLength(0);
    expect(after.state).toBe(ended);
  });

  it("lands every due hit from one large step, in the order they fell due", () => {
    // Player every 1.0s, monster every 0.6s, one 2.5s step. Due times: m0.6 p1.0 m1.2 m1.8 p2.0 m2.4.
    const state = startBattle(fighter({ attackIntervalSec: 1 }), fighter({ attackIntervalSec: 0.6 }), 1e6, 0);
    const { events } = advanceBattle(state, 2.5, never);
    const targets = events.map((e) => (e.kind === "hit" ? e.target : "heal"));
    expect(targets).toEqual(["player", "monster", "player", "player", "monster", "player"]);
  });

  it("carries overshoot, so 100 seconds at 60fps lands 100 one-second hits (±1 frame)", () => {
    const state = startBattle(fighter(), fighter({ attackIntervalSec: 1e6 }), 1e6, 0);
    const { events } = run(state, 6000, 1 / 60);
    const n = hitsOn(events, "monster").length;
    expect(n).toBeGreaterThanOrEqual(99);
    expect(n).toBeLessThanOrEqual(100);
  });

  it("lands every attack within 100ms of its bar filling at 16ms frames (SC-008)", () => {
    const interval = 0.7;
    let state = startBattle(fighter({ attackIntervalSec: interval }), fighter({ attackIntervalSec: 1e6 }), 1e6, 0);
    let t = 0;
    let k = 0;
    for (let i = 0; i < 1250; i++) {
      t += 0.016;
      const step = advanceBattle(state, 0.016, never);
      state = step.state;
      for (const e of step.events) {
        if (e.kind !== "hit" || e.target !== "monster") continue;
        k += 1;
        const lag = t - k * interval;
        expect(lag).toBeGreaterThanOrEqual(-1e-9);
        expect(lag).toBeLessThanOrEqual(0.1);
      }
    }
    expect(k).toBeGreaterThan(25);
  });
});

describe("advanceBattle crits (C5)", () => {
  it("lands 900-1,100 crits in 10,000 attacks at a 10% chance", () => {
    const state = startBattle(fighter({ critChance: 0.1 }), fighter({ attackIntervalSec: 1e9 }), 1e6, 0);
    const { events } = advanceBattle(state, 10_000, seeded(27));
    const hits = hitsOn(events, "monster");
    expect(hits).toHaveLength(10_000);
    const crits = hits.filter((e) => e.kind === "hit" && e.isCrit).length;
    expect(crits).toBeGreaterThanOrEqual(900);
    expect(crits).toBeLessThanOrEqual(1100);
  });

  it("never crits at 0% and always crits at 100%", () => {
    const zero = advanceBattle(startBattle(fighter({ critChance: 0 }), fighter({ attackIntervalSec: 1e9 }), 1e6, 0), 50, always);
    expect(hitsOn(zero.events, "monster").every((e) => e.kind === "hit" && !e.isCrit)).toBe(true);
    const one = advanceBattle(startBattle(fighter({ critChance: 1 }), fighter({ attackIntervalSec: 1e9 }), 1e6, 0), 50, () => 0.999);
    expect(hitsOn(one.events, "monster").every((e) => e.kind === "hit" && e.isCrit)).toBe(true);
  });

  it("applies the crit multiplier to the damage dealt", () => {
    const state = startBattle(fighter({ attack: 10, critChance: 1 }), fighter({ defence: 4, attackIntervalSec: 1e9 }), 1e6, 0);
    const { events } = advanceBattle(state, 1, () => 0.999);
    expect(events[0]).toEqual({ kind: "hit", target: "monster", damage: 9, isCrit: true });
  });
});

/** 027 US5 (SC-002, SC-003): defence removes damage per second, not damage per hit. */
describe("defence normalises damage per second across attack speeds (US5)", () => {
  /** Damage per second a fixed-defence target takes from one attacker over 100 simulated seconds. */
  function dps(attack: number, attackIntervalSec: number, defence: number): number {
    const state = startBattle(
      fighter({ attack, attackIntervalSec }),
      fighter({ defence, attackIntervalSec: 1e9 }),
      1e6,
      0,
    );
    const { events } = run(state, 200, 0.5);
    const total = hitsOn(events, "monster").reduce((sum, e) => sum + (e.kind === "hit" ? e.damage : 0), 0);
    return total / 100;
  }

  it.each([0, 1, 3, 5, 9])("DEF %i: a slow and a fast attacker with equal raw DPS lose exactly DEF each (SC-003)", (def) => {
    // 20 per 2s and 10 per 1s are both 10 raw DPS; DEF × interval is a whole number, so no rounding.
    expect(dps(20, 2, def)).toBe(10 - def);
    expect(dps(10, 1, def)).toBe(10 - def);
  });

  it("each extra point of defence lowers DPS by exactly 1, whatever the speed, until it reaches 0", () => {
    for (let def = 0; def < 10; def++) {
      expect(dps(20, 2, def) - dps(20, 2, def + 1)).toBe(1);
      expect(dps(10, 1, def) - dps(10, 1, def + 1)).toBe(1);
    }
    expect(dps(20, 2, 12)).toBe(0);
  });

  it.each([0, 1, 2, 3])("DEF %i: a fast attacker's DPS exceeds the ideal only by per-hit rounding (SC-002)", (def) => {
    // 5 per 0.5s is also 10 raw DPS. Rounding each hit up adds under 1 point per hit, i.e. < 2 DPS.
    const ideal = 10 - def;
    const fast = dps(5, 0.5, def);
    expect(fast).toBeGreaterThanOrEqual(ideal);
    expect(fast).toBeLessThan(ideal + 1 / 0.5);
    expect(dps(20, 2, def)).toBe(ideal);
  });
});

/** 027 US3 (C5, FR-015, FR-017): each side crits with its own chance and bonus only. */
describe("crit parity between player and monster (US3)", () => {
  it("a monster at 100% crit always crits while a player at 0% never does, and vice versa", () => {
    const rng = () => 0.5;
    const monsterCrits = advanceBattle(
      startBattle(fighter({ critChance: 0 }), fighter({ critChance: 1 }), 1e6, 0),
      20,
      rng,
    ).events;
    expect(hitsOn(monsterCrits, "player").every((e) => e.kind === "hit" && e.isCrit)).toBe(true);
    expect(hitsOn(monsterCrits, "monster").every((e) => e.kind === "hit" && !e.isCrit)).toBe(true);

    const playerCrits = advanceBattle(
      startBattle(fighter({ critChance: 1 }), fighter({ critChance: 0 }), 1e6, 0),
      20,
      rng,
    ).events;
    expect(hitsOn(playerCrits, "monster").every((e) => e.kind === "hit" && e.isCrit)).toBe(true);
    expect(hitsOn(playerCrits, "player").every((e) => e.kind === "hit" && !e.isCrit)).toBe(true);
  });

  it("each side's crit damage uses its own bonus", () => {
    const events = advanceBattle(
      startBattle(
        fighter({ attack: 10, critChance: 1, critDamageBonus: 0 }),
        fighter({ attack: 10, critChance: 1, critDamageBonus: 0.5 }),
        1e6,
        0,
      ),
      1,
      () => 0.5,
    ).events;
    expect(events).toEqual([
      { kind: "hit", target: "monster", damage: 15, isCrit: true }, // 10 × 1.5
      { kind: "hit", target: "player", damage: 20, isCrit: true }, // 10 × 2.0
    ]);
  });
});

/** 027 US4 (C13). */
describe("flee", () => {
  it("ends the battle as fled, keeping HP as it stood", () => {
    let state = startBattle(fighter({ hp: 30 }), fighter({ attack: 4 }), 30, 0);
    state = advanceBattle(state, 1.5, never).state; // player took one hit
    const fled = flee(state);
    expect(fled.outcome).toBe("fled");
    expect(fled.player.hp).toBe(state.player.hp);
    expect(fled.player.hp).toBeLessThan(30);
  });

  it("lands nothing afterwards", () => {
    const fled = flee(startBattle(fighter(), fighter(), 30, 0));
    expect(advanceBattle(fled, 10, never).events).toHaveLength(0);
  });

  it("is ignored once the battle has already ended", () => {
    const won = advanceBattle(startBattle(fighter({ attack: 5 }), fighter({ hp: 5 }), 30, 0), 1, never).state;
    expect(flee(won)).toBe(won);
    expect(flee(won).outcome).toBe("victory");
  });
});

/** 027 US6 (C17). */
describe("drinkPotion", () => {
  const atHp = (hp: number, maxHp: number, potions: number) => startBattle(fighter({ hp }), fighter(), maxHp, potions);

  it.each([
    { max: 40, hp: 20, healedTo: 30, note: "25% of 40 = 10" },
    { max: 42, hp: 20, healedTo: 31, note: "25% of 42 = 10.5, rounds up to 11" },
    { max: 40, hp: 35, healedTo: 40, note: "capped at max" },
  ])("$note → $healedTo", ({ max, hp, healedTo }) => {
    const step = drinkPotion(atHp(hp, max, 2));
    expect(step.state.player.hp).toBe(healedTo);
    expect(step.state.potionCount).toBe(1);
    expect(step.events).toEqual([{ kind: "heal", amount: healedTo - hp }]);
  });

  it.each([
    { why: "no potions", state: () => atHp(20, 40, 0) },
    { why: "full HP", state: () => atHp(40, 40, 3) },
    {
      why: "the battle has ended",
      state: () => flee(atHp(20, 40, 3)),
    },
  ])("refuses with $why — same state, no event", ({ state }) => {
    const before = state();
    const step = drinkPotion(before);
    expect(step.state).toBe(before);
    expect(step.events).toHaveLength(0);
  });

  it("leaves both attack bars exactly where they were (FR-049)", () => {
    let state = startBattle(fighter({ hp: 10 }), fighter({ attackIntervalSec: 2 }), 40, 1);
    state = advanceBattle(state, 0.7, never).state;
    const after = drinkPotion(state).state;
    expect(after.player.charge).toBe(state.player.charge);
    expect(after.monster.charge).toBe(state.monster.charge);
  });
});

/** 032 C1: dodge is decided before crit and removes the attack entirely. */
describe("dodge (032)", () => {
  const dodges = (events: BattleEvent[]) => events.filter((e) => e.kind === "dodge");

  it("a dodged attack emits a dodge, deals no damage and never crits", () => {
    const state = startBattle(fighter({ attack: 5, critChance: 1 }), fighter({ hp: 10, dodgeChance: 1, attackIntervalSec: 1e9 }), 100, 0);
    const { state: after, events } = advanceBattle(state, 1, always);
    expect(events).toEqual([{ kind: "dodge", target: "monster" }]);
    expect(after.monster.hp).toBe(10);
  });

  it("a dodge on a would-be lethal attack leaves the battle ongoing", () => {
    const state = startBattle(fighter({ attack: 99 }), fighter({ hp: 1, dodgeChance: 1, attackIntervalSec: 1e9 }), 100, 0);
    expect(advanceBattle(state, 1, always).state.outcome).toBe("ongoing");
  });

  it("a monster attack can be dodged by the player", () => {
    const state = startBattle(fighter({ attackIntervalSec: 100, dodgeChance: 1 }), fighter({ attack: 5 }), 100, 0);
    const { events } = advanceBattle(state, 1, always);
    expect(events).toEqual([{ kind: "dodge", target: "player" }]);
  });

  it("dodgeChance 0 never dodges, even with an rng of 0", () => {
    const state = startBattle(fighter({ attack: 2 }), fighter({ hp: 10, attackIntervalSec: 1e9 }), 100, 0);
    expect(advanceBattle(state, 1, always).events).toEqual([
      { kind: "hit", target: "monster", damage: 2, isCrit: false },
    ]);
  });

  it("the observed dodge rate is within 3 points of the chance over 1000 attacks (SC-001)", () => {
    const state = startBattle(fighter({ attackIntervalSec: 0.01 }), fighter({ dodgeChance: 0.2, attackIntervalSec: 1e9 }), 1, 0);
    const { events } = run(state, 1000, 0.01, seeded(7));
    expect(dodges(events).length / 1000).toBeGreaterThan(0.17);
    expect(dodges(events).length / 1000).toBeLessThan(0.23);
  });
});
