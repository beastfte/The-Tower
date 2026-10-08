import type { DropTable, ItemDefinition, ChestReward } from "../floor/types";
import type { PlayerCharacterState } from "./save";
import type { ArmorMaterialId, ArmorSlotId, LootItem, WeaponId } from "./types";

/** 033 FR-016: the bag holds at most this many entries (a loot stack or the potion stack is one
 * entry; each spare weapon or armour piece is one entry). */
export const BAG_CAPACITY = 25;

/** A bag cell, in grid order: loot stacks, then the health-potion stack, then spare gear. */
export type BagEntry =
  | { kind: "loot"; id: string; qty: number }
  | { kind: "potion"; qty: number }
  | { kind: "gear"; key: string; index: number };

/** A worn-gear slot: the weapon or one armour slot. */
export type GearSlot = "weapon" | ArmorSlotId;

/** 033 data-model: a `bagGear` key is a weapon id, or `"material:slot"` for armour. */
export function isArmourKey(key: string): boolean {
  return key.includes(":");
}

export function parseArmourKey(key: string): { material: ArmorMaterialId; slot: ArmorSlotId } {
  const [material, slot] = key.split(":");
  return { material: material as ArmorMaterialId, slot: slot as ArmorSlotId };
}

/** The slot a `bagGear` key would be worn in. */
export function gearSlotOf(key: string): GearSlot {
  return isArmourKey(key) ? parseArmourKey(key).slot : "weapon";
}

export function bagEntries(c: PlayerCharacterState): BagEntry[] {
  const loot = new Map<string, number>();
  for (const id of c.inventory) loot.set(id, (loot.get(id) ?? 0) + 1);
  const entries: BagEntry[] = [...loot.entries()].map(([id, qty]) => ({ kind: "loot", id, qty }));
  if ((c.potionCount ?? 0) > 0) entries.push({ kind: "potion", qty: c.potionCount ?? 0 });
  (c.bagGear ?? []).forEach((key, index) => entries.push({ kind: "gear", key, index }));
  return entries;
}

export function bagSlotsUsed(c: PlayerCharacterState): number {
  return bagEntries(c).length;
}

export function bagIsFull(c: PlayerCharacterState): boolean {
  return bagSlotsUsed(c) >= BAG_CAPACITY;
}

/** 033 R7: would acquiring this floor item take a new bag slot? Gold, keys and the instant
 * attack/defence potions never do. */
export function pickupNeedsSlot(c: PlayerCharacterState, item: ItemDefinition): boolean {
  switch (item.kind) {
    case "loot":
      return !c.inventory.includes((item.payload as LootItem).id);
    case "potion":
      return (c.potionCount ?? 0) === 0;
    case "chest":
      return (item.payload as ChestReward).kind === "potion" && (c.potionCount ?? 0) === 0;
    case "weapon":
    case "armor":
      return true;
    default:
      return false;
  }
}

/** 033 FR-016a/b: a monster's drops, trimmed to what the bag can take. Gold and keys are always
 * kept; loot is kept while there is room, or when it stacks onto an id already held. Whatever
 * does not fit is lost for good. */
export function fitDropsToBag(
  c: PlayerCharacterState,
  drops: DropTable | undefined,
): { drops: DropTable | undefined; lost: LootItem[] } {
  if (!drops?.loot || drops.loot.length === 0) return { drops, lost: [] };
  const held = new Set(c.inventory);
  let used = bagSlotsUsed(c);
  const kept: LootItem[] = [];
  const lost: LootItem[] = [];
  for (const item of drops.loot) {
    if (held.has(item.id)) {
      kept.push(item);
    } else if (used < BAG_CAPACITY) {
      held.add(item.id);
      used += 1;
      kept.push(item);
    } else {
      lost.push(item);
    }
  }
  return { drops: { ...drops, loot: kept }, lost };
}

/** 033 FR-015: wear the spare piece at `gearIndex`; whatever was worn in that slot takes its place
 * in the bag, so the bag never grows (allowed when full). */
export function equipFromBag(c: PlayerCharacterState, gearIndex: number): PlayerCharacterState {
  const gear = c.bagGear ?? [];
  const key = gear[gearIndex];
  if (key === undefined) return c;
  let worn: string | undefined;
  let next: PlayerCharacterState;
  if (isArmourKey(key)) {
    const { material, slot } = parseArmourKey(key);
    const old = c.equippedArmor[slot];
    worn = old ? `${old}:${slot}` : undefined;
    next = { ...c, equippedArmor: { ...c.equippedArmor, [slot]: material } };
  } else {
    worn = c.equippedWeaponId;
    next = { ...c, equippedWeaponId: key as WeaponId };
  }
  const bagGear = [...gear];
  if (worn) bagGear[gearIndex] = worn;
  else bagGear.splice(gearIndex, 1);
  return { ...next, bagGear };
}

/** 033 FR-015: can the worn piece go back to the bag? False when the slot is empty or the bag is full. */
export function canTakeOff(c: PlayerCharacterState, slot: GearSlot): boolean {
  const worn = slot === "weapon" ? c.equippedWeaponId : c.equippedArmor[slot];
  return worn !== undefined && !bagIsFull(c);
}

/** Take the worn piece off into the bag; unchanged when `canTakeOff` is false. */
export function takeOff(c: PlayerCharacterState, slot: GearSlot): PlayerCharacterState {
  if (!canTakeOff(c, slot)) return c;
  const bagGear = [...(c.bagGear ?? [])];
  if (slot === "weapon") {
    bagGear.push(c.equippedWeaponId as string);
    return { ...c, equippedWeaponId: undefined, bagGear };
  }
  const material = c.equippedArmor[slot] as ArmorMaterialId;
  bagGear.push(`${material}:${slot}`);
  const equippedArmor = { ...c.equippedArmor };
  delete equippedArmor[slot];
  return { ...c, equippedArmor, bagGear };
}

/** 033 FR-014: remove one unit of the entry — one loot unit, one potion, or the spare piece. */
export function discard(c: PlayerCharacterState, entry: BagEntry): PlayerCharacterState {
  switch (entry.kind) {
    case "loot": {
      const at = c.inventory.indexOf(entry.id);
      if (at < 0) return c;
      return { ...c, inventory: [...c.inventory.slice(0, at), ...c.inventory.slice(at + 1)] };
    }
    case "potion":
      return { ...c, potionCount: Math.max(0, (c.potionCount ?? 0) - 1) };
    case "gear": {
      const gear = c.bagGear ?? [];
      if (entry.index < 0 || entry.index >= gear.length) return c;
      return { ...c, bagGear: [...gear.slice(0, entry.index), ...gear.slice(entry.index + 1)] };
    }
  }
}
