import type { PlayerSave } from "../domain/character/save";
import type { PersistenceService } from "./PersistenceService";

const SAVE_KEY = "fantasy-tower-adventure:save";

/** Browser localStorage-backed PersistenceService (contracts/persistence-contract.md). */
export class LocalStoragePersistenceService implements PersistenceService {
  load(): PlayerSave | null {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlayerSave;
    } catch {
      return null;
    }
  }

  save(state: PlayerSave): void {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  clear(): void {
    window.localStorage.removeItem(SAVE_KEY);
  }
}
