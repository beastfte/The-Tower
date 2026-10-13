import { resolveHit } from "./resolveAttack";
import type { CombatStats } from "../types";
import type { MonsterSpecies } from "../floor/types";
import { eliteStats } from "../character/grades";

/**
 * 027 (research R1/R2): a live battle as pure data. The modal scene feeds it elapsed time and a
 * random source each frame and renders the events it returns; it never reads the clock or
 * `Math.random` itself, so every rule here is unit-testable with fixed inputs.
 */

export type Side = "player" | "monster";
export type BattleOutcome = "ongoing" | "victory" | "defeat" | "fled";

/** Everything a combatant brings into a battle. For a monster, `attack` is already scaled by
 * its species interval (research R6). */
export interface CombatantStats {
  hp: number;
  attack: number;
  defence: number;
  attackIntervalSec: number;
  critChance: number;
  critDamageBonus: number;
  /** 032: chance (0-1) an incoming attack is dodged outright. */
  dodgeChance: number;
}

interface Combatant extends CombatantStats {
  /** Seconds accumulated toward the next attack. Starts at 0 (FR-006). */
  charge: number;
}

export interface BattleState {
  player: Combatant;
  monster: Combatant;
  playerMaxHp: number;
  potionCount: number;
  outcome: BattleOutcome;
}

export type BattleEvent =
  | { kind: "hit"; target: Side; damage: number; isCrit: boolean }
  /** 032 C1: the attack was avoided entirely; `target` is the side that dodged. */
  | { kind: "dodge"; target: Side }
  /** 038: `auto` marks a potion the battle drank itself (HP fell under 25% after a monster hit). */
  | { kind: "heal"; amount: number; auto?: true };

interface BattleStep {
  state: BattleState;
  events: BattleEvent[];
}

/** Guards against a zero/negative interval looping forever. Far below any shipped value. */
const MIN_INTERVAL_SEC = 0.01;
/** Overshoots this close together count as the same instant (FR-007's tie). */
const TIE_EPSILON = 1e-9;

/** Used when an enemy's species isn't in the catalog (FR-031). The validator rejects unknown
 * species, so this only guards hand-built data. */
const MONSTER_COMBAT_FALLBACK = {
  baselineStats: { damage: 1, defence: 0, hp: 1 },
  attackIntervalSec: 1,
  critChance: 0.05,
  critDamageBonus: 0,
  dodgeChance: 0.1,
} as const;

/**
 * 027 FR-032 (research R6, contract C6): `stats.damage` is damage per second, so the per-hit
 * attack is that × the species interval. Every monster stat comes from its species in code;
 * floors only say which species stands where and whether it is elite.
 */
export function monsterCombatant(stats: CombatStats, species: MonsterSpecies | undefined): CombatantStats {
  const speed = species ?? MONSTER_COMBAT_FALLBACK;
  return {
    hp: stats.hp,
    attack: stats.damage * speed.attackIntervalSec,
    defence: stats.defence,
    attackIntervalSec: speed.attackIntervalSec,
    critChance: speed.critChance,
    critDamageBonus: speed.critDamageBonus,
    dodgeChance: speed.dodgeChance,
  };
}

/** 038 FR-005: floor 1 is 100%, each later floor ×1.1; HP, per-hit attack and defence always round up. */
const FLOOR_SCALE = 1.1;
const ROUND_UP_TOLERANCE = 1e-9; // 20 × 1.1 is 22.000000000000004 in floating point

/**
 * 038 C1: the one place a fight's monster stats are built — elite ×1.5 on the stored damage per
 * second, then per-hit attack, then the floor multiplier. Attack speed, crit and dodge never scale.
 */
export function monsterOnFloor(
  species: MonsterSpecies | undefined,
  isElite: boolean | undefined,
  floorNumber: number,
): CombatantStats {
  const base = monsterCombatant(eliteStats((species ?? MONSTER_COMBAT_FALLBACK).baselineStats, isElite), species);
  const multiplier = FLOOR_SCALE ** (Math.max(1, floorNumber) - 1);
  const scale = (v: number) => Math.max(0, Math.ceil(v * multiplier - ROUND_UP_TOLERANCE)) + 0; // + 0: no -0
  return { ...base, hp: scale(base.hp), attack: scale(base.attack), defence: scale(base.defence) };
}

