import Phaser from "phaser";
import type { GameContext } from "../GameContext";
import { positionsEqual, type Position } from "../../domain/types";
import { stepInDirection, type CardinalDirection } from "../../domain/floor/movement";
import { findLivingEnemyAt } from "../../domain/floor/enemyEngagement";
import { findMerchantAt } from "../../domain/floor/merchantInteraction";
import { applyUpgradePurchase, priceFor, UPGRADES } from "../../domain/character/shopUpgrades";
import type { UpgradeId } from "../../domain/character/save";
import { buildMerchantOptions, MERCHANT_GREETING } from "../npcDialogue";
import { playMusic, pauseMusic, resumeMusic, GAME_MUSIC_KEY, COMBAT_MUSIC_KEY } from "../music";
import { playSfx, itemKindToSfxKey, sfxDoor, sfxError } from "../sfx";
import { findAvailableItemAt, applyItemPickup } from "../../domain/floor/itemCollection";
import {
  markItemCollected,
  updatePlayerPosition,
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
import { monsterCombatant } from "../../domain/combat/battle";
import { computeEffectiveStats, computeMaxHp } from "../../domain/character/combatStats";
import { describeDrops } from "../eventLog/formatEntry";
import { isWinningDefeat } from "../../domain/progress/winState";
import { completeCurrentFloor, returnToPreviousFloor } from "../../domain/progress/towerProgress";
import type { CombatOverlayData } from "./CombatOverlay";
import type { CombatIntroData } from "./CombatIntroScene";
import { applyBattleResult, type BattleEndOutcome } from "../battleResult";
import type { PauseMenuData } from "./PauseMenuScene";
import type { NpcDialogueData } from "./NpcDialogueScene";
import { resumeFromCheckpoint, returnToMainMenu } from "../../domain/hazard/recovery";
import type {
  ArmorPickupPayload,
  ChestReward,
  EnemyDefinition,
  LavaTileDefinition,
  MerchantDefinition,
  SpikePitDefinition,
  ZoneThemeId,
} from "../../domain/floor/types";
import { ARMOR_MATERIAL_ORDER } from "../../domain/character/types";
import type { ArmorMaterialId, KeyDefinition, LootItem, WeaponId } from "../../domain/character/types";
import {
  ensureLavaGlowTexture,
  ensureMonsterCombatTexture,
  ensurePlayerTexture,
  ensureSpriteTexture,
  ensureZoneTileTexture,
} from "../render/spriteTextures";
import type { ArmourTierId, PlayerDirection } from "../render/spriteData";
import { computePlayerIdleFrame, computePlayerWalkFrame, facingForDirection } from "../playerAnimation";
import { computeMerchantIdleFrame } from "../merchantAnimation";
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
/** 021 US1: repeat-fire interval while a directional key is held continuously — exactly half
 * of the single-tap cooldown above, satisfying "twice as fast" (research.md R5, contract C2). */
const HELD_MOVE_COOLDOWN_MS = MOVE_COOLDOWN_MS / 2;
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

export class FloorScene extends Phaser.Scene {
  private ctx!: GameContext;
  private canMove = true;
  /** 021 US1: which direction is currently held down, driving repeat-fire in update() — last
   * key pressed wins (contract C7), cleared on its matching keyup or when an overlay opens. */
  private heldDirection: CardinalDirection | null = null;
  private lastHeldMoveAt = 0;
  /** 021 US2: which way the character sprite currently faces, updated on every successful move
   * (contract C5). Render-only — never persisted (research R7), resets to "front" on floor load. */
  private playerFacing: PlayerDirection = "front";
  /** 021 US2: while `time` is before this timestamp, update() plays the walk animation instead
   * of idle — refreshed on every move, so continuous held movement never flickers to idle
   * between repeat-fire ticks. */
  private playerMovingUntil: number | null = null;
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
  /** 023 US2: merchant markers currently breathing (rebuilt every redraw()); update() swaps
   * each one's texture between idle/breath and also bobs it via livingMarkers. */
  private merchantMarkers: { gameObject: Phaser.GameObjects.Image; merchant: MerchantDefinition }[] = [];

  constructor() {
    super("FloorScene");
  }

  create(): void {
    playMusic(this.sound, GAME_MUSIC_KEY);

    this.ctx = this.registry.get("ctx") as GameContext;
    this.canMove = true;
    // 021: field initializers only run once per scene instance, but Phaser reuses this same
    // instance across scene.restart() — reset explicitly, same reason canMove is reset above.
    this.heldDirection = null;
    this.lastHeldMoveAt = 0;
    this.playerFacing = "front";
    this.playerMovingUntil = null;

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
      // 021 US1: start (or switch) the held-repeat direction; update() continues firing this
      // direction every HELD_MOVE_COOLDOWN_MS for as long as the key stays down.
      //
      // 2026-09-30 fix (research R13 follow-up): only arm it if the move didn't just open a
      // blocking overlay (combat, merchant dialogue, pause menu) — those already set
      // `canMove = false` and their own `heldDirection = null` synchronously inside
      // `attemptMove` above, but this assignment ran unconditionally *after* that call and
      // silently re-armed the just-cleared direction. Since the keyup for this very press
      // arrives after the overlay has paused the scene (and paused scenes don't process
      // Phaser input), that stale direction was never cleared — so the instant the overlay's
      // `canMove` flag flipped back to true on close, update()'s held-repeat check re-fired
      // this exact move and reopened the same overlay immediately. This is what made the
      // merchant dialogue look impossible to close: it never stayed closed for more than one
      // frame after a single tap into the merchant's tile.
      if (this.canMove) {
        this.heldDirection = direction;
        this.lastHeldMoveAt = this.time.now;
      }
    });
    // 021 US1 (contract C7): only clears heldDirection if the released key matches the
    // currently active direction — a stale, already-superseded key's release must not affect
    // whichever direction is currently in control (last-key-wins).
    this.input.keyboard!.on("keyup", (event: KeyboardEvent) => {
      const direction = this.directionFromKey(event.key);
      if (direction && direction === this.heldDirection) this.heldDirection = null;
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
        resumeMusic();
      },
      onRestart: () => {
        ctx.save = resumeFromCheckpoint(ctx.save, ctx.currentFloor);
        ctx.persist();
        this.scene.stop("PauseMenuScene");
        this.scene.resume();
        // resumeMusic must run before scene.restart — create's playMusic call treats a paused
        // track as a switch and restarts it from the beginning otherwise (contract C5).
        resumeMusic();
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
    // 021 US1 (contract C3): pause never touches canMove (it stops input dispatch entirely
    // instead), so held-repeat state needs its own explicit clear here — otherwise a key still
    // physically down when the menu closes would resume movement without a fresh press.
    this.heldDirection = null;
    this.scene.launch("PauseMenuScene", data);
    this.scene.pause();
    pauseMusic();
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

  /** 021 US1: `cooldownMs` defaults to the single-tap cooldown (contract C1, unchanged) — the
   * held-repeat call site in update() passes HELD_MOVE_COOLDOWN_MS instead (contract C2).
   * Without this, every call re-locked canMove for the full 160ms regardless of trigger source,
   * which would have capped held movement at the same rate as tapping instead of doubling it. */
  private attemptMove(direction: CardinalDirection, cooldownMs: number = MOVE_COOLDOWN_MS): void {
    const ctx = this.ctx;
    if (ctx.save.hasWon || ctx.save.isDead) return;

    this.canMove = false;
    this.time.delayedCall(cooldownMs, () => {
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

    // 023 (contract C9): a merchant intercepts the move before it commits, exactly like an
    // enemy — the player never steps onto its tile, and the shop opens instead of combat.
    const merchant = findMerchantAt(floor, target);
    if (merchant) {
      this.openShop();
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
      playSfx(this.sound, sfxError);
      return;
    }

    // Movement is allowed.
    ctx.save.currentFloorState = updatePlayerPosition(progress, target);
    // 021 US2 (contract C5): facing updates on every tile actually entered, even one that
    // immediately triggers combat/pickup/hazard below — the character visibly turns to face
    // that direction even if the resulting overlay then pauses the scene. Reusing
    // MOVE_COOLDOWN_MS as the "still mid-step" window means a single tap briefly shows a walk
    // frame before settling to idle, and continuous holding (which re-triggers this every
    // HELD_MOVE_COOLDOWN_MS) never lets the window lapse, so there's no idle flicker mid-hold.
    this.playerFacing = facingForDirection(direction);
    this.playerMovingUntil = this.time.now + MOVE_COOLDOWN_MS;

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
      const beforeDoorOpen = ctx.save.currentFloorState;
      const update = applyDoorOpen(ctx.save.currentFloorState, ctx.save.character, door);
      if (update.floorProgress !== beforeDoorOpen) {
        playSfx(this.sound, sfxDoor);
      }
      ctx.save.currentFloorState = update.floorProgress;
      ctx.save.character = update.character;
    }
    const currentLeverEffects = lever
      ? resolveLeverEffects(floor, ctx.save.currentFloorState.toggledLeverIds)
      : leverEffects;

    const collected = new Set(ctx.save.currentFloorState.collectedItemIds);
    const item = findAvailableItemAt(floor, target, collected);
    if (item) {
      ctx.save.character = applyItemPickup(ctx.save.character, item);
      ctx.save.currentFloorState = markItemCollected(ctx.save.currentFloorState, item.id);
      const pickupSfxKey = itemKindToSfxKey(item.kind);
      if (pickupSfxKey) playSfx(this.sound, pickupSfxKey);
      // 022 US1: every pickup kind is announced only in the event log — no blocking banner,
      // so every branch logs directly instead of deferring to a pickup-modal queue. A catalog
      // miss (018 FR-022 save compatibility) skips the log entry rather than logging a blank
      // label; that's pre-existing behavior, unchanged here.
      if (item.kind === "currency") {
        ctx.logPickup("currency", `${item.payload} gold`);
      } else if (item.kind === "weapon") {
        const weapon = ctx.weaponCatalog.get(item.payload as WeaponId);
        if (weapon) ctx.logPickup("weapon", weapon.name);
      } else if (item.kind === "armor") {
        const pickup = item.payload as ArmorPickupPayload;
        const armor = ctx.armorCatalog.get(`${pickup.material}:${pickup.slot}`);
        if (armor) ctx.logPickup("armor", armor.name);
      } else if (item.kind === "key") {
        const key = item.payload as KeyDefinition;
        ctx.logPickup("key", `${key.keyType} key`);
      } else if (item.kind === "potion") {
        ctx.logPickup("potion", "Health Potion");
      } else if (item.kind === "potionAttack") {
        ctx.logPickup("potion", "Attack Potion");
      } else if (item.kind === "potionDefense") {
        ctx.logPickup("potion", "Defense Potion");
      } else if (item.kind === "chest") {
        const reward = item.payload as ChestReward;
        if (reward.kind === "currency") {
          ctx.logPickup("currency", `${reward.amount} gold`);
        } else {
          ctx.logPickup("potion", "Health Potion");
        }
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

    this.checkFloorCompletion(target);
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

  /** 027 FR-001 (contract C1): every living monster can be fought — there is no pre-combat
   * simulation and no "too weak" refusal any more. The battle itself runs live in CombatOverlay. */
  private engage(enemy: EnemyDefinition): void {
    const ctx = this.ctx;

    // 021 US1 (contract C3): combat pauses the scene — clear held-repeat state for the same
    // reason as the pickup-modal and pause-menu branches.
    this.heldDirection = null;
    this.canMove = false;
    // 019 FR-003: resolve the display name here, once, rather than teaching CombatOverlay to
    // look it up — mirrors the species lookup already used for enemy rendering above.
    const species = ctx.monsterSpeciesCatalog.get(enemy.species);
    const enemyName = species?.name ?? "Unknown creature";
    const character = ctx.save.character;
    const stats = computeEffectiveStats(character, ctx.weaponCatalog, ctx.armorCatalog);

    const data: CombatOverlayData = {
      floorNumber: ctx.tower.floors.findIndex((f) => f.id === ctx.save.currentFloorId) + 1,
      enemyName,
      player: {
        hp: character.currentHp,
        attack: stats.damage,
        defence: stats.defence,
        attackIntervalSec: stats.attackIntervalSec,
        critChance: stats.critChance,
        critDamageBonus: stats.critDamageBonus,
      },
      // FR-032 (research R6): authored damage × species interval; floor data is untouched.
      monster: monsterCombatant(enemy.stats, species),
      playerMaxHp: computeMaxHp(character),
      potionCount: character.potionCount ?? 0,
      playerTextureKey: ensurePlayerTexture(this, this.playerTier(), "right", "idle"),
      // 030 (research R10): the side profile, facing the Prince, for both the intro and the duel.
      // The floor marker keeps the front sprite (addTextureMarker below).
      monsterTextureKey: species ? ensureMonsterCombatTexture(this, species.textureKey, "idle") : "__MISSING",
      monsterSpeciesKey: species?.textureKey ?? "__MISSING",
      dropPhrases: describeDrops(enemy.drops),
      onBattleEnd: (result) => applyBattleResult(ctx, enemy, enemyName, result),
      onContinue: (outcome) => this.onBattleContinue(enemy, outcome),
    };
    // 029 (C1, C6, C11): the intro plays first; the fight and the combat track start together
    // when it clears. The floor track plays on underneath it (C10). onBattleContinue switches
    // back — both halves of the music switch live here (028 research R9).
    const intro: CombatIntroData = {
      floorNumber: data.floorNumber,
      enemyName,
      playerTextureKey: data.playerTextureKey,
      monsterTextureKey: data.monsterTextureKey,
      onComplete: () => {
        this.scene.stop("CombatIntroScene");
        playMusic(this.sound, COMBAT_MUSIC_KEY);
        this.scene.launch("CombatOverlay", data);
      },
    };
    this.scene.launch("CombatIntroScene", intro);
    this.scene.pause();
  }

  /** 023 (contract C9/C10): mirrors engage()'s launch/pause pattern. Clearing heldDirection
   * stops a held key from reopening the shop the instant it closes while still physically down.
   *
   * 2026-09-30 amendment (research R19, contract C17): `getOptions` is a closure over
   * `ctx.save.character`, re-evaluated fresh every time `NpcDialogueScene` calls it (on open and
   * after every purchase) — this scene never rebuilds or relaunches the dialogue itself. */
  private openShop(): void {
    this.heldDirection = null;
    this.canMove = false;
    const ctx = this.ctx;
    const onPurchase = (id: UpgradeId): void => {
      const before = ctx.save.character;
      const price = priceFor(before, id);
      const after = applyUpgradePurchase(before, id);
      // Unaffordable options are disabled in the dialogue (FR-010) and never reach here; this
      // guard is defense-in-depth against the domain-level no-op, not a reachable UI path.
      if (after === before) return;
      ctx.save.character = after;
      ctx.persist();
      ctx.logPurchase(UPGRADES[id].label, price);
    };
    const data: NpcDialogueData = {
      npcName: "Merchant",
      portrait: { idleKey: "merchantIdle", breathKey: "merchantBreath" },
      lines: [MERCHANT_GREETING],
      getOptions: () => buildMerchantOptions(ctx.save.character, onPurchase),
      onClose: () => {
        // 2026-09-30 amendment (research R13, contract C18): the missing `stop` call here was
        // the actual defect behind "cannot exit the merchant" / "Esc opens the pause menu" —
        // without it, this scene's `shutdown` never fires, so its DOM controls never get
        // removed while `canMove` is already restored below.
        this.scene.stop("NpcDialogueScene");
        this.scene.resume();
        this.canMove = true;
      },
    };
    this.scene.launch("NpcDialogueScene", data);
    this.scene.pause();
  }

  /** 027: leaves the modal — Continue on a victory/defeat panel, or immediately after fleeing. */
  private onBattleContinue(enemy: EnemyDefinition, outcome: BattleEndOutcome): void {
    // 028 US3 (C13/C14): before the end-screen branch, so death/win screens get the floor track.
    playMusic(this.sound, GAME_MUSIC_KEY);
    this.scene.stop("CombatOverlay");
    this.scene.resume();

    const toDeath = outcome === "defeat";
    const toWin = outcome === "victory" && isWinningDefeat(enemy);
    if (toDeath || toWin) {
      // As in applyPlayerDamage: the side panel/event log are DOM text above the whole canvas,
      // so they must be stopped explicitly rather than hidden behind the next scene.
      this.scene.stop("SidePanelScene");
      this.scene.stop("EventLogScene");
      this.scene.start(toDeath ? "DeathScreenScene" : "WinScreenScene");
      return;
    }

    this.canMove = true;
    this.redraw();
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
    this.merchantMarkers = [];

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
        // 014 FR-010: weapon/armor pickups render at ~70% of the tile (Assumptions —
        // weapons follow armor's ratio, since both are equipment rather than small icons).
        const weapon = ctx.weaponCatalog.get(item.payload as WeaponId);
        if (weapon) marker = this.addTextureMarker(item.position, weapon.textureKey, 0.7);
      } else if (item.kind === "armor") {
        const pickup = item.payload as ArmorPickupPayload;
        const armor = ctx.armorCatalog.get(`${pickup.material}:${pickup.slot}`);
        if (armor) marker = this.addTextureMarker(item.position, armor.textureKey, 0.7);
      } else if (item.kind === "currency") {
        // 014 FR-010: currency renders as a small icon at ~50% of the tile.
        marker = this.addTextureMarker(item.position, "coin", 0.5);
      } else if (item.kind === "potion") {
        marker = this.addTextureMarker(item.position, "potion", 0.7);
      } else if (item.kind === "potionAttack") {
        marker = this.addTextureMarker(item.position, "potionAttack", 0.7);
      } else if (item.kind === "potionDefense") {
        marker = this.addTextureMarker(item.position, "potionDefense", 0.7);
      } else if (item.kind === "chest") {
        marker = this.addTextureMarker(item.position, "chest", 0.8);
      } else if (item.kind === "key") {
        // 006 FR-008: real key art, keyed by tier (via KEY_TEXTURE_KEYS); a tier with no baked
        // icon yet falls back to the plain colored marker rather than fabricating new art (FR-007).
        const key = item.payload as KeyDefinition;
        const textureKey = KEY_TEXTURE_KEYS[key.keyType];
        marker = textureKey
          ? this.addTextureMarker(item.position, textureKey, 0.7) // 014 FR-010: icon
          : this.addMarker(item.position, COLORS.key, 0.7);
      } else {
        // item.kind === "loot" (006 FR-009): real art for ids with a baked icon (LOOT_TEXTURE_KEYS),
        // falling back to the plain colored marker for any other loot id (FR-007).
        const loot = item.payload as LootItem;
        const textureKey = LOOT_TEXTURE_KEYS[loot.id];
        marker = textureKey
          ? this.addTextureMarker(item.position, textureKey, 0.8)
          : this.addMarker(item.position, COLORS.loot, 0.8);
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

    for (const merchant of floor.merchants ?? []) {
      const marker = this.addTextureMarker(merchant.position, "merchantIdle", 0.8);
      this.merchantMarkers.push({ gameObject: marker, merchant });
      this.livingMarkers.push({
        gameObject: marker,
        baseY: marker.y,
        phase: computePositionPhase(merchant.position),
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

  /** 021 US1: repeat-fires attemptMove for the currently held direction every
   * HELD_MOVE_COOLDOWN_MS. Naturally stops while an overlay is open — Phaser doesn't call
   * update() on a paused scene, so this loop freezes for free during combat/pickup/pause,
   * exactly like the bob/spike/lava effects below already do (research.md R5).
   * 008: applies the shared idle bob to every tracked living-entity marker (monsters only —
   * the player is excluded, see the field comment above) each frame.
   * 007 US1: swaps each spike pit's texture to match its current cycle segment.
   * 007 US2: swaps each lava tile's texture between its base and glow frames. */
  override update(time: number): void {
    if (this.heldDirection && this.canMove && time - this.lastHeldMoveAt >= HELD_MOVE_COOLDOWN_MS) {
      this.attemptMove(this.heldDirection, HELD_MOVE_COOLDOWN_MS);
      this.lastHeldMoveAt = time;
    }
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
    // 023 US2 (contract C11): the same idle-breathing frame swap as the player, applied to
    // every merchant marker. Bobbing already happens for free via the livingMarkers loop above.
    for (const { gameObject } of this.merchantMarkers) {
      const frame = computeMerchantIdleFrame(time);
      const textureKey = ensureSpriteTexture(this, frame === "idle" ? "merchantIdle" : "merchantBreath");
      if (gameObject.texture.key !== textureKey) gameObject.setTexture(textureKey);
    }
    // 021 US2 (contract C4): walk animation while still "mid-step" (playerMovingUntil in the
    // future), otherwise the idle-breathing loop (this feature's clarification).
    if (this.playerSprite) {
      const moving = time < (this.playerMovingUntil ?? 0);
      const frame = moving ? computePlayerWalkFrame(time) : computePlayerIdleFrame(time);
      const key = ensurePlayerTexture(this, this.playerTier(), this.playerFacing, frame);
      if (this.playerSprite.texture.key !== key) this.playerSprite.setTexture(key);
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

    // 021 US2: seed with the idle frame for the current facing — update() corrects to the
    // walk frame on the very next tick if the move that triggered this redraw is still active.
    const key = ensurePlayerTexture(this, this.playerTier(), this.playerFacing, "idle");
    this.playerSprite = this.add.image(px, py, key);
    this.playerSprite.setDisplaySize(displaySize, displaySize);
    this.tileLayer.add(this.playerSprite);
  }
}
