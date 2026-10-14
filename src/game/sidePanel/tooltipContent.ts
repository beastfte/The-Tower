import type { BagEntry, GearSlot } from "../../domain/character/bag";
import { bagIsFull, isArmourKey } from "../../domain/character/bag";
import type { PlayerCharacterState } from "../../domain/character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../domain/character/types";
import { armorPieceKey } from "../../data/armorPieces";
import { COMMON_ROLL, GRADES, gradedValue, type GearRoll, type GradeId } from "../../domain/character/grades";
import type { CombatantStats } from "../../domain/combat/battle";
import { formatDamage, resolveHit } from "../../domain/combat/resolveAttack";
import { formatSurvival, survivalChance, threatTier, type ThreatTier } from "../../domain/combat/survival";
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

/** 041: how worrying a value is; the renderer maps it to green / gold / red. */
export type Tone = "good" | "warn" | "bad";

interface TooltipLine {
  label: string;
  value: string;
  /** Present only for bag gear whose value differs from the worn piece's. */
  delta?: { text: string; better: boolean };
  /** 041: tints the value; set only on a monster card's SURVIVE line. */
  tone?: Tone;
}

export interface TooltipContent {
  /** 034: set for gear — the name is drawn in the grade colour and the kicker names the grade. */
  grade?: GradeId;
  /** Sprite key for `spriteDataUrl`; absent when the item has no baked icon. */
  iconKey?: string;
  name: string;
  kicker: string;
  /** 041: a monster card's named danger tier (the pill beside the kicker). */
  threat?: { tier: ThreatTier; tone: Tone };
  /** 041: elite / boss cards get a rank tag, name glow and ornamented frame; unset for normal monsters. */
  rank?: "elite" | "boss";
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

export const POTION_DESCRIPTION =
  "Carried; drink one any time to heal 25% of max HP. In battle, one is drunk automatically when a monster's hit leaves you below 25% HP.";

interface GearInfo {
  name: string;
  grade: GradeId;
  slot: GearSlot;
  iconKey: string;
  stats: GearStats;
}

type Bonuses = Pick<
  WeaponDefinition,
  "attackSpeedBonus" | "critChanceBonus" | "critDamageBonus" | "dodgeChanceBonus"
>;

/** Catalog bonuses plus the roll's extras (034), rounded to whole percents so float sums stay tidy. */
function bonusStats(b: Bonuses, roll: GearRoll): Omit<GearStats, "dmg" | "def"> {
  const pct = (v: number): number => Math.round(v * 1000) / 1000;
  return {
    spd: pct((b.attackSpeedBonus ?? 0) + (roll.extras.attackSpeed ?? 0)),
    crit: pct((b.critChanceBonus ?? 0) + (roll.extras.critChance ?? 0)),
    critDmg: pct((b.critDamageBonus ?? 0) + (roll.extras.critDamage ?? 0)),
    dodge: pct((b.dodgeChanceBonus ?? 0) + (roll.extras.dodge ?? 0)),
  };
}

/** Looks a gear key up — a weapon id or a "material:slot" armour key. Undefined on a catalog miss. */
export function gearInfo(key: string, catalogs: TooltipCatalogs, roll: GearRoll = COMMON_ROLL): GearInfo | undefined {
  if (isArmourKey(key)) {
    const piece = catalogs.armour.get(key);
    if (!piece) return undefined;
    return {
      name: piece.name,
      grade: roll.grade,
      slot: piece.slot,
      iconKey: piece.textureKey,
      stats: { dmg: 0, def: gradedValue(piece.defenceBonus, roll.grade), ...bonusStats(piece, roll) },
    };
  }
  const weapon = catalogs.weapons.get(key as WeaponId);
  if (!weapon) return undefined;
  return {
    name: weapon.name,
    grade: roll.grade,
    slot: "weapon",
    iconKey: weapon.textureKey,
    stats: { dmg: gradedValue(weapon.attackValue, roll.grade), def: 0, ...bonusStats(weapon, roll) },
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
    const info = key ? gearInfo(key, catalogs, c.equippedRolls?.[source.slot]) : undefined;
    if (!info) return undefined;
    const full = bagIsFull(c);
    return {
      iconKey: info.iconKey,
      name: info.name,
      grade: info.grade,
      kicker: `Worn · ${GRADES[info.grade].name} ${cap(info.slot)}`,
      lines: buildLines(info.stats, undefined),
      hint: full ? "Bag full · can't take off" : "Click to take off",
      hintIsWarning: full,
    };
  }

  const entry = source.entry;
  if (entry.kind === "potion") {
    return {
      iconKey: "potion",
      name: "Health Potion",
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

  const info = gearInfo(entry.key, catalogs, entry.item);
  if (!info) return undefined;
  const worn = wornKey(c, info.slot);
  const wornInfo = worn ? gearInfo(worn, catalogs, c.equippedRolls?.[info.slot]) : undefined;
  const zero: GearStats = { dmg: 0, def: 0, spd: 0, crit: 0, critDmg: 0, dodge: 0 };
  return {
    iconKey: info.iconKey,
    name: info.name,
    grade: info.grade,
    kicker: `${GRADES[info.grade].name} ${cap(info.slot)} · in bag`,
    lines: buildLines(info.stats, wornInfo?.stats ?? zero),
    comparedWith: wornInfo ? `Compared with your ${wornInfo.name}` : "Nothing worn in this slot",
    hint: "Click to select",
    hintIsWarning: false,
  };
}

interface MonsterTooltipInput {
  name: string;
  floorNumber: number;
  isElite: boolean;
  /** The end boss; wins over `isElite` for the card's rank. */
  isEndBoss?: boolean;
  /** The floor-scaled monster (`monsterOnFloor`), at full HP. */
  monster: CombatantStats;
  /** The player as they would enter the fight right now. */
  player: CombatantStats;
  playerMaxHp: number;
  potionCount: number;
}

const TIER_TONE: Record<ThreatTier, Tone> = { Trivial: "good", Safe: "good", Risky: "warn", Dangerous: "bad", Deadly: "bad" };

/** 038 C6: what hovering a monster on the floor shows. */
export function buildMonsterTooltip(input: MonsterTooltipInput): TooltipContent {
  const { monster, player } = input;
  const toYou = resolveHit(monster, player, false);
  const chance = survivalChance(player, monster, input.playerMaxHp, input.potionCount);
  const tier = threatTier(chance);
  const tone = TIER_TONE[tier];
  return {
    name: input.name,
    kicker: `Floor ${input.floorNumber}`,
    threat: { tier, tone },
    ...(input.isEndBoss ? { rank: "boss" as const } : input.isElite ? { rank: "elite" as const } : {}),
    lines: [
      { label: "HP", value: formatDamage(monster.hp) },
      { label: "DMG", value: `${formatDamage(monster.attack)} (${formatDamage(toYou)} to you)` },
      { label: "DEF", value: formatDamage(monster.defence) },
      { label: "ATK SPD", value: `${(1 / monster.attackIntervalSec).toFixed(2)}/s` },
      { label: "SURVIVE", value: formatSurvival(chance), tone },
    ],
    hint: "",
    hintIsWarning: false,
  };
}
