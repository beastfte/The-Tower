import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MONSTER_SPECIES } from "../src/data/monsterSpecies";
import { WEAPONS } from "../src/data/weapons";
import { ARMOR_PIECES } from "../src/data/armorPieces";
import { DOOR_KEY_TIERS } from "../src/domain/character/types";
import { LEVER_EFFECT_KINDS, ITEM_KINDS, HAZARD_KINDS, type ItemKind, type HazardKind } from "../src/domain/floor/types";

/** research.md #10-12, FR-018/019/020: the design tool's palette (`tools/tower-mapping-tool/
 * index.html`'s `PALETTE` object, between its GENERATED-PALETTE markers) is generated from the
 * game's own source catalogs by this script instead of hand-maintained — including item kinds
 * and hazard kinds (2026-09-23 gap fix), which previously had no runtime catalog to derive
 * from and so were left as a manually-verified, easy-to-forget category. */

/** Display labels for `ItemKind` — a presentation concern, not gameplay data, so it lives here
 * rather than in domain code (same convention as MONSTER_COLOR/ITEM_COLOR/etc. staying
 * hand-maintained in the tool for already-generated categories). `satisfies Record<ItemKind,
 * string>` makes TypeScript itself fail the build if a new `ItemKind` value is added without a
 * label here — the strongest available guarantee, catching the gap before the FR-019 test even
 * has to run. */
const ITEM_KIND_LABELS = {
  currency: "Currency",
  potion: "Potion (heal)",
  potionAttack: "Potion (attack)",
  potionDefense: "Potion (defense)",
  weapon: "Weapon",
  armor: "Armor piece",
  key: "Key",
  chest: "Chest",
  loot: "Loot (named)",
} satisfies Record<ItemKind, string>;

/** Display labels for `HazardKind` — see `ITEM_KIND_LABELS` above for why this lives here. */
const HAZARD_KIND_LABELS = {
  lava: "Lava tile",
  spike: "Spike pit",
  water: "Water tile",
} satisfies Record<HazardKind, string>;

export interface PaletteManifest {
  monsters: { id: string; name: string; baseline: { damage: number; defence: number; hp: number; dodgeChance: number } }[];
  weapons: { id: string; name: string }[];
  armorMaterials: string[];
  armorSlots: string[];
  doorKeyTiers: string[];
  leverEffectKinds: string[];
  itemKinds: { id: string; name: string }[];
  hazardKinds: { id: string; name: string }[];
}

export function buildPalette(): PaletteManifest {
  return {
    monsters: Object.values(MONSTER_SPECIES).map((m) => ({
      id: m.id,
      name: m.name,
      baseline: { damage: m.baselineStats.damage, defence: m.baselineStats.defence, hp: m.baselineStats.hp, dodgeChance: m.dodgeChance },
    })),
    weapons: Object.values(WEAPONS).map((w) => ({ id: w.id, name: w.name })),
    armorMaterials: [...new Set(Object.values(ARMOR_PIECES).map((p) => p.material))],
    armorSlots: [...new Set(Object.values(ARMOR_PIECES).map((p) => p.slot))],
    doorKeyTiers: [...DOOR_KEY_TIERS],
    leverEffectKinds: [...LEVER_EFFECT_KINDS],
    itemKinds: ITEM_KINDS.map((id) => ({ id, name: ITEM_KIND_LABELS[id] })),
    hazardKinds: HAZARD_KINDS.map((id) => ({ id, name: HAZARD_KIND_LABELS[id] })),
  };
}

/** FR-020's repo-side half: an entry the tool's *current* palette offers that the freshly
 * built palette no longer has would silently vanish from the tool if we overwrote it — refuse
 * instead and name every such entry, mirroring sync-tower.ts's fail-and-report pattern. */
