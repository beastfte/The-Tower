import type { PlayerSave } from "../domain/character/save";

/** The boundary between game/domain logic and browser storage (contracts/persistence-contract.md). */
export interface PersistenceService {
  load(): PlayerSave | null;
  save(state: PlayerSave): void;
  clear(): void;
}

/** In-memory implementation used by unit/integration tests and as a fallback adapter. */
export class InMemoryPersistenceService implements PersistenceService {
  private stored: PlayerSave | null = null;

  load(): PlayerSave | null {
    return this.stored ? structuredClone(this.stored) : null;
  }

  save(state: PlayerSave): void {
    this.stored = structuredClone(state);
  }

  clear(): void {
    this.stored = null;
  }
}
