import { describe, expect, it } from "vitest";
import { applyHazardDamage } from "../../../src/domain/hazard/hazardDamage";
import { hasDiedFromHazard, markDead } from "../../../src/domain/hazard/death";
import { resumeFromCheckpoint, returnToMainMenu } from "../../../src/domain/hazard/recovery";
import { emptyFloorProgress, type PlayerSave } from "../../../src/domain/character/save";
import { applyUpgradePurchase } from "../../../src/domain/character/shopUpgrades";
import { completeCurrentFloor } from "../../../src/domain/progress/towerProgress";
import { createTower } from "../../../src/domain/floor/tower";
import type { FloorDefinition } from "../../../src/domain/floor/types";

describe("applyHazardDamage", () => {
  it("reduces HP by damage minus defence", () => {
    expect(applyHazardDamage({ id: "h1", position: { x: 0, y: 0 }, damage: 8 }, 2, 20)).toBe(14);
  });

  it("never reduces HP below 0", () => {
    expect(applyHazardDamage({ id: "h1", position: { x: 0, y: 0 }, damage: 100 }, 0, 5)).toBe(0);
  });
});

describe("death and recovery", () => {
  const floor: FloorDefinition = {
    id: "f1",
    grid: [[{ walkable: true }, { walkable: true }]],
    entrance: { x: 0, y: 0 },
    exit: { x: 1, y: 0 },
    enemies: [],
    items: [],
    keyedDoors: [],
    hazardTiles: [],
    spikePits: [],
    lavaTiles: [],
    levers: [],
    waterTiles: [],
    crackedWalls: [],
    wallZoneOverrides: [],
  };

  // bug fix: checkpoint-restart-stat-exploit — `checkpointCharacter` is the character as it
  // stood when this floor attempt began; `character` is the same character after farming
  // extra currency/a potion/a key/a weapon/armor *during* this attempt. A restart must
  // revert to `checkpointCharacter`, not leave the farmed `character` in place.
  const checkpointCharacter = {
    baseStats: { damage: 10, defence: 2, hp: 30 },
    currentHp: 12,
    inventory: [],
    currency: 0,
    keyIds: [],
    equippedArmor: {},
    bonusDamage: 0,
  };

  function buildSave(): PlayerSave {
    return {
      currentFloorId: floor.id,
      currentFloorState: {
        ...emptyFloorProgress(floor.id, { x: 1, y: 0 }),
        defeatedEnemyIds: ["some-enemy"],
        collectedItemIds: ["some-item"],
      },
      completedFloorIds: [],
      completedFloorStates: {},
      character: {
        ...checkpointCharacter,
        currentHp: 0,
        currency: 40,
        keyIds: ["bronze"],
        equippedWeaponId: "sword",
        equippedArmor: { chest: "leather" },
        bonusDamage: 5,
        baseStats: { ...checkpointCharacter.baseStats, defence: 4 },
      },
      checkpointCharacter,
      hasWon: false,
      isDead: false,
    };
  }

  it("hasDiedFromHazard is true only at 0 HP", () => {
    expect(hasDiedFromHazard(1)).toBe(false);
    expect(hasDiedFromHazard(0)).toBe(true);
  });

  it("markDead sets isDead and zeroes HP", () => {
    const save = markDead(buildSave());
    expect(save.isDead).toBe(true);
    expect(save.character.currentHp).toBe(0);
  });

  it("resumeFromCheckpoint resets the floor attempt and restores max HP", () => {
    const save = resumeFromCheckpoint(buildSave(), floor);
    expect(save.isDead).toBe(false);
    expect(save.currentFloorState.defeatedEnemyIds).toEqual([]);
    expect(save.currentFloorState.collectedItemIds).toEqual([]);
    expect(save.currentFloorState.playerPosition).toEqual(floor.entrance);
    expect(save.character.currentHp).toBe(30);
  });

  // bug fix: checkpoint-restart-stat-exploit — a restart must undo everything the character
  // gained during the current attempt (currency, keys, equipment, potion bonuses), not just
  // floor-local state, otherwise repeatedly collecting a respawned potion and restarting lets
  // a player farm unbounded stats.
  it("resumeFromCheckpoint reverts inventory/currency/keys/equipment/potion bonuses to the checkpoint, not the farmed values", () => {
    const save = resumeFromCheckpoint(buildSave(), floor);
    expect(save.character.currency).toBe(0);
    expect(save.character.keyIds).toEqual([]);
    expect(save.character.equippedWeaponId).toBeUndefined();
    expect(save.character.equippedArmor).toEqual({});
    expect(save.character.bonusDamage).toBe(0);
    expect(save.character.baseStats.defence).toBe(2);
  });

  // 023 (contract C6, Clarifications 2026-09-29): a merchant purchase follows the exact same
  // in-attempt-revertible rule as currency/keys/potion bonuses above — it lives on `character`,
  // so a checkpoint restart undoes it for free with no special-casing.
  it("resumeFromCheckpoint reverts a purchase made during the current, uncompleted attempt", () => {
    const farmed = applyUpgradePurchase(buildSave().character, "vicious");
    expect(farmed.bonusDamage).toBe(10); // 5 (fixture's pre-existing bonus) + 5 (the purchase)
    expect(farmed.purchaseCounts?.vicious).toBe(1);

    const save = resumeFromCheckpoint({ ...buildSave(), character: farmed }, floor);
    expect(save.character.bonusDamage).toBe(0);
    expect(save.character.purchaseCounts?.vicious).toBeUndefined();
    expect(save.character.currency).toBe(0);
  });

  // 023 (contract C6): once the floor a purchase happened on is completed, that floor's
  // completion re-stamps checkpointCharacter from the (now-purchased) character, so the
  // purchase survives a *later* restart on the next floor.
  it("a purchase survives a checkpoint restart once its floor has been completed", () => {
    const floor2: FloorDefinition = { ...floor, id: "f2" };
    const tower = createTower([floor, floor2]);

    const withPurchase: PlayerSave = {
      ...buildSave(),
      character: applyUpgradePurchase(buildSave().character, "vicious"),
    };
    const advanced = completeCurrentFloor(withPurchase, tower);
    expect(advanced.checkpointCharacter?.bonusDamage).toBe(10);

    const restarted = resumeFromCheckpoint(advanced, floor2);
    expect(restarted.character.bonusDamage).toBe(10);
    expect(restarted.character.purchaseCounts?.vicious).toBe(1);
  });

  // bug fix: checkpoint-restart-stat-exploit (reopened) — this fallback should no longer be
  // reachable in normal play, since `main.ts` now calls `ensureCheckpointCharacter` at load
  // time before a save is ever used. It's kept as a last-resort defensive backstop only (e.g.
  // against some other code path constructing a PlayerSave outside the normal load flow); see
  // `tests/unit/domain/save.test.ts` for the actual fix (the backfill itself).
  it("resumeFromCheckpoint falls back to the current character when checkpointCharacter is missing (defensive backstop, not normally reachable)", () => {
    const legacySave: PlayerSave = { ...buildSave(), checkpointCharacter: undefined };
    const save = resumeFromCheckpoint(legacySave, floor);
    // No checkpoint to revert to — behaves as it always did: floor state resets, HP maxes out,
    // farmed character fields are left as they were.
    expect(save.character.currency).toBe(40);
    expect(save.character.currentHp).toBe(30);
  });

  it("returnToMainMenu only clears isDead, leaving everything else untouched", () => {
    const before = buildSave();
    const save = returnToMainMenu(before);
    expect(save.isDead).toBe(false);
    expect(save.currentFloorState).toEqual(before.currentFloorState);
    expect(save.character).toEqual(before.character);
  });
});
