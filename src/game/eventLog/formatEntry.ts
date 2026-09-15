import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type { EventLogEntry } from "./types";

/** Formats a combat encounter's resolution as a log entry (002 FR-015). */
export function formatCombatEntry(enemyId: string, result: EncounterResult): EventLogEntry {
  const message =
    result.winner === "player"
      ? `Defeated ${enemyId} (${result.turns.length} turn(s)).`
      : `Lost the encounter with ${enemyId}.`;
  return { kind: "combat", message };
}

/** Formats a key/potion/currency pickup as a log entry (002 FR-015, 005 FR-006/FR-007).
 * `label` is a short, already human-readable description of what was picked up (e.g. "bronze
 * key", "Health Potion", or "<amount> gold"). */
export function formatPickupEntry(kind: "key" | "potion" | "currency", label: string): EventLogEntry {
  const noun = kind === "key" ? "key" : kind === "potion" ? "potion" : "gold";
  return { kind: "pickup", message: `Picked up ${noun}: ${label}.` };
}
