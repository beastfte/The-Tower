import { describe, expect, it } from "vitest";
import { MONSTER_SPECIES } from "../../../src/data/monsterSpecies";

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
