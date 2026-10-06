import type { PlayerSave } from "../domain/character/save";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../domain/character/types";
import type { FloorDefinition, MonsterSpecies, MonsterSpeciesId } from "../domain/floor/types";
import type { Tower } from "../domain/floor/tower";
import type { PersistenceService } from "../persistence/PersistenceService";
import { MONSTER_SPECIES } from "../data/monsterSpecies";
import { WEAPONS } from "../data/weapons";
import { ARMOR_PIECES } from "../data/armorPieces";
import type { EventLogEntry } from "./eventLog/types";
import {
  formatBattleEntry,
  formatPickupEntry,
  formatPurchaseEntry,
  type BattleSummary,
} from "./eventLog/formatEntry";

/**
 * Shared runtime state bridging domain logic and Phaser scenes. Single-player,
 * single browser tab — one instance for the whole app is sufficient.
 */
export class GameContext {
  public readonly monsterSpeciesCatalog: ReadonlyMap<MonsterSpeciesId, MonsterSpecies> = new Map(
    Object.entries(MONSTER_SPECIES) as [MonsterSpeciesId, MonsterSpecies][],
  );
  public readonly weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition> = new Map(
    Object.entries(WEAPONS) as [WeaponId, WeaponDefinition][],
  );
  /** 011: keyed by `${material}:${slot}` (see data/armorPieces.ts's armorPieceKey helper). */
  public readonly armorCatalog: ReadonlyMap<string, ArmorPieceDefinition> = new Map(
    Object.entries(ARMOR_PIECES),
  );

  /** 002 FR-015/FR-017: in-memory only, never written to PlayerSave/localStorage — cleared on reload. */
  public readonly eventLog: EventLogEntry[] = [];

  constructor(
    public readonly tower: Tower,
    public readonly persistence: PersistenceService,
    public save: PlayerSave,
  ) {}

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

  /** 027 FR-024: appends the single summary line for a finished battle. 019 FR-003/FR-004:
   * `summary.enemyName` is a display name (e.g. "Goblin"), never an internal placement id. */
  logBattle(summary: BattleSummary): void {
    this.eventLog.push(formatBattleEntry(summary));
  }

  /** 002 FR-015, 005 FR-006/FR-007, 019 FR-001/FR-002: appends a key/potion/currency/weapon/
   * armor pickup entry to the session-only event log. */
  logPickup(kind: "key" | "potion" | "currency" | "weapon" | "armor", label: string): void {
    this.eventLog.push(formatPickupEntry(kind, label));
  }

  /** 023 FR-014: appends a completed merchant-upgrade purchase to the session-only event log. */
  logPurchase(label: string, price: number): void {
    this.eventLog.push(formatPurchaseEntry(label, price));
  }
}
