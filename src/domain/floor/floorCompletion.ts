import { positionsEqual, type Position } from "../types";
import type { FloorDefinition } from "./types";

/**
 * FR-009: the floor is complete once the player's position reaches its designated
 * exit. Reaching the exit tile is only possible if the path there was actually clear
 * (movement is already gated by compulsory enemies / unmatched keyed doors), so no
 * separate reachability re-check is needed here.
 */
export function hasReachedExit(floor: FloorDefinition, playerPosition: Position): boolean {
  return positionsEqual(playerPosition, floor.exit);
}
