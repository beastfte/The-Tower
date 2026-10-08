import type { CombatStats, Position } from "../types";
import type { ArmorMaterialId, ArmorSlotId, WeaponId } from "./types";
import type { GearItem, GearRoll, GearSlot } from "./grades";

/** Per-floor player progress for the floor currently being attempted, or a frozen completed floor. */
export interface FloorProgress {
  floorId: string;
  defeatedEnemyIds: string[];
  collectedItemIds: string[];
  playerPosition: Position;
  /** 007 US3: levers permanently toggled this floor attempt (FR-011); resets with the rest
   * of FloorProgress on checkpoint restart. */
  toggledLeverIds: string[];
  /** 010 US1: keyed doors permanently opened this floor attempt, independent of whether the
   * key that opened them is still held (it's consumed on open); resets with the rest of
   * FloorProgress on checkpoint restart, mirroring toggledLeverIds. */
  openedDoorIds: string[];
  /** 013 FR-003: wall id → number of player collisions against it this floor attempt. Absent
   * entries are implicitly 0. A wall is broken (walkable) once its count exceeds
   * CRACKED_WALL_BREAK_THRESHOLD — derived on read (wall.ts's isWallBroken), never stored as
   * a separate flag. */
  crackedWallHitCounts: Record<string, number>;
}

/** 023: the three merchant-shop upgrades — a fixed, closed set (spec Assumptions: "always the
 * same three"). */
export type UpgradeId = "vicious" | "calm" | "robust";

export interface PlayerCharacterState {
  baseStats: CombatStats;
  currentHp: number;
  inventory: string[];
  currency: number;
  /** Held key *types* (KeyDefinition.keyType values) — a KeyedDoorDefinition is passable
   * once its doorType appears here (FR-013a). */
  keyIds: string[];
  /** Absent = unarmed (FR-010's Edge Cases baseline). */
  equippedWeaponId?: WeaponId;
  /** 011 FR-001/FR-003/FR-004: independent per-slot equip state. An absent key means that slot
   * is unequipped. New saves start with `{}` — no migration from the old single-tier system
   * (011 spec Clarifications). */
  equippedArmor: Partial<Record<ArmorSlotId, ArmorMaterialId>>;
  /** 011 FR-007/FR-008: Attack Potion's permanent bonus, tracked separately from
   * `baseStats.damage` and from any equipped weapon's `attackValue` — all three are additive
   * (see computeEffectiveStats) — this field is always additive regardless of weapon state. */
  bonusDamage: number;
  /** 023 FR-006: how many times each merchant upgrade has been bought, shared across every
   * merchant in the save (Clarifications 2026-09-29) — price is derived from this, never stored
   * separately. Absent on any save persisted before this field existed; every read must treat a
   * missing entry as 0 (no migration step, matching `checkpointCharacter`'s own precedent
   * above). Lives on `PlayerCharacterState` specifically so it rides the existing
   * checkpoint-restart-then-floor-completion permanence rule for free — see
   * `applyUpgradePurchase`'s doc comment for why it must always be replaced, never mutated. */
  purchaseCounts?: Partial<Record<UpgradeId, number>>;
  /** 027 FR-045/FR-046: health potions carried, drunk only in battle. Absent on any save from
   * before 027 — read as 0, no migration (same precedent as `purchaseCounts`). Lives on the
   * character so the checkpoint snapshot restores it for free. */
  potionCount?: number;
  /** 033: spare weapons and armour carried in the bag — each entry is a weapon id ("sword") or an
   * armour catalog key ("mail:chest"). Picked-up gear lands here and is never worn automatically.
   * Absent on any save from before 033 — read as `[]`, no migration (same precedent as
   * `potionCount`). Lives on the character so the checkpoint snapshot restores it for free. */
  bagGear?: GearItem[];
  /** 034: grade and extra stats of what is worn, per slot. A missing entry means common with no
   * extras (so every pre-034 save and every floor pickup needs no entry). Travels with the piece
   * through equip / take off (bag.ts). */
  equippedRolls?: Partial<Record<GearSlot, GearRoll>>;
}

