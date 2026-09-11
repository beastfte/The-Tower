import type { MonsterSpecies, MonsterSpeciesId } from "../domain/floor/types";

/** Static reference data (research.md #4): identity/appearance/typical profile per species.
 * Per-instance `stats` on each EnemyDefinition placement stays hand-authored independently. */
export const MONSTER_SPECIES: Record<MonsterSpeciesId, MonsterSpecies> = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    baselineStats: { damage: 4, defence: 1, hp: 12 },
    textureKey: "goblin",
  },
  ogre: {
    id: "ogre",
    name: "Ogre",
    baselineStats: { damage: 6, defence: 4, hp: 30 },
    textureKey: "ogre",
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    baselineStats: { damage: 8, defence: 0, hp: 10 },
    textureKey: "wizard",
  },
};
