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
import type { ItemDefinition } from "../../../src/domain/floor/types";

const base = (): PlayerCharacterState => createInitialPlayerSave("f", { x: 0, y: 0 }).character;
const withGear = (n: number): PlayerCharacterState => ({
  ...base(),
  bagGear: Array.from({ length: n }, () => "mail:helm"),
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
      bagGear: ["sword", "mail:chest"],
    };
    expect(bagEntries(c)).toEqual([
      { kind: "loot", id: "a", qty: 2 },
      { kind: "loot", id: "b", qty: 1 },
      { kind: "potion", qty: 2 },
      { kind: "gear", key: "sword", index: 0 },
      { kind: "gear", key: "mail:chest", index: 1 },
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
  const drops = {
    currency: 9,
    key: { id: "k", keyType: "gold" },
    loot: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
  };

  it("keeps everything when there is room", () => {
    const fit = fitDropsToBag(base(), drops);
    expect(fit.lost).toEqual([]);
    expect(fit.drops?.loot).toHaveLength(2);
  });

  it("always keeps gold and keys, and loses loot that does not fit, in order", () => {
    const c = withGear(BAG_CAPACITY - 1);
    const fit = fitDropsToBag(c, drops);
    expect(fit.drops?.currency).toBe(9);
    expect(fit.drops?.key).toEqual(drops.key);
    expect(fit.drops?.loot).toEqual([{ id: "a", name: "A" }]);
    expect(fit.lost).toEqual([{ id: "b", name: "B" }]);
  });

  it("keeps loot that stacks onto an id already held, even when full", () => {
    const c = { ...withGear(BAG_CAPACITY - 1), inventory: ["a"] };
    const fit = fitDropsToBag(c, { loot: [{ id: "a", name: "A" }] });
    expect(fit.lost).toEqual([]);
  });

  it("passes undefined drops through", () => {
    expect(fitDropsToBag(base(), undefined)).toEqual({ drops: undefined, lost: [] });
  });
});

describe("equipFromBag", () => {
  it("wears the spare weapon and puts the worn one in its place", () => {
    const c = { ...base(), equippedWeaponId: "woodSword" as const, bagGear: ["sword", "mail:helm"] };
    const next = equipFromBag(c, 0);
    expect(next.equippedWeaponId).toBe("sword");
    expect(next.bagGear).toEqual(["woodSword", "mail:helm"]);
  });

  it("wears armour into an empty slot and removes it from the bag", () => {
    const c = { ...base(), bagGear: ["mail:chest", "sword"] };
    const next = equipFromBag(c, 0);
    expect(next.equippedArmor.chest).toBe("mail");
    expect(next.bagGear).toEqual(["sword"]);
  });

  it("swaps armour in the same slot and still works with a full bag", () => {
    const c: PlayerCharacterState = {
      ...base(),
      equippedArmor: { helm: "leather" },
      bagGear: ["plate:helm", ...Array(BAG_CAPACITY - 1).fill("mail:legs")],
    };
    expect(bagIsFull(c)).toBe(true);
    const next = equipFromBag(c, 0);
    expect(next.equippedArmor.helm).toBe("plate");
    expect(next.bagGear?.[0]).toBe("leather:helm");
    expect(next.bagGear).toHaveLength(BAG_CAPACITY);
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
    expect(a.bagGear).toEqual(["sword"]);
    const b = takeOff(a, "chest");
    expect(b.equippedArmor.chest).toBeUndefined();
    expect(b.bagGear).toEqual(["sword", "mail:chest"]);
  });

  it("is blocked with a full bag or an empty slot", () => {
    const full = { ...withGear(BAG_CAPACITY), equippedWeaponId: "sword" as const };
    expect(canTakeOff(full, "weapon")).toBe(false);
    expect(takeOff(full, "weapon")).toBe(full);
    expect(canTakeOff(base(), "helm")).toBe(false);
  });

  it("discards one loot unit, one potion, or a spare piece", () => {
    const c = { ...base(), inventory: ["a", "a", "b"], potionCount: 2, bagGear: ["sword", "mail:helm"] };
    expect(discard(c, { kind: "loot", id: "a", qty: 2 }).inventory).toEqual(["a", "b"]);
    expect(discard(c, { kind: "potion", qty: 2 }).potionCount).toBe(1);
    expect(discard(c, { kind: "gear", key: "sword", index: 0 }).bagGear).toEqual(["mail:helm"]);
  });

  it("frees a slot, so a blocked pickup works again afterwards", () => {
    const full = withGear(BAG_CAPACITY);
    expect(bagIsFull(discard(full, { kind: "gear", key: "mail:helm", index: 0 }))).toBe(false);
  });
});
