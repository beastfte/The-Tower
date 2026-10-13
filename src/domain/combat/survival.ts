import { potionHeal, type CombatantStats } from "./battle";
import { resolveHit } from "./resolveAttack";

/**
 * 038 C5: the exact chance the player wins a fight, never a sample. The order of attacks is fixed
 * by the two attack intervals (the player strikes at k·Ip, the monster at j·Im, a tie goes to the
 * player), and luck only decides each attack's dodge and crit. The player's rolls only move the
 * monster's HP and the monster's rolls (plus auto-potions) only move the player's, so the two
 * processes are independent: work out each one's "dies on attack n" distribution, then merge them
 * on the timeline.
 */
interface Survival {
  win: number;
  lose: number;
}

// ponytail: truncates a tail below 1e-12, stops at 20,000 attacks a side, and keeps only the 4,000
// likeliest HP states per step (a fight of thousands of tiny hits); bucket HP if that ever shows.
const MAX_ATTACKS = 20_000;
const MAX_STATES = 4_000;
const STOP_MASS = 1e-12;
const PRUNE = 1e-15;
const TIE_EPSILON = 1e-9;
const MIN_INTERVAL_SEC = 0.01; // as startBattle clamps it

const stateKey = (hp: number, potions: number) => Math.round(hp * 1e6) * 1024 + Math.min(potions, 1023);

interface Outcome {
  damage: number;
  p: number;
}

/** The three results of one attack: dodged (no damage), normal hit, crit. */
function outcomes(attacker: CombatantStats, defender: CombatantStats): Outcome[] {
  const hit = 1 - defender.dodgeChance;
  return [
    { damage: 0, p: defender.dodgeChance },
    { damage: resolveHit(attacker, defender, false), p: hit * (1 - attacker.critChance) },
    { damage: resolveHit(attacker, defender, true), p: hit * attacker.critChance },
  ].filter((o) => o.p > 0);
}

/** Chance the defender first reaches 0 HP on each of the attacker's attacks (index n−1). */
function deathByAttack(
  attacker: CombatantStats,
  defender: CombatantStats,
  defenderHp: number,
  defenderMaxHp: number,
  potions: number,
  attacks: number,
  drinks: boolean,
): number[] {
  const outs = outcomes(attacker, defender);
  const result: number[] = [];
  // state: (hp, potions left) → probability
  let states = new Map<number, { hp: number; potions: number; p: number }>([
    [stateKey(defenderHp, potions), { hp: defenderHp, potions, p: 1 }],
  ]);
  let alive = 1;
  for (let n = 1; n <= attacks && alive > STOP_MASS; n++) {
    const next = new Map<number, { hp: number; potions: number; p: number }>();
    let died = 0;
    for (const s of states.values()) {
      for (const o of outs) {
        const p = s.p * o.p;
        if (p < PRUNE) continue;
        let hp = s.hp - o.damage < 1e-6 ? 0 : s.hp - o.damage;
        if (hp === 0 && o.damage > 0) {
          died += p;
          continue;
        }
        let left = s.potions;
        if (drinks && o.damage > 0 && left > 0 && hp < defenderMaxHp * 0.25) {
          hp += potionHeal(hp, defenderMaxHp);
          left -= 1;
        }
        const key = stateKey(hp, left);
        const cur = next.get(key);
        if (cur) cur.p += p;
        else next.set(key, { hp, potions: left, p });
      }
    }
    result.push(died);
    if (next.size > MAX_STATES) {
      const keep = [...next].sort((a, b) => b[1].p - a[1].p).slice(0, MAX_STATES);
      next.clear();
      for (const [k, v] of keep) next.set(k, v);
    }
    alive = 0;
    for (const s of next.values()) alive += s.p;
    states = next;
  }
  return result;
}

/** Sum of dist[0 .. count−1] (the first `count` attacks). */
function cumulative(dist: number[], count: number): number {
  let total = 0;
  for (let i = 0; i < Math.min(count, dist.length); i++) total += dist[i]!;
  return total;
}

export function survivalChance(
  player: CombatantStats,
  monster: CombatantStats,
  playerMaxHp: number,
  potionCount: number,
): Survival {
  const ip = Math.max(MIN_INTERVAL_SEC, player.attackIntervalSec);
  const im = Math.max(MIN_INTERVAL_SEC, monster.attackIntervalSec);

  // pm[k−1]: monster dies on the player's k-th attack. pp[j−1]: player dies on the monster's j-th.
  const pm = deathByAttack(player, monster, monster.hp, monster.hp, 0, MAX_ATTACKS, false);
  const monsterAttacksNeeded = Math.min(MAX_ATTACKS, Math.ceil((pm.length * ip) / im) + 1);
  const pp = deathByAttack(monster, player, player.hp, playerMaxHp, potionCount, monsterAttacksNeeded, true);

  let win = 0;
  for (let k = 1; k <= pm.length; k++) {
    // monster attacks strictly before the player's k-th (a tie lands after it)
    const before = Math.max(0, Math.ceil((k * ip - TIE_EPSILON) / im) - 1);
    win += pm[k - 1]! * (1 - cumulative(pp, before));
  }
  let lose = 0;
  for (let j = 1; j <= pp.length; j++) {
    // player attacks at or before the monster's j-th (ties go to the player)
    const upTo = Math.floor((j * im + TIE_EPSILON) / ip);
    lose += pp[j - 1]! * (1 - cumulative(pm, upTo));
  }

  return { win, lose };
}

/** FR-013a: whole-number percent; 100% / 0% only when certain, otherwise ">99%" / "<1%". */
export function formatSurvival({ win, lose }: Survival): string {
  if (win <= 0) return "0%";
  if (lose <= 0) return "100%";
  const pct = Math.round(win * 100);
  if (pct >= 100) return ">99%";
  if (pct <= 0) return "<1%";
  return `${pct}%`;
}
