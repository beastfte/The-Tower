import type { DropTable } from "../../domain/floor/types";
import type { EventLogEntry } from "./types";

/** 027: a monster's drops as readable phrases, shared by the victory panel and the battle log
 * line, e.g. `["12 gold", "a Bronze key", "Gem"]`. */
export function describeDrops(drops: DropTable | undefined): string[] {
  if (!drops) return [];
  const phrases: string[] = [];
  if (drops.currency) phrases.push(`${drops.currency} gold`);
  if (drops.key) {
    const tier = drops.key.keyType;
    phrases.push(`a ${tier.charAt(0).toUpperCase()}${tier.slice(1)} key`);
  }
  for (const item of drops.loot ?? []) phrases.push(item.name);
  return phrases;
}

/** 027: how a battle ended, for its single event-log line (FR-024, contract C19). `loot` is the
 * victory's drops as already-readable phrases, e.g. `["12 gold", "a Bronze key"]`. */
export interface BattleSummary {
  outcome: "victory" | "defeat" | "fled";
  enemyName: string;
  loot?: string[];
}

function joinPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** 027 FR-024 (contract C19): exactly one line per battle, whatever happened inside it. Every
 * drop — gold, key, loot — is folded into the victory line rather than logged separately.
 * Supersedes 002's `formatCombatEntry` (and its currency-not-logged fix, which this subsumes). */
export function formatBattleEntry(summary: BattleSummary): EventLogEntry {
  const { outcome, enemyName, loot = [] } = summary;
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
  return { kind: "combat", message };
}

/** Formats a key/potion/currency/weapon/armor pickup as a log entry (002 FR-015, 005
 * FR-006/FR-007, 019 FR-001/FR-002). `label` is a short, already human-readable description of
 * what was picked up (e.g. "bronze key", "Health Potion", "<amount> gold", "Gold Sword",
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
export function formatBagFullEntry(name: string, outcome: "floor" | "lost" | "worn"): EventLogEntry {
  const tail = outcome === "floor" ? "stays on the floor" : outcome === "lost" ? "was lost" : "stays on";
  return { kind: "note", message: `Your bag is full. ${name} ${tail}.` };
}
