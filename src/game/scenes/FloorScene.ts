import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import type { Position } from "../../domain/types";
import { stepInDirection, type CardinalDirection } from "../../domain/floor/movement";
import { findLivingEnemyAt } from "../../domain/floor/enemyEngagement";
import { findAvailableItemAt, applyItemPickup } from "../../domain/floor/itemCollection";
import {
  markItemCollected,
  updatePlayerPosition,
  applyEnemyDefeat,
} from "../../domain/floor/floorState";
import { hasReachedExit } from "../../domain/floor/floorCompletion";
import { findKeyedDoorAt, isDoorPassable } from "../../domain/hazard/keyedDoor";
import { findHazardAt, applyHazardDamage } from "../../domain/hazard/hazardDamage";
import { hasDiedFromHazard, markDead } from "../../domain/hazard/death";
import { checkEngagementAllowed } from "../../domain/combat/blockingCheck";
import { isWinningDefeat, triggerWin } from "../../domain/progress/winState";
import { completeCurrentFloor } from "../../domain/progress/towerProgress";
import type { CombatOverlayData } from "./CombatOverlay";
import type { PickupModalData } from "./PickupModalScene";
import type { PauseMenuData } from "./PauseMenuScene";
import { resumeFromCheckpoint, returnToMainMenu } from "../../domain/hazard/recovery";
import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type { DropTable, EnemyDefinition, ItemDefinition } from "../../domain/floor/types";
import type { ArmorTierId, KeyDefinition, PowerupDefinition, WeaponId } from "../../domain/character/types";
import { keyTypeDescriptions } from "../uiContent/itemDescriptions";
import { PLAY_AREA, DESIGN_PLAY_AREA } from "../gameConfig";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { scalePx } from "../scaleConfig";
import { computeTileSize, computeTileLayerOrigin } from "../floorLayout";

const MOVE_COOLDOWN_MS = 160;

/** 004: species/weapon/player-armor-tier art baked to public/icons/*.svg (research.md #1). */
const SPECIES_TEXTURE_KEYS = ["goblin", "ogre", "wizard"] as const;
const WEAPON_TEXTURE_KEYS = ["sword", "axe", "mace", "bow", "staff"] as const;
const PLAYER_TEXTURE_KEYS = ["player-none", "player-leather", "player-mail", "player-plate"] as const;

const COLORS = {
  floor: 0x2b2430,
  wall: 0x0d0a0f,
  entrance: 0x3a5a40,
  exit: 0x588157,
  enemyCompulsory: 0x8c2f39,
  enemyOptional: 0xb56576,
  keyedDoor: 0x6f4518,
  keyedDoorOpen: 0x8a6a3a,
  hazard: 0xd1495b,
  loot: 0xe9c46a,
  currency: 0xf4a261,
  powerup: 0x8ecae6,
  key: 0xf4d35e,
} as const;

interface PendingPickup {
  kind: "key" | "powerup";
  label: string;
  description: string;
}

export class FloorScene extends Phaser.Scene {
  private ctx!: GameContext;
  private canMove = true;
  private playerSprite!: Phaser.GameObjects.Image;
  private tileLayer!: Phaser.GameObjects.Container;
  private messageText!: HTMLDivElement;
  /** Computed per floor (create()) from that floor's grid size against PLAY_AREA, so the
   * whole grid always fits inside the play area instead of overflowing behind the side
   * panel/event log (002 FR-007/FR-016). */
  private tileSize!: number;

  constructor() {
    super("FloorScene");
  }

