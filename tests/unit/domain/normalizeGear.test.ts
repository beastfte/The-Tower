import { describe, expect, it } from "vitest";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { normalizeGear, type PlayerSave } from "../../../src/domain/character/save";

/** A pre-034 save: bare-string bag entries and the removed Gold Sword. */
function legacySave(): PlayerSave {
  const save = createInitialPlayerSave("f", { x: 0, y: 0 });
  const legacy = {
    ...save.character,
    bagGear: ["goldSword", "mail:helm"] as unknown as never,
    equippedWeaponId: "goldSword" as never,
  };
  return { ...save, character: legacy, checkpointCharacter: { ...legacy } };
}

describe("normalizeGear (034 C10)", () => {
  it("turns string entries into common items and the Gold Sword into the Sword", () => {
    const out = normalizeGear(legacySave());
    expect(out.character.bagGear).toEqual([
      { key: "sword", grade: "common", extras: {} },
      { key: "mail:helm", grade: "common", extras: {} },
    ]);
    expect(out.character.equippedWeaponId).toBe("sword");
  });

  it("normalises the checkpoint snapshot too", () => {
    const out = normalizeGear(legacySave());
    expect(out.checkpointCharacter?.equippedWeaponId).toBe("sword");
    expect(out.checkpointCharacter?.bagGear?.[0]?.key).toBe("sword");
  });

  it("is idempotent and leaves rolled items untouched", () => {
    const rolled = { key: "mail:helm", grade: "rare" as const, extras: { dodge: 0.03, critChance: 0.02 } };
    const save = createInitialPlayerSave("f", { x: 0, y: 0 });
    const withRoll = { ...save, character: { ...save.character, bagGear: [rolled] } };
    expect(normalizeGear(withRoll).character.bagGear).toEqual([rolled]);
    const once = normalizeGear(legacySave());
    expect(normalizeGear(once)).toEqual(once);
  });
});
