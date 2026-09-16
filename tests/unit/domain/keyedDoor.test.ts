import { describe, expect, it } from "vitest";
import { isDoorPassable } from "../../../src/domain/hazard/keyedDoor";
import { applyDoorOpen } from "../../../src/domain/floor/floorState";
import { emptyFloorProgress } from "../../../src/domain/character/save";
import type { KeyedDoorDefinition } from "../../../src/domain/floor/types";
import type { PlayerCharacterState } from "../../../src/domain/character/save";

const door: KeyedDoorDefinition = { id: "door-1", position: { x: 0, y: 0 }, doorType: "bronze" };

function makeCharacter(keyIds: string[]): PlayerCharacterState {
  return {
    baseStats: { damage: 1, defence: 0, hp: 10 },
    currentHp: 10,
    inventory: [],
    currency: 0,
    keyIds,
    equippedArmor: {},
    bonusDamage: 0,
  };
}

describe("isDoorPassable", () => {
  it("is passable once openedDoorIds contains the door's id, even with no matching key held", () => {
    expect(isDoorPassable(door, new Set(), new Set(), new Set([door.id]))).toBe(true);
  });

  it("is blocked with no key, no lever unlock, and no opened record", () => {
    expect(isDoorPassable(door, new Set(), new Set(), new Set())).toBe(false);
  });
});

describe("applyDoorOpen", () => {
  it("removes exactly one matching key and appends the door id on first call", () => {
    const progress = emptyFloorProgress("f1", { x: 0, y: 0 });
    const character = makeCharacter(["bronze", "bronze", "gold"]);
    const update = applyDoorOpen(progress, character, door);
    expect(update.character.keyIds).toEqual(["bronze", "gold"]);
    expect(update.floorProgress.openedDoorIds).toEqual(["door-1"]);
  });

  it("is a no-op on a second call for the same door", () => {
    const progress = emptyFloorProgress("f1", { x: 0, y: 0 });
    const character = makeCharacter(["bronze"]);
    const first = applyDoorOpen(progress, character, door);
    const second = applyDoorOpen(first.floorProgress, first.character, door);
    expect(second.character.keyIds).toEqual(first.character.keyIds);
    expect(second.floorProgress.openedDoorIds).toEqual(first.floorProgress.openedDoorIds);
  });
});