export function startBattle(
  player: CombatantStats,
  monster: CombatantStats,
  playerMaxHp: number,
  potionCount: number,
): BattleState {
  const prepare = (c: CombatantStats): Combatant => ({
    ...c,
    attackIntervalSec: Math.max(MIN_INTERVAL_SEC, c.attackIntervalSec),
    charge: 0,
  });
  return {
    player: prepare(player),
    monster: prepare(monster),
    playerMaxHp,
    potionCount,
    outcome: "ongoing",
  };
}

/**
 * Advances both attack bars by `elapsedSec` and resolves every attack that fell due, in the
 * order they fell due (contract C2): the combatant whose bar overshot *more* filled earlier, and
 * an exact tie goes to the player (C3, FR-007). Overshoot is carried, so the long-run rate is
 * exact regardless of frame rate (SC-008). The battle ends the moment either HP reaches 0, and
 * nothing resolves after that, even an attack due on the same frame (C3, FR-009).
 */
export function advanceBattle(
  state: BattleState,
  elapsedSec: number,
  rng: () => number,
): BattleStep {
  if (state.outcome !== "ongoing" || elapsedSec <= 0) return { state, events: [] };

  const player = { ...state.player, charge: state.player.charge + elapsedSec };
  const monster = { ...state.monster, charge: state.monster.charge + elapsedSec };
  const events: BattleEvent[] = [];
  let outcome: BattleOutcome = "ongoing";
  let potionCount = state.potionCount;

  for (;;) {
    const playerOvershoot = player.charge - player.attackIntervalSec;
    const monsterOvershoot = monster.charge - monster.attackIntervalSec;
    if (playerOvershoot < 0 && monsterOvershoot < 0) break;

    const playerFirst = playerOvershoot >= monsterOvershoot - TIE_EPSILON;
    const attacker = playerFirst ? player : monster;
    const defender = playerFirst ? monster : player;

    attacker.charge -= attacker.attackIntervalSec;
    // 032 C1: dodge is decided first, so a dodged attack never rolls a crit or deals damage.
    if (rng() < defender.dodgeChance) {
      events.push({ kind: "dodge", target: playerFirst ? "monster" : "player" });
      continue;
    }
    const isCrit = rng() < attacker.critChance;
    const damage = resolveHit(attacker, defender, isCrit);
    // Fractional damage: treat a floating-point sliver as dead rather than alive at 0.0000001.
    defender.hp = defender.hp - damage < 1e-6 ? 0 : defender.hp - damage;
    events.push({ kind: "hit", target: playerFirst ? "monster" : "player", damage, isCrit });

    if (defender.hp === 0) {
      outcome = playerFirst ? "victory" : "defeat";
      break;
    }

    // 038 C2: a monster's hit that leaves the player under 25% drinks one carried potion at once.
    if (!playerFirst && potionCount > 0 && player.hp < state.playerMaxHp * 0.25) {
      const amount = potionHeal(player.hp, state.playerMaxHp);
      player.hp += amount;
      potionCount -= 1;
      events.push({ kind: "heal", amount, auto: true });
    }
  }

  return { state: { ...state, player, monster, potionCount, outcome }, events };
}

/** 027 FR-047: a potion heals ceil(25% of max HP), capped at max. Shared by manual and automatic use. */
export function potionHeal(hp: number, maxHp: number): number {
  return Math.min(Math.ceil(maxHp * 0.25), maxHp - hp);
}

/** 027 FR-019/FR-020 (contract C13): ends the battle at once. HP is left exactly as it stood —
 * nothing lands after the flee and nothing is refunded. Ignored once the battle has ended. */
export function flee(state: BattleState): BattleState {
  if (state.outcome !== "ongoing") return state;
  return { ...state, outcome: "fled" };
}

/**
 * 027 FR-047–FR-049 (contract C17): drinks one carried potion, healing ceil(25% of max HP),
 * capped at max. Refuses (returns the same state, no event) with no potions, at full HP, or once
 * the battle has ended. Takes effect immediately and never touches either attack bar. Called from
 * a click handler between frames, so it always resolves before any hit due on the next frame.
 */
export function drinkPotion(state: BattleState): BattleStep {
  const { player, playerMaxHp, potionCount } = state;
  if (state.outcome !== "ongoing" || potionCount <= 0 || player.hp >= playerMaxHp) {
    return { state, events: [] };
  }
  const heal = potionHeal(player.hp, playerMaxHp);
  return {
    state: { ...state, player: { ...player, hp: player.hp + heal }, potionCount: potionCount - 1 },
    events: [{ kind: "heal", amount: heal }],
  };
}
