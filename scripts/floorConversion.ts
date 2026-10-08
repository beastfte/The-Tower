import type {
  FloorDefinition,
  EnemyDefinition,
  ItemDefinition,
  KeyedDoorDefinition,
  HazardTileDefinition,
  SpikePitDefinition,
  LavaTileDefinition,
  LeverDefinition,
  WaterTileDefinition,
  CrackedWallDefinition,
  WallZoneOverride,
  ZoneThemeId,
  MerchantDefinition,
} from "../src/domain/floor/types";
import type { Position, Tile } from "../src/domain/types";
import { positionKey } from "../src/domain/types";

/**
 * The wire shape flowing both directions across the tool/repo boundary
 * (contracts/tower-export-schema.md). Extends that contract's documented field list with
 * `crackedWalls`/`zone`/`wallZoneOverrides` — `FloorDefinition` fields added by
 * feature 013 after the 012 contract docs were written. Omitting them here would silently
 * drop any existing floor's cracked walls/zone overrides on every import/export
 * round-trip (`floor-01` uses them) — a documentation gap relative to plan.md's own
 * stated intent ("exports the exact same `FloorDefinition` shape"), not a deliberate
 * exclusion, so this module completes the round-trip rather than following the stale list
 * literally.
 */
export interface FloorExport {
  id: string;
  order: number;
  width: number;
  height: number;
  /** walls[y][x] === true means blocked. */
  walls: boolean[][];
  entrance: Position;
  exit: Position;
  enemies: EnemyDefinition[];
  items: ItemDefinition[];
  keyedDoors: KeyedDoorDefinition[];
  hazardTiles: HazardTileDefinition[];
  spikePits: SpikePitDefinition[];
  lavaTiles: LavaTileDefinition[];
  levers: LeverDefinition[];
  waterTiles: WaterTileDefinition[];
  crackedWalls: CrackedWallDefinition[];
  zone?: ZoneThemeId;
  wallZoneOverrides: WallZoneOverride[];
  /** 023: optional like `zone`, unlike every other content array — omitted entirely for a
   * floor with no merchant rather than serialized as `[]`. */
  merchants?: MerchantDefinition[];
}

export interface TowerExport {
  floors: FloorExport[];
}

/** `FloorExport` -> `FloorDefinition`: reconstructs `grid: Tile[][]` from
 * `width`/`height`/`walls` directly. No intermediate `rowFromPattern` string is needed for
 * this JSON<->runtime conversion — that ASCII-row style (research.md #4) is purely a
 * source-file styling choice, applied only when *writing* a floor's `.ts` file
 * (`wallsToPatternRows` below), not part of building the `FloorDefinition` value used for
 * validation. */
export function floorExportToDefinition(fe: FloorExport): FloorDefinition {
  // A water tile always blocks its own cell — authors place it directly on a walkable tile
  // rather than having to separately mark that cell blocked in `walls` (invariant 10 is
  // satisfied by construction here, not by requiring the raw export to already encode it).
  const waterPositions = new Set(fe.waterTiles.map((w) => positionKey(w.position)));
  const grid: Tile[][] = Array.from({ length: fe.height }, (_, y) =>
    Array.from({ length: fe.width }, (_, x) => ({
      walkable: !(fe.walls[y]?.[x] ?? true) && !waterPositions.has(positionKey({ x, y })),
    })),
  );
  const def: FloorDefinition = {
    id: fe.id,
    grid,
    entrance: fe.entrance,
    exit: fe.exit,
    // 034 FR-020: monster drops are rolled, not authored; a stale export's `drops` is dropped.
    enemies: fe.enemies.map(({ drops: _drops, ...enemy }: EnemyDefinition & { drops?: unknown }) => enemy),
    // A tool export may omit `payload` entirely for a payload-less item kind (e.g. a plain
    // "potion"), but `ItemDefinition.payload` is a required key (its value, not its presence,
    // is optional — `undefined` is one of `ItemPayload`'s member types). Normalize so the key
    // always exists; otherwise a synced floor file compiles a `{ id, position, kind }` literal
    // TS2741-rejects for missing `payload`.
    items: fe.items.map((item) => ({ ...item, payload: item.payload })),
    keyedDoors: fe.keyedDoors,
    hazardTiles: fe.hazardTiles,
    spikePits: fe.spikePits,
    lavaTiles: fe.lavaTiles,
    levers: fe.levers,
    waterTiles: fe.waterTiles,
    crackedWalls: fe.crackedWalls,
    wallZoneOverrides: fe.wallZoneOverrides,
  };
  if (fe.zone) def.zone = fe.zone;
  if (fe.merchants) def.merchants = fe.merchants;
  return def;
}

/** `FloorDefinition` -> `FloorExport`, the inverse conversion. `order` has no equivalent on
 * `FloorDefinition` (the game only has array position in `TOWER.floors`), so the caller
 * supplies it — `export-existing-floors.ts` passes each floor's index in `TOWER.floors`. */
export function floorDefinitionToExport(def: FloorDefinition, order: number): FloorExport {
  const height = def.grid.length;
  const width = def.grid[0]?.length ?? 0;
  const walls = def.grid.map((row) => row.map((tile) => !tile.walkable));
  const fe: FloorExport = {
    id: def.id,
    order,
    width,
    height,
    walls,
    entrance: def.entrance,
    exit: def.exit,
    enemies: def.enemies,
    items: def.items,
    keyedDoors: def.keyedDoors,
    hazardTiles: def.hazardTiles,
    spikePits: def.spikePits,
    lavaTiles: def.lavaTiles,
    levers: def.levers,
    waterTiles: def.waterTiles,
    crackedWalls: def.crackedWalls,
    wallZoneOverrides: def.wallZoneOverrides,
  };
  if (def.zone) fe.zone = def.zone;
  if (def.merchants) fe.merchants = def.merchants;
  return fe;
}

/** Renders a `walls` grid back into the same `rowFromPattern("####...")` ASCII-row style
 * already used by every hand-authored floor (`src/data/floors/gridHelpers.ts`,
 * research.md #4) — one string per row, for generating a floor's `.ts` source text. */
export function wallsToPatternRows(walls: boolean[][]): string[] {
  return walls.map((row) => row.map((blocked) => (blocked ? "#" : ".")).join(""));
}
