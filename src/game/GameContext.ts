import type { PlayerSave } from "../domain/character/save";
import type { PowerupDefinition } from "../domain/character/types";
import type { FloorDefinition } from "../domain/floor/types";
import type { Tower } from "../domain/floor/tower";
import type { PersistenceService } from "../persistence/PersistenceService";
import { buildPowerupCatalog } from "../data/catalog";
import type { EncounterResult } from "../domain/combat/simulateEncounter";
import type { EventLogEntry } from "./eventLog/types";
import { formatCombatEntry, formatPickupEntry } from "./eventLog/formatEntry";

/**
 * Shared runtime state bridging domain logic and Phaser scenes. Single-player,
 * single browser tab — one instance for the whole app is sufficient.
 */
export class GameContext {
  public readonly powerupCatalog: ReadonlyMap<string, PowerupDefinition>;

  /** 002 FR-015/FR-017: in-memory only, never written to PlayerSave/localStorage — cleared on reload. */
  public readonly eventLog: EventLogEntry[] = [];

  constructor(
    public readonly tower: Tower,
    public readonly persistence: PersistenceService,
    public save: PlayerSave,
  ) {
    this.powerupCatalog = buildPowerupCatalog(tower);
  }

  get currentFloor(): FloorDefinition {
    const floor = this.tower.floors.find((f) => f.id === this.save.currentFloorId);
    if (!floor) {
      throw new Error(`Unknown current floor id "${this.save.currentFloorId}"`);
    }
    return floor;
  }

  persist(): void {
    this.persistence.save(this.save);
  }

  /** 002 FR-015: appends a combat-encounter entry to the session-only event log. */
  logCombatEncounter(enemyId: string, result: EncounterResult): void {
    this.eventLog.push(formatCombatEntry(enemyId, result));
  }

  /** 002 FR-015: appends a key/powerup pickup entry to the session-only event log. */
  logPickup(kind: "key" | "powerup", label: string): void {
    this.eventLog.push(formatPickupEntry(kind, label));
  }
}
