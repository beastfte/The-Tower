import { positionKey, type Position } from "../types";
import type { FloorDefinition, MerchantDefinition } from "./types";

/** Returns the merchant at a position, if any. Unlike `findLivingEnemyAt`, there is no
 * "defeated" set to check — a merchant can never be removed (023 FR-004). */
export function findMerchantAt(floor: FloorDefinition, position: Position): MerchantDefinition | undefined {
  return (floor.merchants ?? []).find((m) => positionKey(m.position) === positionKey(position));
}
