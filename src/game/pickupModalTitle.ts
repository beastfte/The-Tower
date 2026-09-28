/** bug fix: potion-banner-mislabeled — the pickup modal's title banner used to hardcode
 * "Health Potion!" for every potion pickup, ignoring which potion (health/attack/defense) was
 * actually collected. `label` already carries the exact name computed by
 * `FloorScene.describeItemPickup`/`describeChestReward`, so the title must be derived from it
 * for potions rather than assumed. Kept as a pure, Phaser-free function so it's unit-testable
 * without a Scene (mirrors `src/game/trapAnimation.ts`'s pattern). */
export function pickupModalTitle(kind: "key" | "potion" | "currency", label: string): string {
  if (kind === "key") return "Key acquired!";
  if (kind === "potion") return `${label}!`;
  return "Gold found!";
}
