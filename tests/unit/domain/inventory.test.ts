import { describe, expect, it } from "vitest";
import { applyDropTable } from "../../../src/domain/character/inventory";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";

const position = { x: 0, y: 0 };

describe("applyDropTable (034: gold and a gear item)", () => {
  it("is a no-op with no drops", () => {
    const save = createInitialPlayerSave("floor-01", position);
    expect(applyDropTable(save.character, undefined)).toBe(save.character);
  });

  it("adds gold to the running total", () => {
    const save = createInitialPlayerSave("floor-01", position);
    expect(applyDropTable(save.character, { currency: 15 }).currency).toBe(15);
  });

  it("puts a dropped gear item into the bag with its roll", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const gear = { key: "mail:helm", grade: "rare" as const, extras: { dodge: 0.03, critChance: 0.02 } };
    const character = applyDropTable(save.character, { gear });
    expect(character.bagGear).toEqual([gear]);
  });
});
