import { describe, expect, it } from "vitest";
import { buildTooltipContent, type TooltipCatalogs } from "../../../src/game/sidePanel/tooltipContent";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import type { GradeId } from "../../../src/domain/character/grades";
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
const g = (key: string, grade: GradeId = "common", extras = {}) => ({ key, grade, extras });
const base = (): PlayerCharacterState => createInitialPlayerSave("f", { x: 0, y: 0 }).character;

describe("buildTooltipContent — bag gear", () => {
  it("shows better and worse deltas against the worn piece, and omits equal stats", () => {
    const c = { ...base(), equippedWeaponId: "woodSword" as const };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "sword", index: 0, item: g("sword") } }, catalogs)!;
    const by = Object.fromEntries(tip.lines.map((l) => [l.label, l]));
    expect(by["DMG"]).toEqual({ label: "DMG", value: "+6", delta: { text: "▲ 3", better: true } });
    expect(by["CRIT"]?.delta).toEqual({ text: "▲ 5%", better: true });
    expect(by["DODGE"]).toEqual({ label: "DODGE", value: "-2%", delta: { text: "▼ 2%", better: false } });
    expect(by["DEF"]).toBeUndefined(); // neither piece has defence
    expect(tip.comparedWith).toBe("Compared with your Test Wood");
    expect(tip.kicker).toBe("Common Weapon · in bag");
  });

  it("marks a worse piece red and keeps a stat only the worn piece has", () => {
    const c = { ...base(), equippedArmor: { helm: "mail" as const } };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "leather:helm", index: 0, item: g("leather:helm") } }, catalogs)!;
    expect(tip.lines).toEqual([{ label: "DEF", value: "+3", delta: { text: "▼ 3", better: false } }]);
  });

  it("omits the delta when equal", () => {
    const c = { ...base(), equippedArmor: { helm: "leather" as const } };
    const tip = buildTooltipContent(c, { from: "bag", entry: { kind: "gear", key: "leather:helm", index: 0, item: g("leather:helm") } }, catalogs)!;
    expect(tip.lines).toEqual([{ label: "DEF", value: "+3" }]);
  });

  it("says nothing is worn, and every stat is an improvement, for an empty slot", () => {
    const tip = buildTooltipContent(base(), { from: "bag", entry: { kind: "gear", key: "mail:helm", index: 0, item: g("mail:helm") } }, catalogs)!;
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
    expect(tip.kicker).toBe("Worn · Common Weapon");
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

describe("buildTooltipContent: grade and extras (034)", () => {
  const RARE = { dodge: 0.03, critChance: 0.04 };
  const bagEntry = (item: ReturnType<typeof g>) => ({ kind: "gear" as const, key: item.key, index: 0, item });

  it("names the grade, carries it for colouring, and lists extras", () => {
    const tip = buildTooltipContent(base(), { from: "bag", entry: bagEntry(g("mail:helm", "rare", RARE)) }, catalogs)!;
    expect(tip.grade).toBe("rare");
    expect(tip.kicker).toBe("Rare Helm · in bag");
    const by = Object.fromEntries(tip.lines.map((l) => [l.label, l.value]));
    expect(by["DEF"]).toBe("+7"); // 6 x 1.21
    expect(by["CRIT"]).toBe("+4%");
    expect(by["DODGE"]).toBe("+3%");
  });

  it("compares graded stats and extras against the worn roll, a missing stat counting as 0", () => {
    const c = {
      ...base(),
      equippedArmor: { helm: "mail" as const },
      equippedRolls: { helm: { grade: "uncommon" as const, extras: { critChance: 0.02 } } },
    };
    const tip = buildTooltipContent(c, { from: "bag", entry: bagEntry(g("mail:helm", "rare", RARE)) }, catalogs)!;
    const by = Object.fromEntries(tip.lines.map((l) => [l.label, l]));
    expect(by["DEF"]?.delta).toBeUndefined(); // 7 vs 7 (6 x 1.1 rounds to 7): equal, no arrow
    expect(by["CRIT"]?.delta).toEqual({ text: "▲ 2%", better: true });
    expect(by["DODGE"]?.delta).toEqual({ text: "▲ 3%", better: true });
  });

  it("shows a higher grade of the same item as an upgrade when the values differ", () => {
    const c = { ...base(), equippedArmor: { helm: "mail" as const } };
    const legendary = g("mail:helm", "legendary");
    const tip = buildTooltipContent(c, { from: "bag", entry: bagEntry(legendary) }, catalogs)!;
    expect(tip.lines.find((l) => l.label === "DEF")?.delta).toEqual({ text: "▲ 3", better: true }); // 9 vs 6
  });

  it("shows the worn piece's grade in the worn tooltip", () => {
    const c = { ...base(), equippedWeaponId: "sword" as const, equippedRolls: { weapon: { grade: "legendary" as const, extras: {} } } };
    const tip = buildTooltipContent(c, { from: "slot", slot: "weapon" }, catalogs)!;
    expect(tip.grade).toBe("legendary");
    expect(tip.kicker).toBe("Worn · Legendary Weapon");
  });
});
