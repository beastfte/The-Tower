import type { MonsterSpecies, MonsterSpeciesId } from "../domain/floor/types";

/** Static reference data (research.md #4): identity/appearance/typical profile per species.
 * Per-instance `stats` on each EnemyDefinition placement stays hand-authored independently. */
export const MONSTER_SPECIES: Record<MonsterSpeciesId, MonsterSpecies> = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    baselineStats: { damage: 4, defence: 1, hp: 12 },
    textureKey: "goblin",
    spriteScale: 0.8,
  },
  ogre: {
    id: "ogre",
    name: "Ogre",
    baselineStats: { damage: 6, defence: 4, hp: 30 },
    textureKey: "ogre",
    spriteScale: 0.9,
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    baselineStats: { damage: 8, defence: 0, hp: 10 },
    textureKey: "wizard",
    spriteScale: 0.8,
  },
  // 020: six additional species. baselineStats below are explicit placeholders (spec FR-004),
  // not balance-tested — refining them is expected to happen later via the tower design tool.
  bat: {
    id: "bat",
    name: "Bat",
    baselineStats: { damage: 3, defence: 0, hp: 6 },
    textureKey: "bat",
    spriteScale: 0.55,
  },
  slime: {
    id: "slime",
    name: "Slime",
    baselineStats: { damage: 2, defence: 2, hp: 14 },
    textureKey: "slime",
    spriteScale: 0.6,
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton Soldier",
    baselineStats: { damage: 5, defence: 2, hp: 16 },
    textureKey: "skeleton",
    spriteScale: 0.8,
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    baselineStats: { damage: 7, defence: 1, hp: 12 },
    textureKey: "necromancer",
    spriteScale: 0.8,
  },
  bandit: {
    id: "bandit",
    name: "Bandit",
    baselineStats: { damage: 6, defence: 2, hp: 14 },
    textureKey: "bandit",
    spriteScale: 0.8,
  },
  voidwalker: {
    id: "voidwalker",
    name: "Voidwalker",
    baselineStats: { damage: 9, defence: 3, hp: 20 },
    textureKey: "voidwalker",
    spriteScale: 0.8,
  },
};
