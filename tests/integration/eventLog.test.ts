import { describe, expect, it } from "vitest";
import { GameContext } from "../../src/game/GameContext";
import { InMemoryPersistenceService } from "../../src/persistence/PersistenceService";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import { TOWER } from "../../src/data/floors";
import { simulateEncounter } from "../../src/domain/combat/simulateEncounter";

describe("GameContext event log (002 FR-015, FR-017)", () => {
  it("starts empty on a fresh context (simulating a reload clearing the session-only log)", () => {
    const floor = TOWER.floors[0]!;
    const save = createInitialPlayerSave(floor.id, floor.entrance);
    const ctx = new GameContext(TOWER, new InMemoryPersistenceService(), save);
    expect(ctx.eventLog).toEqual([]);
  });

  it("records a combat encounter and a pickup, in chronological order", () => {
    const floor = TOWER.floors[0]!;
    const save = createInitialPlayerSave(floor.id, floor.entrance);
    const ctx = new GameContext(TOWER, new InMemoryPersistenceService(), save);

    const enemy = floor.enemies.find((e) => e.placement === "compulsory")!;
    const encounter = simulateEncounter(
      { damage: 10, defence: 2, hp: 30 },
      enemy.stats,
    );
    ctx.logCombatEncounter(enemy.id, encounter);
    ctx.logPickup("key", "bronze key");

    expect(ctx.eventLog).toHaveLength(2);
    expect(ctx.eventLog[0]!.kind).toBe("combat");
    expect(ctx.eventLog[0]!.message).toContain(enemy.id);
    expect(ctx.eventLog[1]!.kind).toBe("pickup");
    expect(ctx.eventLog[1]!.message).toContain("bronze key");
  });

  it("never writes the event log to PlayerSave/localStorage (FR-017)", () => {
    const floor = TOWER.floors[0]!;
    const save = createInitialPlayerSave(floor.id, floor.entrance);
    const persistence = new InMemoryPersistenceService();
    const ctx = new GameContext(TOWER, persistence, save);

    const enemy = floor.enemies.find((e) => e.placement === "optional")!;
    ctx.logCombatEncounter(enemy.id, simulateEncounter({ damage: 10, defence: 2, hp: 30 }, enemy.stats));
    ctx.logPickup("currency", "20 gold");
    ctx.persist();

    const reloaded = persistence.load();
    expect(reloaded).not.toBeNull();
    expect(JSON.stringify(reloaded)).not.toContain("eventLog");
    // A brand-new GameContext built from the reloaded save has no memory of the old log.
    const freshCtx = new GameContext(TOWER, persistence, reloaded!);
    expect(freshCtx.eventLog).toEqual([]);
  });

  it("adds no entry to the log for a plain loot pickup, since no such call is ever made", () => {
    // GameContext exposes only logCombatEncounter/logPickup("key"|"potion"|"currency", ...) —
    // there is no method to log loot, so a caller cannot produce a log entry for it (FR-015).
    const floor = TOWER.floors[0]!;
    const save = createInitialPlayerSave(floor.id, floor.entrance);
    const ctx = new GameContext(TOWER, new InMemoryPersistenceService(), save);
    expect(ctx.eventLog).toHaveLength(0);
  });
});