/** The single object persisted to localStorage (FR-010/FR-010a). */
export interface PlayerSave {
  currentFloorId: string;
  currentFloorState: FloorProgress;
  completedFloorIds: string[];
  completedFloorStates: Record<string, FloorProgress>;
  character: PlayerCharacterState;
  /** bug fix: checkpoint-restart-stat-exploit — a snapshot of `character` as it stood the
   * moment the current floor attempt began (set in `createInitialPlayerSave` and
   * `completeCurrentFloor`'s advance branch). FR-005 (003-pause-menu/spec.md): "Restart at
   * last checkpoint" must undo everything gained during the current attempt, not just
   * floor-local state — `resumeFromCheckpoint` restores `character` from this field. Absent
   * on a save persisted before this field existed; callers must tolerate that (see
   * `resumeFromCheckpoint`). */
  checkpointCharacter?: PlayerCharacterState;
  hasWon: boolean;
  isDead: boolean;
  /** 027 FR-028/FR-029: the display name of the monster that killed the player, shown on the
   * death screen. Saved (not passed as scene data) because the death screen is also reached by
   * relaunching the game while dead. Absent for trap deaths and when alive. */
  deathCause?: string;
}

export function emptyFloorProgress(floorId: string, playerPosition: Position): FloorProgress {
  return {
    floorId,
    defeatedEnemyIds: [],
    collectedItemIds: [],
    playerPosition,
    toggledLeverIds: [],
    openedDoorIds: [],
    crackedWallHitCounts: {},
  };
}

/**
 * bug fix: checkpoint-restart-stat-exploit (reopened) — a save persisted before
 * `checkpointCharacter` existed has it as `undefined` forever, since it's only ever set on a
 * *new* floor attempt (`createInitialPlayerSave`/`completeCurrentFloor`), never retroactively.
 * `resumeFromCheckpoint`'s own `?? save.character` fallback made "restart at checkpoint" a
 * complete no-op for any such save, indefinitely — silently reopening the exploit the field
 * was added to close, for every pre-existing save. Called once at load time (`main.ts`,
 * right after `persistence.load()`), this backfills the checkpoint from the character as it
 * stands *right now*, so the exploit is closed from this load onward — it cannot recover a
 * true historical snapshot for a save that never had one. Idempotent: a save that already has
 * a `checkpointCharacter` is returned untouched, never overwritten with the current (possibly
 * already-farmed) character.
 */
export function ensureCheckpointCharacter(save: PlayerSave): PlayerSave {
  if (save.checkpointCharacter) return save;
  return { ...save, checkpointCharacter: { ...save.character } };
}

/** 034 C10: bring a pre-034 save's gear up to date, once, at load. Bare-string bag entries become
 * common items and the removed Gold Sword becomes the Sword (not Diamond, so old saves gain no
 * power). Idempotent; applied to the checkpoint snapshot too. */
export function normalizeGear(save: PlayerSave): PlayerSave {
  const fix = (c: PlayerCharacterState): PlayerCharacterState => {
    const swap = (key: string): string => (key === "goldSword" ? "sword" : key);
    const bagGear = (c.bagGear ?? []).map((g) =>
      typeof g === "string" ? { key: swap(g), grade: "common" as const, extras: {} } : { ...g, key: swap(g.key) },
    );
    const next: PlayerCharacterState = { ...c, bagGear };
    if (c.equippedWeaponId && (c.equippedWeaponId as string) === "goldSword") next.equippedWeaponId = "sword";
    return next;
  };
  return {
    ...save,
    character: fix(save.character),
    ...(save.checkpointCharacter ? { checkpointCharacter: fix(save.checkpointCharacter) } : {}),
  };
}
