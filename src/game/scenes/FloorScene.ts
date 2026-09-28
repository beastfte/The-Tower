import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { positionsEqual, type Position } from "../../domain/types";
import { stepInDirection, type CardinalDirection } from "../../domain/floor/movement";
import { findLivingEnemyAt } from "../../domain/floor/enemyEngagement";
import { findAvailableItemAt, applyItemPickup } from "../../domain/floor/itemCollection";
import {
  markItemCollected,
  updatePlayerPosition,
  applyEnemyDefeat,
  applyLeverToggle,
  applyDoorOpen,
  applyWallCollision,
} from "../../domain/floor/floorState";
import { hasReachedExit } from "../../domain/floor/floorCompletion";
import { findKeyedDoorAt, isDoorPassable } from "../../domain/hazard/keyedDoor";
import { findHazardAt, applyHazardDamage } from "../../domain/hazard/hazardDamage";
import { findSpikePitAt } from "../../domain/hazard/spikePit";
import { findLavaTileAt } from "../../domain/hazard/lavaTile";
import { findLeverAt, resolveLeverEffects } from "../../domain/hazard/lever";
import { findCrackedWallAt, resolveBrokenWallPositions, resolveWallZone } from "../../domain/floor/wall";
import { ensureWallTexture, ensureDoorTexture, type DoorTier } from "../render/wallSprites";
import { hasDiedFromHazard, markDead } from "../../domain/hazard/death";
import { checkEngagementAllowed } from "../../domain/combat/blockingCheck";
import { isWinningDefeat, triggerWin } from "../../domain/progress/winState";
import { completeCurrentFloor, returnToPreviousFloor } from "../../domain/progress/towerProgress";
import type { CombatOverlayData } from "./CombatOverlay";
import type { PickupModalData } from "./PickupModalScene";
import type { PauseMenuData } from "./PauseMenuScene";
import { resumeFromCheckpoint, returnToMainMenu } from "../../domain/hazard/recovery";
import type { EncounterResult } from "../../domain/combat/simulateEncounter";
import type {
  ArmorPickupPayload,
  ChestReward,
  DropTable,
  EnemyDefinition,
  ItemDefinition,
  LavaTileDefinition,
  SpikePitDefinition,
  ZoneThemeId,
} from "../../domain/floor/types";
import { ARMOR_MATERIAL_ORDER } from "../../domain/character/types";
import type { ArmorMaterialId, KeyDefinition, LootItem, WeaponId } from "../../domain/character/types";
import { ensureLavaGlowTexture, ensurePlayerTexture, ensureSpriteTexture, ensureZoneTileTexture } from "../render/spriteTextures";
import type { ArmourTierId } from "../render/spriteData";
import {
  keyTypeDescriptions,
  potionDescription,
  attackPotionDescription,
  defensePotionDescription,
} from "../uiContent/itemDescriptions";
import { PLAY_AREA, DESIGN_PLAY_AREA, TILE_SIZE } from "../gameConfig";
import { createUiText, getUiRoot } from "../ui/domOverlay";
import { scalePx } from "../scaleConfig";
import { computeTileLayerOrigin } from "../floorLayout";
import { computeBobOffset, computePositionPhase } from "../livingAnimation";
import {
  computeLavaFrame,
  computeSpikePitSegment,
  isSpikePitArmed,
  type SpikePitSegment,
} from "../trapAnimation";

const MOVE_COOLDOWN_MS = 160;
/** 007: shared cadence for "damage while standing" checks (spike pit, lava), decoupled
 * from the spike pit's own visual arm/retract cycle (research.md #3). */
const TRAP_TICK_MS = 1000;

const SPIKE_SEGMENT_TEXTURE: Record<SpikePitSegment, string> = {
  retracted: "spikesOff",
  rising: "spikesHalf",
  armed: "spikesOn",
  falling: "spikesHalf",
};

/** 006 FR-009: maps a LootItem id to its baked texture key. A loot id with no entry here
 * falls back to the plain colored marker (COLORS.loot) rather than fabricating new art.
 * Exported (009) so SidePanelScene can render the same icon instead of duplicating this list.
 * 013: "loot-torch" removed — torches are no longer a collectible loot item (FR-010). */
