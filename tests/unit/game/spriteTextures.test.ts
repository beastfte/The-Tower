import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Textures: { FilterMode: { NEAREST: 1 } } } }));
import { ensureFlashTexture, monsterSpriteKey } from "../../../src/game/render/spriteTextures";

describe("monsterSpriteKey (036 contract C2)", () => {
  it("returns the elite key for an elite with elite art", () => {
    expect(monsterSpriteKey("goblin", true)).toBe("goblinElite");
  });

  it("returns the base key when not elite or unset", () => {
    expect(monsterSpriteKey("goblin", false)).toBe("goblin");
    expect(monsterSpriteKey("goblin", undefined)).toBe("goblin");
  });

  it("falls back to the base key when there is no elite art", () => {
    expect(monsterSpriteKey("merchantIdle", true)).toBe("merchantIdle");
    expect(monsterSpriteKey("noSuchMonster", true)).toBe("noSuchMonster");
  });
});

describe("ensureFlashTexture (038 contract C4)", () => {
  /** A scene stub holding just the texture manager calls the helper makes. */
  function stubScene() {
    const created: string[] = [];
    const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), globalCompositeOperation: "", fillStyle: "" };
    const scene = {
      textures: {
        exists: (k: string) => created.includes(k) || k === "src",
        get: () => ({ getSourceImage: () => ({ width: 32, height: 32 }) }),
        createCanvas: (k: string) => {
          created.push(k);
          return { getContext: () => ctx, refresh: vi.fn(), setFilter: vi.fn() };
        },
      },
    };
    return { scene: scene as never, created, ctx };
  }

  it("names the silhouette <key>-flash and paints it white over the sprite's opaque pixels only", () => {
    const { scene, created, ctx } = stubScene();
    expect(ensureFlashTexture(scene, "src")).toBe("src-flash");
    expect(created).toEqual(["src-flash"]);
    expect(ctx.globalCompositeOperation).toBe("source-in");
    expect(ctx.fillStyle).toBe("#ffffff");
  });

  it("reuses the cached texture on later hits", () => {
    const { scene, created } = stubScene();
    ensureFlashTexture(scene, "src");
    ensureFlashTexture(scene, "src");
    expect(created).toHaveLength(1);
  });
});