  preload(): void {
    for (const key of [...SPECIES_TEXTURE_KEYS, ...PLAYER_TEXTURE_KEYS]) {
      if (!this.textures.exists(key)) this.load.svg(key, `/icons/${key}.svg`, { width: 128, height: 128 });
    }
    for (const key of WEAPON_TEXTURE_KEYS) {
      if (!this.textures.exists(key)) this.load.svg(key, `/icons/${key}.svg`, { width: 64, height: 64 });
    }
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;
    this.canMove = true;

    const grid = this.ctx.currentFloor.grid;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 1;
    this.tileSize = computeTileSize(cols, rows, PLAY_AREA);
    const origin = computeTileLayerOrigin(cols, rows, this.tileSize, PLAY_AREA);
    this.tileLayer = this.add.container(origin.x, origin.y);
    this.messageText = createUiText("", {
      x: DESIGN_PLAY_AREA.x + DESIGN_PLAY_AREA.width / 2,
      y: DESIGN_PLAY_AREA.y + DESIGN_PLAY_AREA.height - 12,
      originX: 0.5,
      originY: 1,
      fontSize: 9,
      color: "#f2e9d8",
      align: "center",
    });
    getUiRoot().appendChild(this.messageText);
    this.events.once("shutdown", () => this.messageText.remove());

    this.redraw();
    this.setupInput();

    if (!this.scene.isActive("SidePanelScene")) {
      this.scene.launch("SidePanelScene");
    }
    if (!this.scene.isActive("EventLogScene")) {
      this.scene.launch("EventLogScene");
    }
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (!this.canMove) return;
      if (event.key === "Escape") {
        this.openPauseMenu();
        return;
      }
      const direction = this.directionFromKey(event.key);
      if (!direction) return;
      this.attemptMove(direction);
    });
  }

  /**
   * FR-002/FR-008: opens the pause menu, blocking further floor input until it's closed.
   * Reachable via ESC (setupInput, gated by the same `canMove` flag that already blocks
   * movement during a pickup modal) or the side-panel pause control (SidePanelScene).
   * Reusing FloorScene.scene.pause() means Phaser simply stops dispatching input to this
   * scene while combat is playing out, satisfying FR-008's combat case for free.
   */
  openPauseMenu(): void {
    const ctx = this.ctx;
    const data: PauseMenuData = {
      onResume: () => {
        this.scene.stop("PauseMenuScene");
        this.scene.resume();
      },
      onRestart: () => {
        ctx.save = resumeFromCheckpoint(ctx.save, ctx.currentFloor, ctx.powerupCatalog);
        ctx.persist();
        this.scene.stop("PauseMenuScene");
        this.scene.resume();
        this.scene.restart();
      },
      onReturnToMenu: () => {
        ctx.save = returnToMainMenu(ctx.save);
        ctx.persist();
        this.scene.stop("PauseMenuScene");
        // Mirrors the existing hazard-death/win transitions above: the side panel/event log's
        // DOM text sits above the whole canvas regardless of Phaser scene depth, so it must be
        // stopped explicitly rather than relying on MainMenuScene to visually hide it.
        this.scene.stop("SidePanelScene");
        this.scene.stop("EventLogScene");
        this.scene.start("MainMenuScene");
      },
    };
    this.scene.launch("PauseMenuScene", data);
    this.scene.pause();
  }

  /** Cardinal-only input (FR-016): arrow keys or WASD, one tile per keypress. */
  private directionFromKey(key: string): CardinalDirection | null {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        return "up";
      case "ArrowDown":
      case "s":
      case "S":
        return "down";
      case "ArrowLeft":
      case "a":
      case "A":
        return "left";
      case "ArrowRight":
      case "d":
      case "D":
        return "right";
      default:
        return null;
    }
  }

  private setMessage(text: string): void {
    this.messageText.textContent = text;
    this.time.delayedCall(1500, () => {
      if (this.messageText.textContent === text) this.messageText.textContent = "";
    });
  }

  /** 002 FR-018: describes a single floor-placed item pickup as a pending pickup-modal entry, if it's a key or powerup. */
  private describeItemPickup(item: ItemDefinition): PendingPickup | null {
    if (item.kind === "powerup") {
      const powerup = item.payload as PowerupDefinition;
      return { kind: "powerup", label: powerup.id, description: powerup.description };
    }
    if (item.kind === "key") {
      const key = item.payload as KeyDefinition;
      return {
        kind: "key",
        label: `${key.keyType} key`,
        description: keyTypeDescriptions[key.keyType] ?? "",
      };
    }
    return null;
  }

  /** 002 FR-018: describes an enemy's drop table's key/powerup as pending pickup-modal entries (powerup first, then key). */
  private describeDropPickups(drops: DropTable | undefined): PendingPickup[] {
    if (!drops) return [];
    const pickups: PendingPickup[] = [];
    if (drops.powerup) {
      pickups.push({ kind: "powerup", label: drops.powerup.id, description: drops.powerup.description });
    }
    if (drops.key) {
      pickups.push({
        kind: "key",
        label: `${drops.key.keyType} key`,
        description: keyTypeDescriptions[drops.key.keyType] ?? "",
      });
    }
    return pickups;
  }

  /**
   * 002 FR-018/FR-019: logs and shows a blocking pickup modal for each pending pickup in
   * turn (queued one after another per this feature's Assumptions), then calls onDone.
   * A pickup is logged (FR-015) at the moment it's shown, not merely queued.
   */
  private launchPickupModals(pickups: PendingPickup[], onDone: () => void): void {
    if (pickups.length === 0) {
      onDone();
      return;
    }
    const [next, ...rest] = pickups;
    this.ctx.logPickup(next!.kind, next!.label);
    const data: PickupModalData = {
      kind: next!.kind,
      label: next!.label,
      description: next!.description,
      onDismiss: () => {
        this.scene.resume();
        this.launchPickupModals(rest, onDone);
      },
    };
    this.scene.launch("PickupModalScene", data);
    this.scene.pause();
  }

  private checkFloorCompletion(target: Position): void {
    const ctx = this.ctx;
    const floor = ctx.currentFloor;
    if (hasReachedExit(floor, target)) {
      ctx.save = completeCurrentFloor(ctx.save, ctx.tower);
      ctx.persist();
      this.scene.restart();
    }
  }

  private attemptMove(direction: CardinalDirection): void {
    const ctx = this.ctx;
    if (ctx.save.hasWon || ctx.save.isDead) return;

    this.canMove = false;
    this.time.delayedCall(MOVE_COOLDOWN_MS, () => {
      this.canMove = true;
    });

    const floor = ctx.currentFloor;
    const progress = ctx.save.currentFloorState;
    const from = progress.playerPosition;
    const target = stepInDirection(from, direction);

    const row = floor.grid[target.y];
    const baseWalkable =
      row !== undefined && row[target.x] !== undefined && row[target.x]!.walkable;
    if (!baseWalkable) return;

    const defeated = new Set(progress.defeatedEnemyIds);
    const enemy = findLivingEnemyAt(floor, target, defeated);
    if (enemy) {
      this.engage(enemy);
      return;
    }

    const door = findKeyedDoorAt(floor, target);
    if (door && !isDoorPassable(door, new Set(ctx.save.character.keyIds))) {
      this.setMessage(`Locked (needs ${door.doorType} key)`);
      return;
    }

    // Movement is allowed.
    ctx.save.currentFloorState = updatePlayerPosition(progress, target);

    const collected = new Set(ctx.save.currentFloorState.collectedItemIds);
    const item = findAvailableItemAt(floor, target, collected);
    let pendingPickup: PendingPickup | null = null;
    if (item) {
      ctx.save.character = applyItemPickup(ctx.save.character, item);
      ctx.save.currentFloorState = markItemCollected(ctx.save.currentFloorState, item.id);
      pendingPickup = this.describeItemPickup(item);
    }

    const hazard = findHazardAt(floor, target);
    if (hazard) {
      const newHp = applyHazardDamage(
        hazard,
        ctx.save.character.baseStats.defence,
        ctx.save.character.currentHp,
      );
      ctx.save.character = { ...ctx.save.character, currentHp: newHp };
      if (hasDiedFromHazard(newHp)) {
        ctx.save = markDead(ctx.save);
        ctx.persist();
        // The side panel/event log are launched independently of FloorScene (create()'s
        // isActive guard below) and, unlike the old canvas-only rendering, their DOM text
        // (ui/domOverlay.ts) isn't hidden by DeathScreenScene's own dim overlay — it sits in
        // a layer above the whole canvas regardless of Phaser scene depth. Stop them
        // explicitly so they don't linger on top of the death screen; FloorScene's create()
        // relaunches both the next time play resumes.
        this.scene.stop("SidePanelScene");
        this.scene.stop("EventLogScene");
        this.scene.start("DeathScreenScene");
        return;
      }
    }

    ctx.persist();
    this.redraw();

    if (pendingPickup) {
      this.canMove = false;
      this.launchPickupModals([pendingPickup], () => {
        this.canMove = true;
        this.checkFloorCompletion(target);
      });
    } else {
      this.checkFloorCompletion(target);
    }
  }

  private engage(enemy: EnemyDefinition): void {
    const ctx = this.ctx;
    const result = checkEngagementAllowed(
      ctx.save.character,
      ctx.powerupCatalog,
      ctx.weaponCatalog,
      ctx.armorTierCatalog,
      enemy.stats,
    );
    if (!result.allowed) {
      this.setMessage("Too weak to fight this enemy");
      return;
    }

    this.canMove = false;
    const data: CombatOverlayData = {
      enemy,
      encounter: result.encounter,
      playerStartHp: ctx.save.character.currentHp,
      onComplete: () => this.onCombatResolved(enemy, result.encounter),
    };
    this.scene.launch("CombatOverlay", data);
    this.scene.pause();
  }

  private onCombatResolved(enemy: EnemyDefinition, encounter: EncounterResult): void {
    const ctx = this.ctx;
    this.scene.stop("CombatOverlay");
    this.scene.resume();
    this.canMove = true;

    const dropPickups = this.describeDropPickups(enemy.drops);

    const update = applyEnemyDefeat(ctx.save.currentFloorState, ctx.save.character, enemy);
    ctx.save.currentFloorState = update.floorProgress;
    ctx.save.character = update.character;

    const lastPlayerDamageTaken = [...encounter.turns]
      .reverse()
      .find((t) => t.attacker === "enemy");
    if (lastPlayerDamageTaken) {
      ctx.save.character = {
        ...ctx.save.character,
        currentHp: lastPlayerDamageTaken.defenderHpAfter,
      };
    }

    ctx.persist();

    if (isWinningDefeat(enemy)) {
      ctx.save = triggerWin(ctx.save);
      ctx.persist();
      // See the matching comment in attemptMove's hazard-death branch: the side panel/event
      // log's DOM text sits above the whole canvas regardless of Phaser scene depth, so it
      // must be stopped explicitly rather than relying on WinScreenScene's dim overlay to
      // hide it.
      this.scene.stop("SidePanelScene");
      this.scene.stop("EventLogScene");
      this.scene.start("WinScreenScene");
      return;
    }

    this.redraw();

    if (dropPickups.length > 0) {
      this.canMove = false;
      this.launchPickupModals(dropPickups, () => {
        this.canMove = true;
      });
    }
  }

  private redraw(): void {
    const ctx = this.ctx;
    const floor = ctx.currentFloor;
    const progress = ctx.save.currentFloorState;
    const defeated = new Set(progress.defeatedEnemyIds);
    const collected = new Set(progress.collectedItemIds);
    const heldKeys = new Set(ctx.save.character.keyIds);

    this.tileLayer.removeAll(true);

    for (let y = 0; y < floor.grid.length; y++) {
      const row = floor.grid[y]!;
      for (let x = 0; x < row.length; x++) {
        const walkable = row[x]!.walkable;
        const color = walkable ? COLORS.floor : COLORS.wall;
        this.addTile(x, y, color);
      }
    }

    this.addTile(floor.entrance.x, floor.entrance.y, COLORS.entrance);
    this.addTile(floor.exit.x, floor.exit.y, COLORS.exit);

    for (const door of floor.keyedDoors) {
      const open = isDoorPassable(door, heldKeys);
      this.addTile(
        door.position.x,
        door.position.y,
        open ? COLORS.keyedDoorOpen : COLORS.keyedDoor,
      );
    }

    for (const hazard of floor.hazardTiles) {
      this.addTile(hazard.position.x, hazard.position.y, COLORS.hazard);
    }

    for (const item of floor.items) {
      if (collected.has(item.id)) continue;
      if (item.kind === "weapon") {
        const weapon = ctx.weaponCatalog.get(item.payload as WeaponId);
        if (weapon) this.addTextureMarker(item.position, weapon.textureKey, 0.6);
        continue;
      }
      if (item.kind === "armor") {
        const armor = ctx.armorTierCatalog.get(item.payload as ArmorTierId);
        if (armor) this.addTextureMarker(item.position, armor.textureKey, 0.6);
        continue;
      }
      const color =
        item.kind === "loot"
          ? COLORS.loot
          : item.kind === "currency"
            ? COLORS.currency
            : item.kind === "powerup"
              ? COLORS.powerup
              : COLORS.key;
      this.addMarker(item.position, color, 0.5);
    }

    for (const enemy of floor.enemies) {
      if (defeated.has(enemy.id)) continue;
      const species = ctx.monsterSpeciesCatalog.get(enemy.species);
      if (species) {
        this.addTextureMarker(enemy.position, species.textureKey, 0.85);
      } else {
        const color =
          enemy.placement === "compulsory" ? COLORS.enemyCompulsory : COLORS.enemyOptional;
        this.addMarker(enemy.position, color, 0.8);
      }
    }

    this.drawPlayer(progress.playerPosition);
  }

  private addTile(x: number, y: number, color: number): void {
    const size = this.tileSize;
    const rect = this.add.rectangle(
      x * size + size / 2,
      y * size + size / 2,
      size - scalePx(1),
      size - scalePx(1),
      color,
    );
    this.tileLayer.add(rect);
  }

  private addMarker(position: Position, color: number, scale: number): void {
    const size = this.tileSize;
    const rect = this.add.rectangle(
      position.x * size + size / 2,
      position.y * size + size / 2,
      (size - scalePx(2)) * scale,
      (size - scalePx(2)) * scale,
      color,
    );
    this.tileLayer.add(rect);
  }

  /** 004 US1/US2/US3: species/weapon/armor art (research.md #1), sized to fit the tile. */
  private addTextureMarker(position: Position, textureKey: string, scale: number): void {
    const size = this.tileSize;
    const image = this.add.image(
      position.x * size + size / 2,
      position.y * size + size / 2,
      textureKey,
    );
    image.setDisplaySize((size - scalePx(2)) * scale, (size - scalePx(2)) * scale);
    this.tileLayer.add(image);
  }

  private drawPlayer(position: Position): void {
    if (this.playerSprite) this.playerSprite.destroy();
    const size = this.tileSize;
    const armorTier = this.ctx.save.character.equippedArmorTier;
    const textureKey = armorTier
      ? (this.ctx.armorTierCatalog.get(armorTier)?.textureKey ?? "player-none")
      : "player-none";
    this.playerSprite = this.add.image(
      position.x * size + size / 2,
      position.y * size + size / 2,
      textureKey,
    );
    this.playerSprite.setDisplaySize(size - scalePx(4), size - scalePx(4));
    this.tileLayer.add(this.playerSprite);
  }
}
