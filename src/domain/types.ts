/** A tile coordinate on a floor's grid. */
export interface Position {
  x: number;
  y: number;
}

/** A single cell of a floor's grid layout. */
export interface Tile {
  walkable: boolean;
}

/** Combat stats shared by the player character and every enemy (FR-012a). */
export interface CombatStats {
  damage: number;
  defence: number;
  hp: number;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function positionKey(p: Position): string {
  return `${p.x},${p.y}`;
}
