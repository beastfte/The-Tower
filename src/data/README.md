# Floor Content Authoring Guide

This directory holds the tower's fixed, hand-authored content (`FR-002`, `FR-013`). Add a new
floor as a new `floor-XX.ts` module exporting a `FloorDefinition` (see
`../../specs/001-fantasy-tower-adventure/contracts/floor-data-contract.md`), then register it in
`floors/index.ts`'s `createTower([...])` call in the order it should appear in the tower.

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
