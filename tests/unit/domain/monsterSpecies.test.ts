import { describe, expect, it } from "vitest";
import { MONSTER_SPECIES } from "../../../src/data/monsterSpecies";
import { monsterCombatant } from "../../../src/domain/combat/battle";

/** 027 data-model: species combat fields stay in range (the catalog is code, not tower content). */
describe("MONSTER_SPECIES live-battle stats (027)", () => {
  it.each(Object.values(MONSTER_SPECIES))("$id has a positive interval and a 0-1 crit chance", (species) => {
    expect(species.attackIntervalSec).toBeGreaterThan(0);
    expect(species.critChance).toBeGreaterThanOrEqual(0);
    expect(species.critChance).toBeLessThanOrEqual(1);
    expect(species.critDamageBonus).toBeGreaterThanOrEqual(0);
  });

  it("varies attack speed across species: some faster than 1s, some slower, some at 1s (FR-032)", () => {
    const intervals = Object.values(MONSTER_SPECIES).map((s) => s.attackIntervalSec);
    expect(intervals.some((i) => i < 1)).toBe(true);
    expect(intervals.some((i) => i > 1)).toBe(true);
    expect(intervals.some((i) => i === 1)).toBe(true);
  });

  it("falls back to 1s / 5% / 0 for an unknown species, attacking at its authored damage (FR-031)", () => {
    const c = monsterCombatant({ damage: 7, defence: 2, hp: 20 }, undefined);
    expect(c).toEqual({ hp: 20, attack: 7, defence: 2, attackIntervalSec: 1, critChance: 0.05, critDamageBonus: 0 });
  });
});

/** 014 contract invariant 22, restored to three tiers (020 research R3): a "large" monster's
 * spriteScale reads ~0.85-0.95, a "medium" (human-scale) one ~0.75-0.85, and a "small" one
 * ~0.5-0.65 — guards against a future edit silently drifting out of its band. `ogre` is the
 * only "large" species; `bat` and `slime` are "small"; every other species is "medium". */
describe("MONSTER_SPECIES spriteScale bounds (014 contract invariant 22)", () => {
  const LARGE_SPECIES = new Set(["ogre"]);
  const SMALL_SPECIES = new Set(["bat", "slime"]);

  it.each(Object.values(MONSTER_SPECIES))("$id's spriteScale falls within its size band", (species) => {
    if (LARGE_SPECIES.has(species.id)) {
      expect(species.spriteScale).toBeGreaterThanOrEqual(0.85);
      expect(species.spriteScale).toBeLessThanOrEqual(0.95);
    } else if (SMALL_SPECIES.has(species.id)) {
      expect(species.spriteScale).toBeGreaterThanOrEqual(0.5);
      expect(species.spriteScale).toBeLessThanOrEqual(0.65);
    } else {
      expect(species.spriteScale).toBeGreaterThanOrEqual(0.75);
      expect(species.spriteScale).toBeLessThanOrEqual(0.85);
    }
  });
});
