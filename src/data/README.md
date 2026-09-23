# Floor Content Authoring Guide

This directory holds the tower's fixed content (`FR-002`, `FR-013`). Add a new floor as a new
`floor-XX.ts` module exporting a `FloorDefinition` (see
`../../specs/001-fantasy-tower-adventure/contracts/floor-data-contract.md`), then register it in
`floors/index.ts`'s `createTower([...])` call in the order it should appear in the tower — or
use the visual authoring path below instead of hand-writing the TypeScript directly.

## Visual authoring (the Tower Mapping Tool, feature 012)

Every file in `floors/` can also be produced from **Tower Cartographer**
(`tools/tower-mapping-tool/index.html`), a standalone visual floor-design tool published as a
Claude Artifact — draw a floor's walls and open space on a grid, place monsters/items/doors/
hazards/levers with a palette, and see the result immediately instead of writing it as code.
See `specs/012-tower-mapping-tool/quickstart.md` for the full walkthrough. In short:

- **Design → game**: design a floor in the tool, use its "Export tower" action, then run
  `npm run sync-tower -- <path-to-export.json>`. This regenerates every `floor-*.ts` file (and
  `floors/index.ts`) in the export from scratch — it re-validates everything first
  (`validateFloorDefinition`/`validateTower`, unmodified) and writes nothing at all if any
  floor fails an integrity check (an unobtainable key, no end boss, etc.); the CLI prints
  every problem found instead.
- **Game → design** (bringing a hand-authored floor like `floor-01`/`floor-final` under the
  tool's management): run `npm run export-existing-floors -- <output-path.json>`, then use the
  tool's "Import tower" action on that file. From then on, syncing regenerates that floor's
  file too — any hand-authored content the tool's data model can't represent (e.g. a narrative
  comment) does not survive the first sync after importing.
- The tool's own palette (monster species, weapons, armor materials/slots, door/key tiers,
  lever effect kinds) is generated from this directory's own source catalogs — run
  `npm run sync-tool-palette` after adding or changing any of `monsterSpecies.ts`, `weapons.ts`,
  `armorPieces.ts`, or the `DOOR_KEY_TIERS`/`LEVER_EFFECT_KINDS` catalogs in
  `src/domain/character/types.ts`/`src/domain/floor/types.ts`. It refuses to write (and reports
  what would disappear) if a catalog entry the palette currently offers has been renamed or
  removed, rather than silently dropping it — run it and resolve the conflict before continuing.
  Only `ItemKind` stays hand-maintained in the tool's own `ITEM_KINDS` list (no runtime catalog
  to derive it from) — update that one by hand, same as before.

## Art direction (FR-014, FR-015)

- **Visual style**: pixel art / retro 2D. Sprites should be authored at a low, fixed pixel
  resolution (aligned to the 16x16 tile grid used by `FloorScene`) with no anti-aliasing —
  the renderer is configured with `pixelArt: true` and nearest-neighbor filtering
  (`src/game/gameConfig.ts`), so soft/blurred source art will look inconsistent with
  everything else.
- **Tone**: dark fantasy — grim, foreboding, dangerous. Favor desaturated, low-key palettes;
  avoid bright, cheerful, or comedic color schemes and character designs. This applies to
  enemy sprites, floor tilesets, item icons, and any UI/narrative text (including the death
  screen and win screen copy).
- Placeholder rendering: until real sprite sheets are added, `FloorScene` renders most tiles,
  enemies, items, and hazards as a flat-colored rectangle (see the `COLORS` map in
  `src/game/scenes/FloorScene.ts`). Replacing these with real pixel-art sprites is a content
  task, not a logic change — the rendering call sites are already in place. Walls and keyed
  doors are the first exception: they render from real pixel-art sprites lifted from the
  user's reference sheet (`src/game/render/wallSprites.ts`, feature 013 session 4), not a
  flat-colored rectangle.
