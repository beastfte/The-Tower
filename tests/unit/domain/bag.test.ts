import { describe, expect, it } from "vitest";
import {
  BAG_CAPACITY,
  bagEntries,
  bagIsFull,
  bagSlotsUsed,
  canTakeOff,
  discard,
  equipFromBag,
  fitDropsToBag,
  pickupNeedsSlot,
  takeOff,
} from "../../../src/domain/character/bag";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";
import type { PlayerCharacterState } from "../../../src/domain/character/save";
import { COMMON_ROLL, type GearItem } from "../../../src/domain/character/grades";
import type { ItemDefinition } from "../../../src/domain/floor/types";

const g = (key: string, roll = COMMON_ROLL): GearItem => ({ key, ...roll });
const RARE = { grade: "rare" as const, extras: { dodge: 0.03, critChance: 0.04 } };

const base = (): PlayerCharacterState => createInitialPlayerSave("f", { x: 0, y: 0 }).character;
const withGear = (n: number): PlayerCharacterState => ({
  ...base(),
  bagGear: Array.from({ length: n }, () => g("mail:helm")),
});
const item = (kind: ItemDefinition["kind"], payload: ItemDefinition["payload"]): ItemDefinition => ({
  id: "i",
  position: { x: 0, y: 0 },
  kind,
  payload,
});

describe("bag entries and capacity", () => {
  it("lists loot stacks, then the potion stack, then spare gear", () => {
    const c: PlayerCharacterState = {
      ...base(),
      inventory: ["a", "b", "a"],
      potionCount: 2,
      bagGear: [g("sword"), g("mail:chest")],
    };
    expect(bagEntries(c)).toEqual([
      { kind: "loot", id: "a", qty: 2 },
      { kind: "loot", id: "b", qty: 1 },
      { kind: "potion", qty: 2 },
      { kind: "gear", key: "sword", index: 0, item: g("sword") },
      { kind: "gear", key: "mail:chest", index: 1, item: g("mail:chest") },
    ]);
    expect(bagSlotsUsed(c)).toBe(5);
  });

  it("has no potion entry at zero and treats a missing bagGear as empty", () => {
    expect(bagEntries({ ...base(), potionCount: 0 })).toEqual([]);
    expect(bagSlotsUsed(base())).toBe(0);
  });

  it("is full at the capacity and stays full above it (old saves keep everything)", () => {
    expect(bagIsFull(withGear(BAG_CAPACITY - 1))).toBe(false);
    expect(bagIsFull(withGear(BAG_CAPACITY))).toBe(true);
    expect(bagIsFull(withGear(BAG_CAPACITY + 3))).toBe(true);
    expect(bagSlotsUsed(withGear(BAG_CAPACITY + 3))).toBe(BAG_CAPACITY + 3);
  });
});

describe("pickupNeedsSlot", () => {
  it("needs a slot for new loot only, and for gear and a first potion", () => {
    const c = { ...base(), inventory: ["gem"] };
    expect(pickupNeedsSlot(c, item("loot", { id: "gem", name: "Gem" }))).toBe(false);
    expect(pickupNeedsSlot(c, item("loot", { id: "ring", name: "Ring" }))).toBe(true);
    expect(pickupNeedsSlot(c, item("weapon", "sword"))).toBe(true);
    expect(pickupNeedsSlot(c, item("armor", { material: "mail", slot: "helm" }))).toBe(true);
    expect(pickupNeedsSlot(c, item("potion", undefined))).toBe(true);
    expect(pickupNeedsSlot({ ...c, potionCount: 1 }, item("potion", undefined))).toBe(false);
    expect(pickupNeedsSlot(c, item("chest", { kind: "potion" }))).toBe(true);
  });

  it("never needs a slot for gold, keys, a gold chest or the instant potions", () => {
    const c = base();
    expect(pickupNeedsSlot(c, item("currency", 5))).toBe(false);
    expect(pickupNeedsSlot(c, item("key", { id: "k", keyType: "bronze" }))).toBe(false);
    expect(pickupNeedsSlot(c, item("chest", { kind: "currency", amount: 5 }))).toBe(false);
    expect(pickupNeedsSlot(c, item("potionAttack", undefined))).toBe(false);
    expect(pickupNeedsSlot(c, item("potionDefense", undefined))).toBe(false);
  });
});

