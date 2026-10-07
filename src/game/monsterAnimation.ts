/** 030: the sheet's own frame names for `MONSTER_SPRITES[name].left` — sprite vocabulary, like
 * `PlayerFrame`; the combat rules in `domain/combat` never see it. */
export type MonsterCombatFrame = "idle" | "breath" | "attackA" | "attackB";

/** 030 research R4: the sheet's preview steps its attack sequence (`atkSeq`) every 9 animation
 * frames (~60fps), i.e. ~150 ms — the same cadence and conversion as `PLAYER_WALK_FRAME_MS`. The
 * preview holds some frames for 2-3 steps (~1050 ms in all), which would outlast the Bat's 0.6s
 * attack interval, so each frame gets exactly one beat here. */
export const MONSTER_ATTACK_FRAME_MS = 150;

/** Wind-up (the breath pose, as the sheet's own `atkSeq` uses it), swing, then the held strike. */
const ATTACK_SEQUENCE: readonly Exclude<MonsterCombatFrame, "idle">[] = ["breath", "attackA", "attackB"];

/** The instant the held strike first shows — where the Prince's hit feedback lands (FR-005). */
export const MONSTER_ATTACK_IMPACT_MS = MONSTER_ATTACK_FRAME_MS * ATTACK_SEQUENCE.indexOf("attackB");
export const MONSTER_ATTACK_MS = MONSTER_ATTACK_FRAME_MS * ATTACK_SEQUENCE.length;

/** One play-through of the attack, a pure function of elapsed time (the shape of
 * `computePlayerWalkFrame`), or `null` once it is over and the monster should be back at idle. */
export function computeMonsterAttackFrame(elapsedMs: number): Exclude<MonsterCombatFrame, "idle"> | null {
  return ATTACK_SEQUENCE[Math.floor(elapsedMs / MONSTER_ATTACK_FRAME_MS)] ?? null;
}
