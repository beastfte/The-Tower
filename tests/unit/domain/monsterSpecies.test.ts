import { describe, expect, it } from "vitest";
import { MONSTER_SPECIES } from "../../../src/data/monsterSpecies";

/** 014 contract invariant 22: a "large" monster's spriteScale reads ~0.85-0.95, a
 * "small/medium" one's ~0.75-0.85 — guards against a future edit silently drifting out of
 * either band. Only `ogre` is "large" today; every other species is "small/medium". */
describe("MONSTER_SPECIES spriteScale bounds (014 contract invariant 22)", () => {
  const LARGE_SPECIES = new Set(["ogre"]);

  it.each(Object.values(MONSTER_SPECIES))("$id's spriteScale falls within its size band", (species) => {
    if (LARGE_SPECIES.has(species.id)) {
      expect(species.spriteScale).toBeGreaterThanOrEqual(0.85);
      expect(species.spriteScale).toBeLessThanOrEqual(0.95);
    } else {
      expect(species.spriteScale).toBeGreaterThanOrEqual(0.75);
      expect(species.spriteScale).toBeLessThanOrEqual(0.85);
    }
  });
});
