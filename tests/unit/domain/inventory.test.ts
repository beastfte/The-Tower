import { describe, expect, it } from "vitest";
import { applyDropTable } from "../../../src/domain/character/inventory";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";

const position = { x: 0, y: 0 };

describe("applyDropTable (bug fix: duplicate-key-pickup-dropped)", () => {
  it("is a no-op with no drops", () => {
    const save = createInitialPlayerSave("floor-01", position);
    expect(applyDropTable(save.character, undefined)).toBe(save.character);
  });

  it("adds loot, currency, and a key from a single DropTable", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const character = applyDropTable(save.character, {
      loot: [{ id: "loot-1", name: "Test Loot" }],
      currency: 15,
      key: { id: "key-bronze", keyType: "bronze" },
    });
    expect(character.inventory).toEqual(["loot-1"]);
    expect(character.currency).toBe(15);
    expect(character.keyIds).toEqual(["bronze"]);
  });

  it("a second enemy dropping the same key type adds a second entry, not a no-op", () => {
    const save = createInitialPlayerSave("floor-01", position);
    let character = applyDropTable(save.character, { key: { id: "key-bronze-1", keyType: "bronze" } });
    character = applyDropTable(character, { key: { id: "key-bronze-2", keyType: "bronze" } });
    expect(character.keyIds).toEqual(["bronze", "bronze"]);
  });

  it("keyIds already held from a floor pickup is not deduplicated against a drop-table key of the same type", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const withFloorKey = { ...save.character, keyIds: ["bronze"] };
    const character = applyDropTable(withFloorKey, { key: { id: "key-bronze-2", keyType: "bronze" } });
    expect(character.keyIds).toEqual(["bronze", "bronze"]);
  });
});
