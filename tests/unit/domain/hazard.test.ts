import { describe, expect, it } from "vitest";
import { applyHazardDamage } from "../../../src/domain/hazard/hazardDamage";
import { hasDiedFromHazard, markDead } from "../../../src/domain/hazard/death";
import { resumeFromCheckpoint, returnToMainMenu } from "../../../src/domain/hazard/recovery";
import { emptyFloorProgress, type PlayerSave } from "../../../src/domain/character/save";
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
        baseStats: { damage: 10, defence: 2, hp: 30 },
        currentHp: 0,
        powerupIds: [],
        inventory: [],
        currency: 0,
        keyIds: [],
      },
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
    const save = resumeFromCheckpoint(buildSave(), floor, new Map());
    expect(save.isDead).toBe(false);
    expect(save.currentFloorState.defeatedEnemyIds).toEqual([]);
    expect(save.currentFloorState.collectedItemIds).toEqual([]);
    expect(save.currentFloorState.playerPosition).toEqual(floor.entrance);
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
