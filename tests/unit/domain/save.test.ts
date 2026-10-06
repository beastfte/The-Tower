import { describe, expect, it } from "vitest";
import { ensureCheckpointCharacter, type PlayerSave } from "../../../src/domain/character/save";
import { computeEffectiveStats } from "../../../src/domain/character/combatStats";
import { applyItemPickup } from "../../../src/domain/floor/itemCollection";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { resumeFromCheckpoint } from "../../../src/domain/hazard/recovery";

const position = { x: 0, y: 0 };

describe("ensureCheckpointCharacter (bug fix: checkpoint-restart-stat-exploit, reopened)", () => {
  it("backfills a missing checkpoint from the current character", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const farmed = { ...save, character: { ...save.character, currency: 999 }, checkpointCharacter: undefined };

    const result = ensureCheckpointCharacter(farmed);

    expect(result.checkpointCharacter).toEqual(farmed.character);
    expect(result.checkpointCharacter?.currency).toBe(999);
  });

  it("leaves an already-present checkpoint untouched, not overwritten with the current (farmed) character", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const withCheckpoint = {
      ...save,
      character: { ...save.character, currency: 999 },
      checkpointCharacter: { ...save.character, currency: 0 },
    };

    const result = ensureCheckpointCharacter(withCheckpoint);

    expect(result).toBe(withCheckpoint);
    expect(result.checkpointCharacter?.currency).toBe(0);
  });
});

/** 027 FR-046 (contract C16): the carried potion count rides the checkpoint snapshot. */
describe("potionCount across a checkpoint restart (027)", () => {
  it("returns to the count the floor attempt began with, undoing potions picked up or drunk since", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const atCheckpoint = { ...save, checkpointCharacter: { ...save.character, potionCount: 2 } };
    const mid = { ...atCheckpoint, character: { ...atCheckpoint.character, potionCount: 5 }, isDead: true };

    const floor = { id: "floor-01", entrance: position } as Parameters<typeof resumeFromCheckpoint>[1];
    expect(resumeFromCheckpoint(mid, floor).character.potionCount).toBe(2);
  });
});

/** 027 SC-009 / FR-034: a save written before 027 (no potionCount, no deathCause, no
 * speed/crit fields anywhere) loads and plays with the defaults — no migration step. */
describe("pre-027 saves (SC-009)", () => {
  // Hand-written in the exact pre-027 shape, as JSON, the way localStorage hands it back.
  const legacyJson = JSON.stringify({
    currentFloorId: "floor-01",
    currentFloorState: {
      floorId: "floor-01",
      defeatedEnemyIds: [],
      collectedItemIds: [],
      playerPosition: { x: 0, y: 0 },
      toggledLeverIds: [],
      openedDoorIds: [],
      crackedWallHitCounts: {},
    },
    completedFloorIds: [],
    completedFloorStates: {},
    character: {
      baseStats: { damage: 10, defence: 2, hp: 30 },
      currentHp: 22,
      inventory: [],
      currency: 5,
      keyIds: [],
      equippedArmor: {},
      bonusDamage: 0,
    },
    hasWon: false,
    isDead: false,
  });

  it("is accepted and plays with 1s / 5% / 0 combat stats and 0 carried potions", () => {
    const save = ensureCheckpointCharacter(JSON.parse(legacyJson) as PlayerSave);
    const stats = computeEffectiveStats(save.character, new Map(), new Map());
    expect(stats.attackIntervalSec).toBe(1);
    expect(stats.critChance).toBe(0.05);
    expect(stats.critDamageBonus).toBe(0);
    expect(stats.damage).toBe(10);
    expect(save.character.potionCount ?? 0).toBe(0);
    expect(save.deathCause).toBeUndefined();
  });

  it("picks up its first health potion as count 1 and survives a checkpoint restart", () => {
    const save = ensureCheckpointCharacter(JSON.parse(legacyJson) as PlayerSave);
    const potion = { id: "p", position, kind: "potion" as const, payload: undefined };
    expect(applyItemPickup(save.character, potion).potionCount).toBe(1);

    const floor = { id: "floor-01", entrance: position } as Parameters<typeof resumeFromCheckpoint>[1];
    const restarted = resumeFromCheckpoint({ ...save, isDead: true }, floor);
    expect(restarted.character.potionCount ?? 0).toBe(0);
    expect(restarted.character.currentHp).toBe(30);
  });
});
