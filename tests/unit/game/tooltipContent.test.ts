import { describe, expect, it } from "vitest";
import { buildTooltipContent, type TooltipCatalogs } from "../../../src/game/sidePanel/tooltipContent";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import type { PlayerCharacterState } from "../../../src/domain/character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../../src/domain/character/types";
import { BAG_CAPACITY } from "../../../src/domain/character/bag";

// Local fixtures only (Constitution IV) — not the live catalogs.
const weapons = new Map<WeaponId, WeaponDefinition>([
  ["woodSword", { id: "woodSword", name: "Test Wood", attackValue: 3, textureKey: "woodSword" }],
  [
    "sword",
    { id: "sword", name: "Test Iron", attackValue: 6, textureKey: "sword", critChanceBonus: 0.05, dodgeChanceBonus: -0.02 },
  ],
]);
const armour = new Map<string, ArmorPieceDefinition>([
  ["leather:helm", { material: "leather", slot: "helm", name: "Test Leather Helm", defenceBonus: 3, textureKey: "leatherHelm" }],
  ["mail:helm", { material: "mail", slot: "helm", name: "Test Mail Helm", defenceBonus: 6, textureKey: "mailHelm" }],
]);
const catalogs: TooltipCatalogs = {
  weapons,
  armour,
  lootNames: new Map([["gem", "Gem"]]),
  lootTextureKeys: {},
  keyTextureKeys: { bronze: "keyBronze" },
};
const base = (): PlayerCharacterState => createInitialPlayerSave("f", { x: 0, y: 0 }).character;

describe("buildTooltipContent — bag gear", () => {
  it("shows better and worse deltas against the worn piece, and omits equal stats", () => {
    const c = { ...base(), equippedWeaponId: "woodSword" as const };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "sword", index: 0 } }, catalogs)!;
    const by = Object.fromEntries(tip.lines.map((l) => [l.label, l]));
    expect(by["DMG"]).toEqual({ label: "DMG", value: "+6", delta: { text: "▲ 3", better: true } });
    expect(by["CRIT"]?.delta).toEqual({ text: "▲ 5%", better: true });
    expect(by["DODGE"]).toEqual({ label: "DODGE", value: "-2%", delta: { text: "▼ 2%", better: false } });
    expect(by["DEF"]).toBeUndefined(); // neither piece has defence
    expect(tip.comparedWith).toBe("Compared with your Test Wood");
    expect(tip.kicker).toBe("Weapon · in bag");
  });

  it("marks a worse piece red and keeps a stat only the worn piece has", () => {
    const c = { ...base(), equippedArmor: { helm: "mail" as const } };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "leather:helm", index: 0 } }, catalogs)!;
    expect(tip.lines).toEqual([{ label: "DEF", value: "+3", delta: { text: "▼ 3", better: false } }]);
  });

  it("omits the delta when equal", () => {
    const c = { ...base(), equippedArmor: { helm: "leather" as const } };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "leather:helm", index: 0 } }, catalogs)!;
    expect(tip.lines).toEqual([{ label: "DEF", value: "+3" }]);
  });

  it("says nothing is worn, and every stat is an improvement, for an empty slot", () => {
    const tip = buildTooltipContent(base(), { from: "bag", entry: { kind: "gear", key: "mail:helm", index: 0 } }, catalogs)!;
    expect(tip.comparedWith).toBe("Nothing worn in this slot");
    expect(tip.lines).toEqual([{ label: "DEF", value: "+6", delta: { text: "▲ 6", better: true } }]);
  });
});

describe("buildTooltipContent — worn, potion, loot, key", () => {
  it("shows a worn item with no comparison and the take-off hint", () => {
    const c = { ...base(), equippedWeaponId: "sword" as const };
    const tip = buildTooltipContent(c, { from: "slot", slot: "weapon" }, catalogs)!;
    expect(tip.comparedWith).toBeUndefined();
    expect(tip.lines.every((l) => l.delta === undefined)).toBe(true);
    expect(tip.kicker).toBe("Worn · Weapon");
    expect(tip.hint).toBe("Click to take off");
    expect(tip.hintIsWarning).toBe(false);
  });

  it("warns on a worn piece when the bag is full", () => {
    const c = { ...base(), equippedWeaponId: "sword" as const, bagGear: Array(BAG_CAPACITY).fill("mail:helm") };
    const tip = buildTooltipContent(c, { from: "slot", slot: "weapon" }, catalogs)!;
    expect(tip.hint).toBe("Bag full · can't take off");
    expect(tip.hintIsWarning).toBe(true);
  });

  it("returns nothing for an empty slot", () => {
    expect(buildTooltipContent(base(), { from: "slot", slot: "helm" }, catalogs)).toBeUndefined();
  });

  it("describes a potion stack and points to battle", () => {
    const tip = buildTooltipContent(base(), { from: "bag", entry: { kind: "potion", qty: 3 } }, catalogs)!;
    expect(tip.lines).toEqual([]);
    expect(tip.kicker).toBe("Potion · ×3");
    expect(tip.description).toMatch(/battle/);
    expect(tip.hint).toBe("Drink during battle");
  });

  it("falls back to the loot name when there is no description", () => {
    const tip = buildTooltipContent(base(), { from: "bag", entry: { kind: "loot", id: "gem", qty: 2 } }, catalogs)!;
    expect(tip.name).toBe("Gem");
    expect(tip.description).toBe("Gem");
  });

  it("describes a key tile, and says none held at zero", () => {
    const held = buildTooltipContent(base(), { from: "key", keyType: "bronze", count: 2 }, catalogs)!;
    expect(held.name).toBe("Bronze key");
    expect(held.description).toMatch(/bronze/i);
    const none = buildTooltipContent(base(), { from: "key", keyType: "bronze", count: 0 }, catalogs)!;
    expect(none.hint).toBe("None held yet");
  });
});
