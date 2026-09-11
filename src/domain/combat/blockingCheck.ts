import type { CombatStats } from "../types";
import type { PlayerCharacterState } from "../character/save";
import type { PowerupDefinition } from "../character/types";
import { computeEffectiveStats } from "../character/powerups";
import { simulateEncounter, type EncounterResult } from "./simulateEncounter";

export interface BlockingCheckResult {
  allowed: boolean;
  encounter: EncounterResult;
}

/**
 * The pre-combat blocking check (FR-004b): simulates the deterministic encounter using
 * the player's *effective* stats (base + powerups, FR-008) against the enemy's stats.
 * If the enemy would win, the engagement is blocked before combat starts; the player
 * character can never actually be defeated in the resulting animation.
 */
export function checkEngagementAllowed(
  character: PlayerCharacterState,
  powerupCatalog: ReadonlyMap<string, PowerupDefinition>,
  enemyStats: CombatStats,
): BlockingCheckResult {
  const playerStats = computeEffectiveStats(character, powerupCatalog);
  const encounter = simulateEncounter(playerStats, enemyStats);
  return { allowed: encounter.winner === "player", encounter };
}
