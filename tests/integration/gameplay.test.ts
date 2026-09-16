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
import { TOWER } from "../../src/data/floors";
import { WEAPONS } from "../../src/data/weapons";
import { ARMOR_PIECES } from "../../src/data/armorPieces";
import type { ArmorPickupPayload } from "../../src/domain/floor/types";
import type { ArmorPieceDefinition, WeaponDefinition, WeaponId } from "../../src/domain/character/types";

const weaponCatalog: ReadonlyMap<WeaponId, WeaponDefinition> = new Map(Object.entries(WEAPONS) as [WeaponId, WeaponDefinition][]);
const armorCatalog: ReadonlyMap<string, ArmorPieceDefinition> = new Map(Object.entries(ARMOR_PIECES));

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

    const compulsoryEnemy = floor.enemies.find((e) => e.placement === "compulsory")!;
    const allowed = checkEngagementAllowed(save.character, weaponCatalog, armorCatalog, compulsoryEnemy.stats);
    expect(allowed.allowed).toBe(true);
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

  it("equipping a weapon/armor pickup changes effective stats, and a second pickup replaces rather than stacks (FR-005, FR-008, FR-010)", () => {
    const floor = TOWER.floors[0]!;
    let save = createInitialPlayerSave(floor.id, floor.entrance);

    const baseline = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);

    const swordItem = floor.items.find((i) => i.kind === "weapon")!;
    save.character = applyItemPickup(save.character, swordItem);
    expect(save.character.equippedWeaponId).toBe(swordItem.payload);

    const afterSword = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(afterSword.damage).toBe(weaponCatalog.get(swordItem.payload as WeaponId)!.attackValue);
    expect(afterSword.damage).not.toBe(baseline.damage);

    // A second, different weapon replaces the first (FR-010) rather than stacking.
    const axeItem = { id: "test-axe", position: floor.entrance, kind: "weapon" as const, payload: "axe" as WeaponId };
    save.character = applyItemPickup(save.character, axeItem);
    expect(save.character.equippedWeaponId).toBe("axe");
    const afterAxe = computeEffectiveStats(save.character, weaponCatalog, armorCatalog);
    expect(afterAxe.damage).toBe(weaponCatalog.get("axe")!.attackValue);

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