export function findRemovedEntries(oldPalette: PaletteManifest, newPalette: PaletteManifest): string[] {
  const removed: string[] = [];
  // `oldArr` defaults to [] so a palette generated before a new category existed (e.g. this
  // feature's own migration, which added itemKinds/hazardKinds to an older PALETTE) is treated
  // as "had nothing yet" rather than crashing — nothing to report as removed either way.
  const checkObjectArray = (category: string, oldArr: { id: string }[] | undefined, newArr: { id: string }[]) => {
    const newIds = new Set(newArr.map((e) => e.id));
    for (const e of oldArr ?? []) if (!newIds.has(e.id)) removed.push(`${category}: "${e.id}"`);
  };
  const checkStringArray = (category: string, oldArr: string[] | undefined, newArr: string[]) => {
    const newSet = new Set(newArr);
    for (const v of oldArr ?? []) if (!newSet.has(v)) removed.push(`${category}: "${v}"`);
  };
  checkObjectArray("monsters", oldPalette.monsters, newPalette.monsters);
  checkObjectArray("weapons", oldPalette.weapons, newPalette.weapons);
  checkStringArray("armorMaterials", oldPalette.armorMaterials, newPalette.armorMaterials);
  checkStringArray("armorSlots", oldPalette.armorSlots, newPalette.armorSlots);
  checkStringArray("doorKeyTiers", oldPalette.doorKeyTiers, newPalette.doorKeyTiers);
  checkStringArray("leverEffectKinds", oldPalette.leverEffectKinds, newPalette.leverEffectKinds);
  checkObjectArray("itemKinds", oldPalette.itemKinds, newPalette.itemKinds);
  checkObjectArray("hazardKinds", oldPalette.hazardKinds, newPalette.hazardKinds);
  return removed;
}

const START_MARKER = "// GENERATED-PALETTE-START";
const END_MARKER = "// GENERATED-PALETTE-END";

/** Parses the `PALETTE` object literal currently embedded between the tool's GENERATED-PALETTE
 * markers. `Function` is used only to evaluate a JS object literal this same script generated
 * (or the original hand-written one, pre-migration) — trusted, repo-owned content, never
 * untrusted input. */
export function readEmbeddedPalette(html: string): PaletteManifest {
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Could not find GENERATED-PALETTE markers");
  }
  const block = html.slice(startIdx + START_MARKER.length, endIdx);
  const paletteMatch = block.match(/const PALETTE = ([\s\S]*?);\s*$/);
  if (!paletteMatch) {
    throw new Error('Could not find "const PALETTE = ...;" between the markers');
  }
  return new Function(`"use strict"; return (${paletteMatch[1]});`)() as PaletteManifest;
}

export interface PaletteSyncResult {
  ok: boolean;
  changed?: boolean;
  removed?: string[];
}

/** Diffs the tool's current embedded PALETTE against a freshly built one, and — only if
 * nothing would disappear — overwrites the block. */
export function syncPalette(toolHtmlPath: string): PaletteSyncResult {
  const html = readFileSync(toolHtmlPath, "utf-8");
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Could not find GENERATED-PALETTE markers in ${toolHtmlPath}`);
  }

  const oldPalette = readEmbeddedPalette(html);
  const newPalette = buildPalette();
  const removed = findRemovedEntries(oldPalette, newPalette);
  if (removed.length > 0) return { ok: false, removed };

  const serialized = JSON.stringify(newPalette, null, 2)
    .split("\n")
    .join("\n      ");
  const newBlock = `\n      const PALETTE = ${serialized};\n      `;
  const newHtml = html.slice(0, startIdx + START_MARKER.length) + newBlock + html.slice(endIdx);
  const changed = newHtml !== html;
  if (changed) writeFileSync(toolHtmlPath, newHtml, "utf-8");
  return { ok: true, changed };
}

function main(): void {
  const toolHtmlPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "tools/tower-mapping-tool/index.html",
  );
  const result = syncPalette(toolHtmlPath);
  if (result.ok) {
    console.log(result.changed ? "Palette updated." : "Palette already up to date — nothing to do.");
    process.exit(0);
  } else {
    console.log(`Palette sync refused — ${result.removed!.length} entr${result.removed!.length === 1 ? "y" : "ies"} would disappear:`);
    for (const r of result.removed!) console.log(`  ${r}`);
    console.log("If this removal is intentional, edit tools/tower-mapping-tool/index.html's PALETTE by hand instead.");
    process.exit(1);
  }
}

// Run only when this file is the invoked entry point (`tsx scripts/sync-tool-palette.ts`), not
// when imported by a test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
