import { describe, expect, it } from "vitest";
import { lootDescriptions, keyTypeDescriptions } from "../../../src/game/uiContent/itemDescriptions";
import { TOWER } from "../../../src/data/floors";
import type { KeyDefinition, LootItem } from "../../../src/domain/character/types";

describe("itemDescriptions completeness", () => {
  it("has a lootDescriptions entry for every LootItem id in the tower", () => {
    const ids = new Set<string>();
    for (const floor of TOWER.floors) {
      for (const item of floor.items) {
        if (item.kind === "loot") ids.add((item.payload as LootItem).id);
      }
    }

    // 013: no floor currently places a "loot"-kind item (the only one, the torch, was
    // retired — research.md #8), so `ids` may legitimately be empty; this only asserts
    // completeness for whatever loot ids do exist.
    for (const id of ids) {
      expect(lootDescriptions[id], `missing lootDescriptions entry for "${id}"`).toBeDefined();
    }
  });

  it("has a keyTypeDescriptions entry for every key type referenced in the tower", () => {
    const types = new Set<string>();
    for (const floor of TOWER.floors) {
      for (const item of floor.items) {
        if (item.kind === "key") types.add((item.payload as KeyDefinition).keyType);
      }
      for (const door of floor.keyedDoors) types.add(door.doorType);
    }

    expect(types.size).toBeGreaterThan(0);
    for (const type of types) {
      expect(
        keyTypeDescriptions[type],
        `missing keyTypeDescriptions entry for "${type}"`,
      ).toBeDefined();
    }
  });
});
