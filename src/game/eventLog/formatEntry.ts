import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type { EventLogEntry } from "./types";

/** Formats a combat encounter's resolution as a log entry (002 FR-015).
 *
 * bug fix: currency-not-logged — `currencyGained` (the defeated enemy's `drops.currency`, if
 * any) is folded into this same entry rather than getting a standalone pickup entry, so a
 * kill's gold is visible without cluttering the log with a second line per kill. */
export function formatCombatEntry(
  enemyName: string,
  result: EncounterResult,
  currencyGained?: number,
): EventLogEntry {
  const message =
    result.winner === "player"
      ? `Defeated ${enemyName} (${result.turns.length} turn(s)).` +
        (currencyGained ? ` Found ${currencyGained} gold.` : "")
      : `Lost the encounter with ${enemyName}.`;
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
