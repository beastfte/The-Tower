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

/** Formats a key/powerup pickup as a log entry (002 FR-015). `label` is a short, already
 * human-readable description of what was picked up (e.g. "bronze key" or a powerup id). */
export function formatPickupEntry(kind: "key" | "powerup", label: string): EventLogEntry {
  const noun = kind === "key" ? "key" : "powerup";
  return { kind: "pickup", message: `Picked up ${noun}: ${label}.` };
}