export const LOOT_TEXTURE_KEYS: Record<string, string> = {};

/** 009: maps a key type to its baked texture key, same "no entry → fallback" contract as
 * LOOT_TEXTURE_KEYS above. Replaces the previous `this.textures.exists(\`key-${keyType}\`)`
 * runtime check (research.md #2 addendum for 009) — that check only ever reflected this same
 * static allow-list, so a real key.keyType->textureKey map is the single authoritative source,
 * reusable by SidePanelScene (a DOM-only scene with no Phaser texture manager to query). */
export const KEY_TEXTURE_KEYS: Record<string, string> = {
  bronze: "keyBronze",
  silver: "keySilver",
  gold: "keyGold",
};

/** 010 US1 (FR-005); 013 session 4 replaces the drawn tier-colored slab with the real door
 * sprite lifted from the reference sheet's section 11 "DOORS" (wallSprites.ensureDoorTexture) —
 * a door tier that doesn't match one of the 3 known tiers falls back to bronze rather than
 * fabricating new art. */
const DOOR_TIERS = new Set<DoorTier>(["bronze", "silver", "gold"]);
function resolveDoorTier(doorType: string): DoorTier {
  return DOOR_TIERS.has(doorType as DoorTier) ? (doorType as DoorTier) : "bronze";
}

/** Shared dark outline/notch color, matching the reference sheet's own darkest fill
 * (`ctx.fillStyle = "#0a0d14"`, used for its canvas/atlas background). */
const OUTLINE_COLOR = 0x0a0d14;

export const COLORS = {
  /** 017: was split into enemyCompulsory/enemyOptional by `enemy.placement` — that field is
   * gone (placement is now computed, not authored) and this fallback marker only ever renders
   * for an enemy whose species is missing from the catalog, which never happens for valid data
   * (research.md R3). One neutral colour is all that fallback needs. */
  enemy: 0x8c2f39,
  hazard: 0xd1495b,
  loot: 0xe9c46a,
  key: 0xf4d35e,
} as const;

interface PendingPickup {
  kind: "key" | "potion" | "currency";
  label: string;
  description: string;
}

export class FloorScene extends Phaser.Scene {
  private ctx!: GameContext;
  private canMove = true;
  private playerSprite!: Phaser.GameObjects.Image;
  private tileLayer!: Phaser.GameObjects.Container;
  private messageText!: HTMLDivElement;
  /** Set from the fixed `TILE_SIZE` constant in `create()` (014 FR-004/FR-005) — no longer
   * computed per floor. `PLAY_AREA` is sized to exactly fit a 15x15 grid of `TILE_SIZE` tiles
   * (research.md #2), so the whole grid still always fits inside the play area instead of
   * overflowing behind the side panel/event log (002 FR-007/FR-016). */
  private tileSize!: number;
  /** 008: markers for every "living" floor entity currently bobbing (rebuilt every redraw()).
   * Monsters are pushed here; the player character is deliberately excluded (008 follow-up —
   * idle motion turned off for the player specifically) even though it's also "alive". Item
   * pickups were removed from this list too — they render static, see the item-rendering loop
   * below. */
  private livingMarkers: {
    gameObject: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
    baseY: number;
    phase: number;
  }[] = [];
  /** 007 US1: spike-pit markers currently cycling (rebuilt every redraw()); update()
   * swaps each one's texture based on its current cycle segment. */
  private spikePitMarkers: { gameObject: Phaser.GameObjects.Image; pit: SpikePitDefinition }[] = [];
  /** 007 US2: lava markers currently cycling base/glow (rebuilt every redraw()). */
  private lavaMarkers: { gameObject: Phaser.GameObjects.Image; lava: LavaTileDefinition }[] = [];

  constructor() {
    super("FloorScene");
  }

  preload(): void {
    // The lever is the sheet's one genuine orphan (FR-025) — its existing art is kept as-is
    // rather than sourced from spriteData.ts, so it's the only texture still preloaded here.
    for (const key of ["lever-off", "lever-on"]) {
      if (!this.textures.exists(key)) this.load.svg(key, `/icons/${key}.svg`, { width: 64, height: 64 });
    }
  }

