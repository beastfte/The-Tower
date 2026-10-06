import { resolveHit } from "./resolveAttack";
import type { CombatStats } from "../types";
import type { MonsterSpecies } from "../floor/types";

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
}

export interface Combatant extends CombatantStats {
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
  | { kind: "heal"; amount: number };

export interface BattleStep {
  state: BattleState;
  events: BattleEvent[];
}

/** Guards against a zero/negative interval looping forever. Far below any shipped value. */
const MIN_INTERVAL_SEC = 0.01;
/** Overshoots this close together count as the same instant (FR-007's tie). */
const TIE_EPSILON = 1e-9;

/** Used when an enemy's species isn't in the catalog (FR-031). */
export const MONSTER_COMBAT_FALLBACK = { attackIntervalSec: 1, critChance: 0.05, critDamageBonus: 0 } as const;

/**
 * 027 FR-032 (research R6, contract C6): a placement's authored `stats.damage` is its damage
 * per second, so its per-hit attack is that × its species interval. Its raw DPS is therefore
 * unchanged by the revamp for every placement, and the generated floor files stay untouched.
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
  };
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

  for (;;) {
    const playerOvershoot = player.charge - player.attackIntervalSec;
    const monsterOvershoot = monster.charge - monster.attackIntervalSec;
    if (playerOvershoot < 0 && monsterOvershoot < 0) break;

    const playerFirst = playerOvershoot >= monsterOvershoot - TIE_EPSILON;
    const attacker = playerFirst ? player : monster;
    const defender = playerFirst ? monster : player;

    attacker.charge -= attacker.attackIntervalSec;
    const isCrit = rng() < attacker.critChance;
    const damage = resolveHit(attacker, defender, isCrit);
    defender.hp = Math.max(0, defender.hp - damage);
    events.push({ kind: "hit", target: playerFirst ? "monster" : "player", damage, isCrit });

    if (defender.hp === 0) {
      outcome = playerFirst ? "victory" : "defeat";
      break;
    }
  }

  return { state: { ...state, player, monster, outcome }, events };
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
  const heal = Math.min(Math.ceil(playerMaxHp * 0.25), playerMaxHp - player.hp);
  return {
    state: { ...state, player: { ...player, hp: player.hp + heal }, potionCount: potionCount - 1 },
    events: [{ kind: "heal", amount: heal }],
  };
}