describe("fitDropsToBag", () => {
  const drops = { gear: g("mail:helm", RARE) };

  it("keeps a gear drop when there is room", () => {
    const fit = fitDropsToBag(base(), drops);
    expect(fit.lost).toEqual([]);
    expect(fit.drops?.gear).toEqual(drops.gear);
  });

  it("loses a gear drop when the bag is full, keeping gold", () => {
    const fit = fitDropsToBag(withGear(BAG_CAPACITY), { ...drops, currency: 9 });
    expect(fit.drops).toEqual({ currency: 9 });
    expect(fit.lost).toEqual([drops.gear]);
  });

  it("passes undefined and gold-only drops through", () => {
    expect(fitDropsToBag(base(), undefined)).toEqual({ drops: undefined, lost: [] });
    expect(fitDropsToBag(withGear(BAG_CAPACITY), { currency: 3 })).toEqual({ drops: { currency: 3 }, lost: [] });
  });
});

describe("equipFromBag", () => {
  it("wears the spare weapon and puts the worn one in its place", () => {
    const c = { ...base(), equippedWeaponId: "woodSword" as const, bagGear: [g("sword"), g("mail:helm")] };
    const next = equipFromBag(c, 0);
    expect(next.equippedWeaponId).toBe("sword");
    expect(next.bagGear).toEqual([g("woodSword"), g("mail:helm")]);
  });

  it("wears armour into an empty slot and removes it from the bag", () => {
    const c = { ...base(), bagGear: [g("mail:chest"), g("sword")] };
    const next = equipFromBag(c, 0);
    expect(next.equippedArmor.chest).toBe("mail");
    expect(next.bagGear).toEqual([g("sword")]);
  });

  it("swaps armour in the same slot and still works with a full bag", () => {
    const c: PlayerCharacterState = {
      ...base(),
      equippedArmor: { helm: "leather" },
      bagGear: [g("plate:helm"), ...Array(BAG_CAPACITY - 1).fill(g("mail:legs"))],
    };
    expect(bagIsFull(c)).toBe(true);
    const next = equipFromBag(c, 0);
    expect(next.equippedArmor.helm).toBe("plate");
    expect(next.bagGear?.[0]).toEqual(g("leather:helm"));
    expect(next.bagGear).toHaveLength(BAG_CAPACITY);
  });

  it("carries each piece's roll through equip and back (034 C4)", () => {
    const c = { ...base(), bagGear: [g("sword", RARE)] };
    const worn = equipFromBag(c, 0);
    expect(worn.equippedRolls?.weapon).toEqual(RARE);
    expect(worn.bagGear).toEqual([]);
    const off = takeOff(worn, "weapon");
    expect(off.bagGear).toEqual([g("sword", RARE)]);
    expect(off.equippedRolls?.weapon).toBeUndefined();
    expect(equipFromBag(off, 0).equippedRolls?.weapon).toEqual(RARE);
  });

  it("swapping sends the old piece back with its own roll", () => {
    const c = {
      ...base(),
      equippedWeaponId: "woodSword" as const,
      equippedRolls: { weapon: RARE },
      bagGear: [g("sword")],
    };
    const next = equipFromBag(c, 0);
    expect(next.bagGear).toEqual([g("woodSword", RARE)]);
    expect(next.equippedRolls?.weapon).toEqual(COMMON_ROLL);
  });

  it("ignores a bad index", () => {
    const c = base();
    expect(equipFromBag(c, 3)).toBe(c);
  });
});

describe("takeOff and discard", () => {
  it("moves the worn weapon and armour into the bag", () => {
    const c = { ...base(), equippedWeaponId: "sword" as const, equippedArmor: { chest: "mail" as const } };
    const a = takeOff(c, "weapon");
    expect(a.equippedWeaponId).toBeUndefined();
    expect(a.bagGear).toEqual([g("sword")]);
    const b = takeOff(a, "chest");
    expect(b.equippedArmor.chest).toBeUndefined();
    expect(b.bagGear).toEqual([g("sword"), g("mail:chest")]);
  });

  it("is blocked with a full bag or an empty slot", () => {
    const full = { ...withGear(BAG_CAPACITY), equippedWeaponId: "sword" as const };
    expect(canTakeOff(full, "weapon")).toBe(false);
    expect(takeOff(full, "weapon")).toBe(full);
    expect(canTakeOff(base(), "helm")).toBe(false);
  });

  it("discards one loot unit, one potion, or a spare piece", () => {
    const c = { ...base(), inventory: ["a", "a", "b"], potionCount: 2, bagGear: [g("sword"), g("mail:helm")] };
    expect(discard(c, { kind: "loot", id: "a", qty: 2 }).inventory).toEqual(["a", "b"]);
    expect(discard(c, { kind: "potion", qty: 2 }).potionCount).toBe(1);
    expect(discard(c, { kind: "gear", key: "sword", index: 0, item: g("sword") }).bagGear).toEqual([g("mail:helm")]);
  });

  it("frees a slot, so a blocked pickup works again afterwards", () => {
    const full = withGear(BAG_CAPACITY);
    expect(bagIsFull(discard(full, { kind: "gear", key: "mail:helm", index: 0, item: g("mail:helm") }))).toBe(false);
  });
});