  create(): void {
    this.ctx = this.registry.get("ctx") as GameContext;
    this.canMove = true;

    const grid = this.ctx.currentFloor.grid;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 1;
    this.tileSize = TILE_SIZE;
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
    this.time.addEvent({
      delay: TRAP_TICK_MS,
      loop: true,
      callback: () => this.applyStandingTrapDamage(),
    });

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
        ctx.save = resumeFromCheckpoint(ctx.save, ctx.currentFloor);
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

  /** 002 FR-018: describes a single floor-placed item pickup as a pending pickup-modal entry, if it's a key. */
  private describeItemPickup(item: ItemDefinition): PendingPickup | null {
    if (item.kind === "key") {
      const key = item.payload as KeyDefinition;
      return {
        kind: "key",
        label: `${key.keyType} key`,
        description: keyTypeDescriptions[key.keyType] ?? "",
      };
    }
    if (item.kind === "potion") {
      return { kind: "potion", label: "Health Potion", description: potionDescription };
    }
    if (item.kind === "potionAttack") {
      return { kind: "potion", label: "Attack Potion", description: attackPotionDescription };
    }
    if (item.kind === "potionDefense") {
      return { kind: "potion", label: "Defense Potion", description: defensePotionDescription };
    }
    if (item.kind === "chest") {
      return this.describeChestReward(item.payload as ChestReward);
    }
    return null;
  }

  /** 005 FR-005/FR-006: describes a chest's revealed reward exactly as if it were the
   * matching plain pickup — the same modal a direct currency/potion pickup would show,
   * so "what did I find" messaging never drifts from what collecting it did. */
  private describeChestReward(reward: ChestReward): PendingPickup {
    switch (reward.kind) {
      case "currency":
        return { kind: "currency", label: `${reward.amount} gold`, description: "A pile of gold coins." };
      case "potion":
        return { kind: "potion", label: "Health Potion", description: potionDescription };
    }
  }

  /** 002 FR-018: describes an enemy's drop table's key as a pending pickup-modal entry. */
  private describeDropPickups(drops: DropTable | undefined): PendingPickup[] {
    if (!drops) return [];
    const pickups: PendingPickup[] = [];
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
      return;
    }
    // Bug fix: backtrack-stairs-no-effect (FR-009a) — stepping onto the entrance ("stairs
    // down") mirrors the exit branch above, one floor the other direction.
    if (positionsEqual(target, floor.entrance)) {
      const withBacktrack = returnToPreviousFloor(ctx.save, ctx.tower);
      if (withBacktrack !== ctx.save) {
        ctx.save = withBacktrack;
        ctx.persist();
        this.scene.restart();
      }
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
    // 007 US3: recomputed fresh from the current toggle state so a lever's effect (door
    // unlock, revealed pathway) is visible to this same move the instant it's toggled (FR-010).
    const leverEffects = resolveLeverEffects(floor, progress.toggledLeverIds);

    const row = floor.grid[target.y];
    const brokenWallPositions = resolveBrokenWallPositions(floor, progress.crackedWallHitCounts);
    const baseWalkable =
      (row !== undefined && row[target.x] !== undefined && row[target.x]!.walkable) ||
      leverEffects.revealedPathwayPositions.some((p) => positionsEqual(p, target)) ||
      brokenWallPositions.some((p) => positionsEqual(p, target));
    if (!baseWalkable) {
      // 013 FR-003/FR-005: a blocked collision into a not-yet-broken cracked wall counts
      // toward its total but never completes this same move (research.md #5) — the player
      // stays on their current tile, so no damage-while-standing timer can ever apply.
      const crackedWall = findCrackedWallAt(floor, target);
      if (crackedWall) {
        ctx.save.currentFloorState = applyWallCollision(progress, crackedWall);
        ctx.persist();
      }
      return;
    }

    const defeated = new Set(progress.defeatedEnemyIds);
    const enemy = findLivingEnemyAt(floor, target, defeated);
    if (enemy) {
      this.engage(enemy);
      return;
    }

    const door = findKeyedDoorAt(floor, target);
    if (
      door &&
      !isDoorPassable(
        door,
        new Set(ctx.save.character.keyIds),
        leverEffects.unlockedDoorIds,
        new Set(progress.openedDoorIds),
      )
    ) {
      this.setMessage(`Locked (needs ${door.doorType} key)`);
      return;
    }

    // Movement is allowed.
    ctx.save.currentFloorState = updatePlayerPosition(progress, target);

    // 007 US3 (FR-007, FR-008): toggling a lever is a one-time, permanent effect of walking
    // onto its tile — re-derive leverEffects after this so the hazard checks below already
    // see any trap this same move just deactivated (FR-010's "even mid-linger" edge case).
    const lever = findLeverAt(floor, target);
    if (lever) {
      ctx.save.currentFloorState = applyLeverToggle(ctx.save.currentFloorState, lever);
    }

    // 010 US1 (FR-001): a first-time visit through a matching-type key was already confirmed
    // passable by the door gate above; applyDoorOpen is idempotent, mirroring applyLeverToggle.
    if (door) {
      const update = applyDoorOpen(ctx.save.currentFloorState, ctx.save.character, door);
      ctx.save.currentFloorState = update.floorProgress;
      ctx.save.character = update.character;
    }
    const currentLeverEffects = lever
      ? resolveLeverEffects(floor, ctx.save.currentFloorState.toggledLeverIds)
      : leverEffects;

    const collected = new Set(ctx.save.currentFloorState.collectedItemIds);
    const item = findAvailableItemAt(floor, target, collected);
    let pendingPickup: PendingPickup | null = null;
    if (item) {
      ctx.save.character = applyItemPickup(ctx.save.character, item);
      ctx.save.currentFloorState = markItemCollected(ctx.save.currentFloorState, item.id);
      // bug fix: currency-not-logged — a standalone (non-chest) currency pickup now gets its
      // own log entry, same as a key, but must never trigger a blocking modal (FR-018
      // unchanged) — so it's logged directly here instead of going through
      // describeItemPickup/launchPickupModals.
      if (item.kind === "currency") {
        ctx.logPickup("currency", `${item.payload} gold`);
      } else {
        pendingPickup = this.describeItemPickup(item);
      }
    }

    const hazard = findHazardAt(floor, target);
    if (hazard) {
      const newHp = applyHazardDamage(
        hazard,
        ctx.save.character.baseStats.defence,
        ctx.save.character.currentHp,
      );
      if (this.applyPlayerDamage(newHp)) return;
    }

    // 007 US2 (FR-005): lava damages once immediately on entry; the standing-trap-damage
    // timer (applyStandingTrapDamage) covers repeat damage while the player remains. 007
    // US3 (FR-010): a lever toggled by this very move can already have deactivated it.
    const lava = findLavaTileAt(floor, target);
    if (lava && !currentLeverEffects.deactivatedTrapIds.has(lava.id)) {
      const newHp = applyHazardDamage(
        lava,
        ctx.save.character.baseStats.defence,
        ctx.save.character.currentHp,
      );
      if (this.applyPlayerDamage(newHp)) return;
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

  /** Applies a computed newHp to the player and, if it's fatal, persists and transitions to
   * DeathScreenScene exactly like attemptMove's hazard-death branch used to inline. Returns
   * true if the player died (caller should stop, no further work). */
  private applyPlayerDamage(newHp: number): boolean {
    const ctx = this.ctx;
    ctx.save.character = { ...ctx.save.character, currentHp: newHp };
    if (hasDiedFromHazard(newHp)) {
      ctx.save = markDead(ctx.save);
      ctx.persist();
      this.scene.stop("SidePanelScene");
      this.scene.stop("EventLogScene");
      this.scene.start("DeathScreenScene");
      return true;
    }
    return false;
  }

  /** 007 US1/US2: fires every TRAP_TICK_MS (research.md #3) — re-checks the player's current
   * tile for a spike pit that's armed *right now* or a lava tile they're lingering on, and
   * applies damage, independent of attemptMove's keypress-driven checks (FR-002/FR-005's
   * "repeatedly if they remain"). */
  private applyStandingTrapDamage(): void {
    const ctx = this.ctx;
    if (ctx.save.hasWon || ctx.save.isDead) return;
    const floor = ctx.currentFloor;
    const progress = ctx.save.currentFloorState;
    const position = progress.playerPosition;
    const deactivatedTrapIds = resolveLeverEffects(floor, progress.toggledLeverIds).deactivatedTrapIds;

    const pit = findSpikePitAt(floor, position);
    const lava = findLavaTileAt(floor, position);
    const armedPit = pit && !deactivatedTrapIds.has(pit.id) && isSpikePitArmed(pit, this.time.now) ? pit : undefined;
    const activeLava = lava && !deactivatedTrapIds.has(lava.id) ? lava : undefined;
    const trap = armedPit ?? activeLava;
    if (!trap) return;

    const newHp = applyHazardDamage(trap, ctx.save.character.baseStats.defence, ctx.save.character.currentHp);
    if (this.applyPlayerDamage(newHp)) return;
    ctx.persist();
    this.redraw();
  }

  private engage(enemy: EnemyDefinition): void {
    const ctx = this.ctx;
    const result = checkEngagementAllowed(ctx.save.character, ctx.weaponCatalog, ctx.armorCatalog, enemy.stats);
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
    const leverEffects = resolveLeverEffects(floor, progress.toggledLeverIds);
    const brokenWallPositions = resolveBrokenWallPositions(floor, progress.crackedWallHitCounts);
    const zone = floor.zone ?? "stone";

    this.tileLayer.removeAll(true);
    this.livingMarkers = [];
    this.spikePitMarkers = [];
    this.lavaMarkers = [];

    for (let y = 0; y < floor.grid.length; y++) {
      const row = floor.grid[y]!;
      for (let x = 0; x < row.length; x++) {
        const position = { x, y };
        const walkable =
          row[x]!.walkable || brokenWallPositions.some((p) => positionsEqual(p, position));
        if (walkable) {
          this.addFloorTile(x, y, zone);
        } else {
          // 013 session 3: a wall's own zone override (if any) picks the palette here, so a
          // single floor can demonstrate more than one zone's wall art (contract invariant 18).
          this.addWallTile(x, y, resolveWallZone(floor, position), !!findCrackedWallAt(floor, position));
        }
      }
    }

    // 006 FR-011: the entrance is where the player arrived from (stairs down into this
    // floor); the exit leads further up the tower (stairs up).
    this.addTextureMarker(floor.entrance, "stairsDown", 1);
    this.addTextureMarker(floor.exit, "stairsUp", 1);

    for (const door of floor.keyedDoors) {
      // 010 US2 (FR-007) fix: rendering "open" must reflect that the door was actually
      // interacted with (openedDoorIds) or permanently unlocked via lever — NOT merely that a
      // matching key is currently held. isDoorPassable intentionally treats a held key as
      // passable so the first step through the door is allowed; reusing it here made doors
      // vanish the instant a matching key was picked up, before the player ever reached them.
      const open = progress.openedDoorIds.includes(door.id) || leverEffects.unlockedDoorIds.has(door.id);
      if (!open) {
        this.addDoorMarker(door.position, resolveDoorTier(door.doorType));
      }
    }

    for (const lever of floor.levers) {
      const toggled = progress.toggledLeverIds.includes(lever.id);
      this.addTextureMarker(lever.position, toggled ? "lever-on" : "lever-off", 1);
    }

    for (const water of floor.waterTiles) {
      this.addTextureMarker(water.position, "water", 1);
    }

    for (const hazard of floor.hazardTiles) {
      this.addTile(hazard.position.x, hazard.position.y, COLORS.hazard);
    }

    for (const pit of floor.spikePits) {
      const marker = this.addTextureMarker(pit.position, "spikesOff", 1);
      this.spikePitMarkers.push({ gameObject: marker, pit });
    }

    for (const lava of floor.lavaTiles) {
      const marker = this.addTextureMarker(lava.position, "lava", 1);
      this.lavaMarkers.push({ gameObject: marker, lava });
    }

    for (const item of floor.items) {
      if (collected.has(item.id)) continue;
      let marker: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | undefined;
      if (item.kind === "weapon") {
        // 014 FR-010: weapon/armor pickups render at ~55% of the tile (Assumptions —
        // weapons follow armor's ratio, since both are equipment rather than small icons).
        const weapon = ctx.weaponCatalog.get(item.payload as WeaponId);
        if (weapon) marker = this.addTextureMarker(item.position, weapon.textureKey, 0.55);
      } else if (item.kind === "armor") {
        const pickup = item.payload as ArmorPickupPayload;
        const armor = ctx.armorCatalog.get(`${pickup.material}:${pickup.slot}`);
        if (armor) marker = this.addTextureMarker(item.position, armor.textureKey, 0.55);
      } else if (item.kind === "currency") {
        // 014 FR-010: currency/keys/potions render as small icons at ~35% of the tile.
        marker = this.addTextureMarker(item.position, "coin", 0.35);
      } else if (item.kind === "potion") {
        marker = this.addTextureMarker(item.position, "potion", 0.35);
      } else if (item.kind === "potionAttack") {
        marker = this.addTextureMarker(item.position, "potionAttack", 0.35);
      } else if (item.kind === "potionDefense") {
        marker = this.addTextureMarker(item.position, "potionDefense", 0.35);
      } else if (item.kind === "chest") {
        marker = this.addTextureMarker(item.position, "chest", 0.8);
      } else if (item.kind === "key") {
        // 006 FR-008: real key art, keyed by tier (via KEY_TEXTURE_KEYS); a tier with no baked
        // icon yet falls back to the plain colored marker rather than fabricating new art (FR-007).
        const key = item.payload as KeyDefinition;
        const textureKey = KEY_TEXTURE_KEYS[key.keyType];
        marker = textureKey
          ? this.addTextureMarker(item.position, textureKey, 0.35) // 014 FR-010: small icon
          : this.addMarker(item.position, COLORS.key, 0.5);
      } else {
        // item.kind === "loot" (006 FR-009): real art for ids with a baked icon (LOOT_TEXTURE_KEYS),
        // falling back to the plain colored marker for any other loot id (FR-007).
        const loot = item.payload as LootItem;
        const textureKey = LOOT_TEXTURE_KEYS[loot.id];
        marker = textureKey
          ? this.addTextureMarker(item.position, textureKey, 0.6)
          : this.addMarker(item.position, COLORS.loot, 0.5);
      }
    }

    for (const enemy of floor.enemies) {
      if (defeated.has(enemy.id)) continue;
      const species = ctx.monsterSpeciesCatalog.get(enemy.species);
      const marker = species
        ? this.addTextureMarker(enemy.position, species.textureKey, species.spriteScale)
        : this.addMarker(enemy.position, COLORS.enemy, 0.8);
      this.livingMarkers.push({
        gameObject: marker,
        baseY: marker.y,
        phase: computePositionPhase(enemy.position),
      });
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

  /** 018: the sheet's own floorSlab/floorCracked tiles, zone-palette-swapped — a pseudo-random
   * subset renders the cracked variant (research/data-model's floor sprite pair), plus faint
   * dark grid lines on the top/left edges. */
  private addFloorTile(x: number, y: number, zone: ZoneThemeId): void {
    const size = this.tileSize;
    const cracked = (x * 7 + y * 13) % 9 === 0;
    const key = ensureZoneTileTexture(this, cracked ? "floorCracked" : "floorSlab", zone);
    const image = this.add.image(x * size + size / 2, y * size + size / 2, key);
    image.setDisplaySize(size, size);
    this.tileLayer.add(image);
    // 014: a grid line marks the boundary with the *previous* row/column, so the outermost
    // row/column (x/y === 0) skips its line — there's no adjacent tile on that side to
    // separate from, and drawing it anyway would poke half its width past PLAY_AREA's own
    // edge (only ever masked before by leftover centering slack, which an exact-fit grid,
    // 014 FR-006, no longer has).
    if (y > 0) {
      const gridLine = this.add.rectangle(x * size + size / 2, y * size, size, scalePx(1), OUTLINE_COLOR, 0.45);
      this.tileLayer.add(gridLine);
    }
    if (x > 0) {
      const gridLineLeft = this.add.rectangle(x * size, y * size + size / 2, scalePx(1), size, OUTLINE_COLOR, 0.45);
      this.tileLayer.add(gridLineLeft);
    }
  }

  /** 013 session 4: the real wallBlock/crackedWall pixel sprite lifted from the reference sheet
   * (wallSprites.ensureWallTexture), palette-swapped per zone — replaces the earlier flat-color
   * + highlight-band approximation. */
  private addWallTile(x: number, y: number, zone: ZoneThemeId, cracked: boolean): void {
    const size = this.tileSize;
    const key = ensureWallTexture(this, zone, cracked);
    const image = this.add.image(x * size + size / 2, y * size + size / 2, key);
    image.setDisplaySize(size, size);
    this.tileLayer.add(image);
  }

  /** 013 session 4: the real door sprite lifted from the reference sheet's section 11 "DOORS"
   * (wallSprites.ensureDoorTexture) — replaces the earlier drawn tier-colored slab. Named so
   * e2e tests can still find it without relying on a texture key. */
  private addDoorMarker(position: Position, tier: DoorTier): void {
    const size = this.tileSize;
    const key = ensureDoorTexture(this, tier);
    const image = this.add.image(position.x * size + size / 2, position.y * size + size / 2, key);
    image.setDisplaySize(size, size);
    image.setName("door-marker");
    this.tileLayer.add(image);
  }

  private addMarker(position: Position, color: number, scale: number): Phaser.GameObjects.Rectangle {
    const size = this.tileSize;
    const rect = this.add.rectangle(
      position.x * size + size / 2,
      position.y * size + size / 2,
      (size - scalePx(2)) * scale,
      (size - scalePx(2)) * scale,
      color,
    );
    this.tileLayer.add(rect);
    return rect;
  }

  /** 004 US1/US2/US3: species/weapon/armor art (research.md #1), sized to fit the tile. */
  private addTextureMarker(position: Position, textureKey: string, scale: number): Phaser.GameObjects.Image {
    const size = this.tileSize;
    const key = ensureSpriteTexture(this, textureKey);
    const image = this.add.image(
      position.x * size + size / 2,
      position.y * size + size / 2,
      key,
    );
    image.setDisplaySize((size - scalePx(2)) * scale, (size - scalePx(2)) * scale);
    this.tileLayer.add(image);
    return image;
  }

  /** 008: applies the shared idle bob to every tracked living-entity marker (monsters only —
   * the player is excluded, see the field comment above) each frame.
   * 007 US1: swaps each spike pit's texture to match its current cycle segment.
   * 007 US2: swaps each lava tile's texture between its base and glow frames. */
  override update(time: number): void {
    for (const { gameObject, baseY, phase } of this.livingMarkers) {
      gameObject.y = baseY + computeBobOffset(time, phase);
    }
    for (const { gameObject, pit } of this.spikePitMarkers) {
      const segment = computeSpikePitSegment(pit, time);
      const textureKey = SPIKE_SEGMENT_TEXTURE[segment];
      if (gameObject.texture.key !== textureKey) gameObject.setTexture(textureKey);
    }
    for (const { gameObject, lava } of this.lavaMarkers) {
      const frame = computeLavaFrame(lava, time);
      const textureKey = frame === "lava" ? ensureSpriteTexture(this, "lava") : ensureLavaGlowTexture(this);
      if (gameObject.texture.key !== textureKey) gameObject.setTexture(textureKey);
    }
  }

  /** Whichever equipped slot carries the most protective material picks the body's tier — the
   * sheet composes worn armour as one whole-body state (contract C3), not per-slot overlays, so
   * a mixed loadout still needs exactly one tier to render. */
  private playerTier(): ArmourTierId {
    const materials = Object.values(this.ctx.save.character.equippedArmor).filter(
      (m): m is ArmorMaterialId => !!m,
    );
    if (materials.length === 0) return "none";
    return materials.reduce((best, m) => (ARMOR_MATERIAL_ORDER[m] > ARMOR_MATERIAL_ORDER[best] ? m : best));
  }

  /** 018 (contract C3): one composed image — base body plus tier-recoloured armour overlay,
   * baked into a single texture by ensurePlayerTexture — replacing the old base-plus-four-
   * separate-overlay-images approach that rendered armour off-centre. */
  private drawPlayer(position: Position): void {
    if (this.playerSprite) this.playerSprite.destroy();

    const size = this.tileSize;
    const displaySize = size - scalePx(4);
    const px = position.x * size + size / 2;
    const py = position.y * size + size / 2;

    const key = ensurePlayerTexture(this, this.playerTier());
    this.playerSprite = this.add.image(px, py, key);
    this.playerSprite.setDisplaySize(displaySize, displaySize);
    this.tileLayer.add(this.playerSprite);
  }
}
