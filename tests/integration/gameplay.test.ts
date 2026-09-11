import { describe, expect, it } from "vitest";
import { InMemoryPersistenceService } from "../../src/persistence/PersistenceService";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import { checkEngagementAllowed } from "../../src/domain/combat/blockingCheck";
import { simulateEncounter } from "../../src/domain/combat/simulateEncounter";
import { applyEnemyDefeat, updatePlayerPosition } from "../../src/domain/floor/floorState";
import { computeEffectiveStats } from "../../src/domain/character/powerups";
import { completeCurrentFloor } from "../../src/domain/progress/towerProgress";
import { isWinningDefeat, triggerWin } from "../../src/domain/progress/winState";
import { TOWER } from "../../src/data/floors";
import { buildPowerupCatalog } from "../../src/data/catalog";

describe("gameplay integration", () => {
  it("persists and resumes mid-floor exactly as left (FR-010)", () => {
    const persistence = new InMemoryPersistenceService();
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);
    save.currentFloorState = updatePlayerPosition(save.currentFloorState, { x: 2, y: 2 });
    persistence.save(save);

    const reloaded = persistence.load();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.currentFloorState.playerPosition).toEqual({ x: 2, y: 2 });
  });

  it("blocks an unwinnable engagement, then allows it after a powerup (FR-004b, FR-008)", () => {
    const catalog = buildPowerupCatalog(TOWER);
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);

    const optionalEnemy = floor.enemies.find((e) => e.placement === "optional")!;
    const compulsoryEnemy = floor.enemies.find((e) => e.placement === "compulsory")!;

    // Make the compulsory enemy artificially unbeatable to prove blocking works.
    const unbeatable = { damage: 100, defence: 100, hp: 1000 };
    const blocked = checkEngagementAllowed(save.character, catalog, unbeatable);
    expect(blocked.allowed).toBe(false);

    // Defeat the (beatable) optional enemy to collect its powerup.
    const beforeStats = computeEffectiveStats(save.character, catalog);
    const optionalResult = checkEngagementAllowed(save.character, catalog, optionalEnemy.stats);
    expect(optionalResult.allowed).toBe(true);
    const afterOptionalDefeat = applyEnemyDefeat(
      save.currentFloorState,
      save.character,
      optionalEnemy,
    );
    save.currentFloorState = afterOptionalDefeat.floorProgress;
    save.character = afterOptionalDefeat.character;

    const afterStats = computeEffectiveStats(save.character, catalog);
    expect(afterStats.damage).toBeGreaterThan(beforeStats.damage);

    // The compulsory enemy should still be beatable with the improved stats.
    const compulsoryResult = checkEngagementAllowed(save.character, catalog, compulsoryEnemy.stats);
    expect(compulsoryResult.allowed).toBe(true);
  });

  it("permanently removes a defeated enemy and allows advancing (FR-009, FR-010a)", () => {
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);
    const compulsoryEnemy = floor.enemies.find((e) => e.placement === "compulsory")!;

    const afterDefeat = applyEnemyDefeat(save.currentFloorState, save.character, compulsoryEnemy);
    save.currentFloorState = afterDefeat.floorProgress;
    save.character = afterDefeat.character;
    expect(save.currentFloorState.defeatedEnemyIds).toContain(compulsoryEnemy.id);

    save.currentFloorState = updatePlayerPosition(save.currentFloorState, floor.exit);
    save = completeCurrentFloor(save, TOWER);

    expect(save.completedFloorIds).toContain(floor.id);
    expect(save.currentFloorId).not.toBe(floor.id);
  });

  it("triggers the win state on defeating the end boss (FR-011)", () => {
    const finalFloor = TOWER.floors[TOWER.finalFloorIndex]!;
    const boss = finalFloor.enemies.find((e) => e.isEndBoss)!;
    let save = createInitialPlayerSave(finalFloor.id, finalFloor.entrance);

    expect(isWinningDefeat(boss)).toBe(true);
    save = triggerWin(save);
    expect(save.hasWon).toBe(true);
  });

  it("deterministic pre-check outcome matches the actual encounter outcome", () => {
    const player = { damage: 10, defence: 2, hp: 30 };
    const enemy = { damage: 4, defence: 1, hp: 12 };
    const first = simulateEncounter(player, enemy);
    const second = simulateEncounter(player, enemy);
    expect(first).toEqual(second);
  });
});
