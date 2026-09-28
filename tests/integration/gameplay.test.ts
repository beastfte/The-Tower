import { describe, expect, it } from "vitest";
import { InMemoryPersistenceService } from "../../src/persistence/PersistenceService";
import { createInitialPlayerSave } from "../../src/domain/character/initialState";
import { checkEngagementAllowed } from "../../src/domain/combat/blockingCheck";
import { simulateEncounter } from "../../src/domain/combat/simulateEncounter";
import { applyEnemyDefeat, updatePlayerPosition } from "../../src/domain/floor/floorState";
import { applyItemPickup } from "../../src/domain/floor/itemCollection";
import { computeEffectiveStats } from "../../src/domain/character/combatStats";
import { completeCurrentFloor } from "../../src/domain/progress/towerProgress";
import { isWinningDefeat, triggerWin } from "../../src/domain/progress/winState";
import { createTower } from "../../src/domain/floor/tower";
import { WEAPONS } from "../../src/data/weapons";
import { ARMOR_PIECES } from "../../src/data/armorPieces";
import type { ArmorPickupPayload, FloorDefinition } from "../../src/domain/floor/types";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../src/domain/character/types";

const weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition> = new Map(Object.entries(WEAPONS) as [WeaponId, WeaponDefinition][]);
const armorCatalog: ReadonlyMap<string, ArmorPieceDefinition> = new Map(Object.entries(ARMOR_PIECES));

// Tests must not depend on the live tower's authored content (src/data/floors) — it's
// replaced wholesale whenever the tower is redesigned. This fixture exercises the same
// domain logic (blocking, pickups, floor completion, win state) without caring what the
// shipped tower actually contains.
const FIRST_FLOOR: FloorDefinition = {
  id: "test-floor-1",
  grid: [[{ walkable: true }, { walkable: true }]],
  entrance: { x: 0, y: 0 },
  exit: { x: 1, y: 0 },
  enemies: [{ id: "test-goblin", position: { x: 1, y: 0 }, species: "goblin", stats: { damage: 4, defence: 1, hp: 12 } }],
  items: [
    { id: "test-sword", position: { x: 0, y: 0 }, kind: "weapon", payload: "sword" },
    { id: "test-leather-chest", position: { x: 0, y: 0 }, kind: "armor", payload: { material: "leather", slot: "chest" } },
  ],
  keyedDoors: [],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  wallZoneOverrides: [],
};
const FINAL_FLOOR: FloorDefinition = {
  id: "test-floor-final",
  grid: [[{ walkable: true }, { walkable: true }]],
  entrance: { x: 0, y: 0 },
  exit: { x: 1, y: 0 },
  enemies: [
    {
      id: "test-boss",
      position: { x: 1, y: 0 },
      species: "ogre",
      stats: { damage: 5, defence: 3, hp: 25 },
      isEndBoss: true,
    },
  ],
  items: [],
  keyedDoors: [],
  hazardTiles: [],
  spikePits: [],
  lavaTiles: [],
  levers: [],
  waterTiles: [],
  crackedWalls: [],
  wallZoneOverrides: [],
};
const TOWER = createTower([FIRST_FLOOR, FINAL_FLOOR]);

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

  it("blocks an engagement the player would lose (FR-004b)", () => {
    const floor = TOWER.floors[0]!;
    const save = createInitialPlayerSave(floor.id, floor.entrance);

    // Make the compulsory enemy artificially unbeatable to prove blocking works.
    const unbeatable = { damage: 100, defence: 100, hp: 1000 };
    const blocked = checkEngagementAllowed(save.character, weaponCatalog, armorCatalog, unbeatable);
    expect(blocked.allowed).toBe(false);

    const testEnemy = floor.enemies.find((e) => e.id === "test-goblin")!;
    const allowed = checkEngagementAllowed(save.character, weaponCatalog, armorCatalog, testEnemy.stats);
    expect(allowed.allowed).toBe(true);
  });

  it("permanently removes a defeated enemy and allows advancing (FR-009, FR-010a)", () => {
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);
    const testEnemy = floor.enemies.find((e) => e.id === "test-goblin")!;

    const afterDefeat = applyEnemyDefeat(save.currentFloorState, save.character, testEnemy);
    save.currentFloorState = afterDefeat.floorProgress;
    save.character = afterDefeat.character;
    expect(save.currentFloorState.defeatedEnemyIds).toContain(testEnemy.id);

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

  it("equipping a weapon/armor pickup changes effective stats, and a second pickup replaces rather than stacks (FR-008, FR-010; bug fix: weapon-attack-not-additive)", () => {
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);

    const baseline = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);

    const swordItem = floor.items.find((i) => i.kind === "weapon")!;
    save.character = applyItemPickup(save.character, swordItem);
    expect(save.character.equippedWeaponId).toBe(swordItem.payload);

    const afterSword = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    const swordAttackValue = weaponCatalog.get(swordItem.payload as WeaponId)!.attackValue;
    // bug fix: weapon-attack-not-additive — a weapon's attackValue now adds onto the
    // player's base (unarmed) damage instead of replacing it outright.
    expect(afterSword.damage).toBe(baseline.damage + swordAttackValue);
    expect(afterSword.damage).not.toBe(baseline.damage);
    // Regression guard: equipping any weapon must never make the player weaker than
    // unarmed (the exact symptom of the bug this fixes).
    expect(afterSword.damage).toBeGreaterThan(baseline.damage);

    // A second, different weapon replaces the first weapon's own contribution (FR-010)
    // rather than stacking with it — but both still add onto the same unarmed base.
    const goldSwordItem = { id: "test-gold-sword", position: floor.entrance, kind: "weapon" as const, payload: "goldSword" as WeaponId };
    save.character = applyItemPickup(save.character, goldSwordItem);
    expect(save.character.equippedWeaponId).toBe("goldSword");
    const afterGoldSword = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(afterGoldSword.damage).toBe(baseline.damage + weaponCatalog.get("goldSword")!.attackValue);

    // 011: armor is now tracked per slot (chest), not as one whole-character tier.
    const leatherItem = floor.items.find((i) => i.kind === "armor")!;
    const leatherPayload = leatherItem.payload as ArmorPickupPayload;
    save.character = applyItemPickup(save.character, leatherItem);
    expect(save.character.equippedArmor[leatherPayload.slot]).toBe(leatherPayload.material);

    const afterLeather = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(afterLeather.defence).toBe(
      baseline.defence + armorCatalog.get(`${leatherPayload.material}:${leatherPayload.slot}`)!.defenceBonus,
    );

    // A higher tier for the same slot replaces the lower one (FR-004) rather than stacking.
    const mailPayload: ArmorPickupPayload = { material: "mail", slot: leatherPayload.slot };
    const mailItem = { id: "test-mail", position: floor.entrance, kind: "armor" as const, payload: mailPayload };
    save.character = applyItemPickup(save.character, mailItem);
    expect(save.character.equippedArmor[leatherPayload.slot]).toBe("mail");
    const afterMail = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(afterMail.defence).toBe(
      baseline.defence + armorCatalog.get(`mail:${leatherPayload.slot}`)!.defenceBonus,
    );
  });

  it("deterministic pre-check outcome matches the actual encounter outcome", () => {
    const player = { damage: 10, defence: 2, hp: 30 };
    const enemy = { damage: 4, defence: 1, hp: 12 };
    const first = simulateEncounter(player, enemy);
    const second = simulateEncounter(player, enemy);
    expect(first).toEqual(second);
  });
});
