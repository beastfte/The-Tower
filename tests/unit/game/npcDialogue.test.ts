import { describe, expect, it, vi } from "vitest";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import { buildMerchantOptions } from "../../../src/game/npcDialogue";
import { UPGRADE_IDS } from "../../../src/domain/character/shopUpgrades";

function freshCharacter() {
  return createInitialPlayerSave("floor-01", { x: 0, y: 0 }).character;
}

describe("buildMerchantOptions (contracts C16-C17)", () => {
  it("composes each row as '<label> (<statHint>) — <price> gold', in UPGRADE_IDS order (C16)", () => {
    const character = { ...freshCharacter(), currency: 100 };
    const options = buildMerchantOptions(character, () => {});
    expect(options.map((o) => o.text)).toEqual([
      "Become more vicious (+5 attack) — 5 gold",
      "Become more sturdy (+5 defence) — 5 gold",
      "Become more versatile (+5 max HP) — 5 gold",
    ]);
  });

  it("disables no rows when the player can afford every upgrade (C17)", () => {
    const character = { ...freshCharacter(), currency: 100 };
    const options = buildMerchantOptions(character, () => {});
    expect(options.every((o) => o.disabled === false)).toBe(true);
  });

  it("disables exactly the rows the player cannot currently afford (C17)", () => {
    const character = { ...freshCharacter(), currency: 4 };
    const options = buildMerchantOptions(character, () => {});
    expect(options.every((o) => o.disabled === true)).toBe(true);
  });

  it("disables affordability independently per upgrade, not richest-wins (C17)", () => {
    const character = {
      ...freshCharacter(),
      currency: 12,
      purchaseCounts: { calm: 2 }, // calm now costs 15, vicious/robust still cost 5
    };
    const options = buildMerchantOptions(character, () => {});
    const byId = Object.fromEntries(UPGRADE_IDS.map((id, i) => [id, options[i]!]));
    expect(byId.vicious!.disabled).toBe(false);
    expect(byId.robust!.disabled).toBe(false);
    expect(byId.calm!.disabled).toBe(true);
  });

  it("invokes onPurchase with the row's own upgrade id when onSelect is called", () => {
    const character = { ...freshCharacter(), currency: 100 };
    const onPurchase = vi.fn();
    const options = buildMerchantOptions(character, onPurchase);
    options[1]!.onSelect();
    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(onPurchase).toHaveBeenCalledWith("calm");
  });
});
