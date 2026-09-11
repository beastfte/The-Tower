/** Fraction of max HP at or below which the side panel shows a low-HP visual state (002 FR-005). */
const LOW_HP_THRESHOLD = 0.3;

export function isLowHp(currentHp: number, maxHp: number): boolean {
  if (maxHp <= 0) return true;
  return currentHp / maxHp <= LOW_HP_THRESHOLD;
}
