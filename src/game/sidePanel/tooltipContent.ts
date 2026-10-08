import type { BagEntry, GearSlot } from "../../domain/character/bag";
import { bagIsFull, isArmourKey } from "../../domain/character/bag";
import type { PlayerCharacterState } from "../../domain/character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../domain/character/types";
import { armorPieceKey } from "../../data/armorPieces";
import { keyTypeDescriptions, lootDescriptions } from "../uiContent/itemDescriptions";

/** What a tooltip hover points at: a worn slot, a bag cell, or a key-ring tile. */
export type TooltipSource =
  | { from: "slot"; slot: GearSlot }
  | { from: "bag"; entry: BagEntry }
  | { from: "key"; keyType: string; count: number };

/** Everything the tooltip needs to look things up, passed in so this module stays Phaser-free. */
export interface TooltipCatalogs {
  weapons: ReadonlyMap<WeaponId, WeaponDefinition>;
  armour: ReadonlyMap<string, ArmorPieceDefinition>;
  lootNames: ReadonlyMap<string, string>;
  lootTextureKeys: Readonly<Record<string, string>>;
  keyTextureKeys: Readonly<Record<string, string>>;
}

export interface TooltipLine {
  label: string;
  value: string;
  /** Present only for bag gear whose value differs from the worn piece's. */
  delta?: { text: string; better: boolean };
}

export interface TooltipContent {
  /** Sprite key for `spriteDataUrl`; absent when the item has no baked icon. */
  iconKey?: string;
  name: string;
  kicker: string;
  lines: TooltipLine[];
  description?: string;
  comparedWith?: string;
  hint: string;
  hintIsWarning: boolean;
}

/** One piece of gear as six comparable numbers; the last four are fractions (0.25 = 25%). */
interface GearStats {
  dmg: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  dodge: number;
}

const FIELDS: { key: keyof GearStats; label: string; percent: boolean }[] = [
  { key: "dmg", label: "DMG", percent: false },
  { key: "def", label: "DEF", percent: false },
  { key: "spd", label: "ATK SPD", percent: true },
  { key: "crit", label: "CRIT", percent: true },
  { key: "critDmg", label: "CRIT DMG", percent: true },
  { key: "dodge", label: "DODGE", percent: true },
];

const POTION_DESCRIPTION = "Carried; drink one in battle to heal 25% of max HP.";

export interface GearInfo {
  name: string;
  slot: GearSlot;
  iconKey: string;
  stats: GearStats;
}

type Bonuses = Pick<
  WeaponDefinition,
  "attackSpeedBonus" | "critChanceBonus" | "critDamageBonus" | "dodgeChanceBonus"
>;

function bonusStats(b: Bonuses): Omit<GearStats, "dmg" | "def"> {
  return {
    spd: b.attackSpeedBonus ?? 0,
    crit: b.critChanceBonus ?? 0,
    critDmg: b.critDamageBonus ?? 0,
    dodge: b.dodgeChanceBonus ?? 0,
  };
}

/** Looks a gear key up — a weapon id or a "material:slot" armour key. Undefined on a catalog miss. */
export function gearInfo(key: string, catalogs: TooltipCatalogs): GearInfo | undefined {
  if (isArmourKey(key)) {
    const piece = catalogs.armour.get(key);
    if (!piece) return undefined;
    return {
      name: piece.name,
      slot: piece.slot,
      iconKey: piece.textureKey,
      stats: { dmg: 0, def: piece.defenceBonus, ...bonusStats(piece) },
    };
  }
  const weapon = catalogs.weapons.get(key as WeaponId);
  if (!weapon) return undefined;
  return {
    name: weapon.name,
    slot: "weapon",
    iconKey: weapon.textureKey,
    stats: { dmg: weapon.attackValue, def: 0, ...bonusStats(weapon) },
  };
}

/** The key of whatever is worn in `slot`, or undefined when the slot is empty. */
function wornKey(c: PlayerCharacterState, slot: GearSlot): string | undefined {
  if (slot === "weapon") return c.equippedWeaponId;
  const material = c.equippedArmor[slot];
  return material ? armorPieceKey(material, slot) : undefined;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function format(value: number, percent: boolean): string {
  const shown = percent ? Math.round(value * 1000) / 10 : value;
  return `${shown > 0 ? "+" : ""}${shown}${percent ? "%" : ""}`;
}

function buildLines(item: GearStats, compared: GearStats | undefined): TooltipLine[] {
  return FIELDS.filter(({ key }) => item[key] !== 0 || (compared && compared[key] !== 0)).map(
    ({ key, label, percent }) => {
      const line: TooltipLine = { label, value: item[key] !== 0 ? format(item[key], percent) : "—" };
      if (compared) {
        const raw = item[key] - compared[key];
        const diff = percent ? Math.round(raw * 1000) / 10 : raw;
        if (diff !== 0) {
          line.delta = {
            text: `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}${percent ? "%" : ""}`,
            better: diff > 0,
          };
        }
      }
      return line;
    },
  );
}

/** 033 C3: the tooltip card's content — pure, so it can be unit-tested without a DOM. */
export function buildTooltipContent(
  c: PlayerCharacterState,
  source: TooltipSource,
  catalogs: TooltipCatalogs,
): TooltipContent | undefined {
  if (source.from === "key") {
    const tier = cap(source.keyType);
    return {
      iconKey: catalogs.keyTextureKeys[source.keyType],
      name: `${tier} key`,
      kicker: `Key · ×${source.count}`,
      lines: [],
      description: keyTypeDescriptions[source.keyType] ?? "Opens a matching door.",
      hint: source.count > 0 ? "Used automatically at matching doors" : "None held yet",
      hintIsWarning: false,
    };
  }

  if (source.from === "slot") {
    const key = wornKey(c, source.slot);
    const info = key ? gearInfo(key, catalogs) : undefined;
    if (!info) return undefined;
    const full = bagIsFull(c);
    return {
      iconKey: info.iconKey,
      name: info.name,
      kicker: `Worn · ${cap(info.slot)}`,
      lines: buildLines(info.stats, undefined),
      hint: full ? "Bag full · can't take off" : "Click to take off",
      hintIsWarning: full,
    };
  }

  const entry = source.entry;
  if (entry.kind === "potion") {
    return {
      iconKey: "potion",
      name: "Health potion",
      kicker: `Potion · ×${entry.qty}`,
      lines: [],
      description: POTION_DESCRIPTION,
      hint: "Drink during battle",
      hintIsWarning: false,
    };
  }
  if (entry.kind === "loot") {
    const name = catalogs.lootNames.get(entry.id) ?? entry.id;
    return {
      iconKey: catalogs.lootTextureKeys[entry.id],
      name,
      kicker: `Loot · ×${entry.qty}`,
      lines: [],
      description: lootDescriptions[entry.id] || name,
      hint: "Click to select",
      hintIsWarning: false,
    };
  }

  const info = gearInfo(entry.key, catalogs);
  if (!info) return undefined;
  const worn = wornKey(c, info.slot);
  const wornInfo = worn ? gearInfo(worn, catalogs) : undefined;
  const zero: GearStats = { dmg: 0, def: 0, spd: 0, crit: 0, critDmg: 0, dodge: 0 };
  return {
    iconKey: info.iconKey,
    name: info.name,
    kicker: `${cap(info.slot)} · in bag`,
    lines: buildLines(info.stats, wornInfo?.stats ?? zero),
    comparedWith: wornInfo ? `Compared with your ${wornInfo.name}` : "Nothing worn in this slot",
    hint: "Click to select",
    hintIsWarning: false,
  };
}
