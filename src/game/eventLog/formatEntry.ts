import { ARMOR_PIECES } from "../../data/armorPieces";
import { WEAPONS } from "../../data/weapons";
import { GRADES, type DropTable, type GearItem } from "../../domain/character/grades";
import type { WeaponId } from "../../domain/character/types";
import type { EventLogEntry } from "./types";

/** 034: a piece's catalog name, e.g. "Mail Helm". */
export function gearBaseName(key: string): string {
  return (key.includes(":") ? ARMOR_PIECES[key]?.name : WEAPONS[key as WeaponId]?.name) ?? key;
}

/** 034: a piece's name with its grade, e.g. "Rare Mail Helm". */
export function gearLabel(item: GearItem): string {
  return `${GRADES[item.grade].name} ${gearBaseName(item.key)}`;
}

/** 027, 034: a monster's drops as readable phrases, shared by the victory panel and the battle
 * log line, e.g. `["4 gold"]` or `["Rare Mail Helm"]`. */
export function describeDrops(drops: DropTable | undefined): string[] {
  if (!drops) return [];
  const phrases: string[] = [];
  if (drops.currency) phrases.push(`${drops.currency} gold`);
  if (drops.gear) phrases.push(gearLabel(drops.gear));
  return phrases;
}

/** 027: how a battle ended, for its single event-log line (FR-024, contract C19). `loot` is the
 * victory's drops as already-readable phrases, e.g. `["12 gold", "a Bronze key"]`. */
export interface BattleSummary {
  outcome: "victory" | "defeat" | "fled";
  enemyName: string;
  loot?: string[];
  /** 034: the dropped gear, so its name is coloured by grade in the log. */
  gear?: GearItem;
}

function joinPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** 027 FR-024 (contract C19): exactly one line per battle, whatever happened inside it. Every
 * drop — gold, key, loot — is folded into the victory line rather than logged separately.
 * Supersedes 002's `formatCombatEntry` (and its currency-not-logged fix, which this subsumes). */
export function formatBattleEntry(summary: BattleSummary): EventLogEntry {
  const { outcome, enemyName, loot = [], gear } = summary;
  let message: string;
  if (outcome === "victory") {
    message =
      loot.length > 0
        ? `You won against ${enemyName}, looted ${joinPhrases(loot)}.`
        : `You won against ${enemyName}.`;
  } else if (outcome === "fled") {
    message = `You engaged ${enemyName}, it was too powerful and you fled.`;
  } else {
    message = `You were slain by ${enemyName}.`;
  }
  return {
    kind: "combat",
    message,
    ...(outcome === "victory" && gear ? { highlight: { text: gearLabel(gear), grade: gear.grade } } : {}),
  };
}

/** Formats a key/potion/currency/weapon/armor pickup as a log entry (002 FR-015, 005
 * FR-006/FR-007, 019 FR-001/FR-002). `label` is a short, already human-readable description of
 * what was picked up (e.g. "bronze key", "Health Potion", "<amount> gold", "Diamond Sword",
 * "Leather Helm"). */
export function formatPickupEntry(
  kind: "key" | "potion" | "currency" | "weapon" | "armor",
  label: string,
): EventLogEntry {
  const noun = kind === "currency" ? "gold" : kind;
  return { kind: "pickup", message: `Picked up ${noun}: ${label}.` };
}

/** 023 FR-014 (contract C7): a completed merchant purchase, logged only — no blocking banner. */
export function formatPurchaseEntry(label: string, price: number): EventLogEntry {
  return { kind: "purchase", message: `Purchased ${label} for ${price} gold.` };
}

/** 033 C7: one unit discarded from the bag. */
export function formatDiscardEntry(name: string): EventLogEntry {
  return { kind: "gear", message: `Discarded ${name}.` };
}

/** 033 C7 / FR-016a: a full bag blocked something. `floor` = a floor item stays put; `lost` = a
 * monster drop is gone; `worn` = a piece could not be taken off. */
export function formatBagFullEntry(
  name: string,
  outcome: "floor" | "lost" | "worn",
  gear?: GearItem,
): EventLogEntry {
  const tail = outcome === "floor" ? "stays on the floor" : outcome === "lost" ? "was lost" : "stays on";
  return {
    kind: "note",
    message: `Your bag is full. ${name} ${tail}.`,
    ...(gear ? { highlight: { text: name, grade: gear.grade } } : {}),
  };
}
