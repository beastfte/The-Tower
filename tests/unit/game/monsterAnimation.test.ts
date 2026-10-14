import { describe, expect, it } from "vitest";
import { MONSTER_SPECIES } from "../../../src/data/monsterSpecies";
import { computePositionPhase } from "../../../src/game/livingAnimation";
import {
  computeMonsterAttackFrame,
  computeMonsterIdleFrame,
  computeMonsterIdlePose,
  idlePhaseOffsetMs,
  monsterIdleStyle,
  type MonsterIdleStyle,
  MONSTER_ATTACK_FRAME_MS,
  MONSTER_ATTACK_IMPACT_MS,
  MONSTER_ATTACK_MS,
} from "../../../src/game/monsterAnimation";

describe("computeMonsterAttackFrame (030 contract C5)", () => {
  it("runs wind-up -> swing -> held strike, one beat each", () => {
    expect(computeMonsterAttackFrame(0)).toBe("breath");
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_FRAME_MS)).toBe("attackA");
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_FRAME_MS * 2)).toBe("attackB");
  });

  it("holds each frame for its whole beat, not just at the boundary", () => {
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_FRAME_MS - 1)).toBe("breath");
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_FRAME_MS * 2 - 1)).toBe("attackA");
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_MS - 1)).toBe("attackB");
  });

  it("is over (null) once the whole animation has played", () => {
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_MS)).toBeNull();
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_MS * 10)).toBeNull();
  });

  it("lands the impact on the first instant of the held strike (FR-005)", () => {
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_IMPACT_MS)).toBe("attackB");
    expect(computeMonsterAttackFrame(MONSTER_ATTACK_IMPACT_MS - 1)).toBe("attackA");
  });
});

describe("attack length vs. the fastest attacker (FR-006)", () => {
  it("finishes before the quickest species can attack again", () => {
    const fastestMs = Math.min(...Object.values(MONSTER_SPECIES).map((s) => s.attackIntervalSec * 1000));
    expect(MONSTER_ATTACK_MS).toBeLessThan(fastestMs);
  });
});

const STYLES: MonsterIdleStyle[] = ["breathe", "squash", "hover"];
const PERIOD: Record<MonsterIdleStyle, number> = { breathe: 1600, squash: 900, hover: 1200 };

describe("monsterIdleStyle (039 C1)", () => {
  it("squashes slimes, hovers bats, breathes everyone else", () => {
    expect(monsterIdleStyle("slime")).toBe("squash");
    expect(monsterIdleStyle("bat")).toBe("hover");
    expect(monsterIdleStyle("goblin")).toBe("breathe");
    expect(monsterIdleStyle("ogre")).toBe("breathe");
  });

  it("covers every species", () => {
    for (const id of Object.keys(MONSTER_SPECIES)) expect(STYLES).toContain(monsterIdleStyle(id as never));
  });
});

describe("computeMonsterIdlePose (039 C2)", () => {
  const sample = (style: MonsterIdleStyle) =>
    Array.from({ length: PERIOD[style] }, (_, t) => computeMonsterIdlePose(style, t, 0));

  it("keeps breathe/squash on the ground and hover at full width", () => {
    for (const p of sample("breathe")) expect(p.dy).toBe(0);
    for (const p of sample("squash")) expect(p.dy).toBe(0);
    for (const p of sample("hover")) {
      expect(p.sx).toBe(1);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(0.08 + 1e-9);
    }
  });

  it("breathes at about 4%, squashes and hovers at about 8% (FR-001)", () => {
    expect(Math.max(...sample("breathe").map((p) => Math.abs(p.sy - 1)))).toBeGreaterThanOrEqual(0.039);
    expect(Math.max(...sample("breathe").map((p) => Math.abs(p.sy - 1)))).toBeLessThanOrEqual(0.04 + 1e-9);
    expect(Math.max(...sample("squash").map((p) => Math.abs(p.sy - 1)))).toBeGreaterThanOrEqual(0.079);
    expect(Math.max(...sample("hover").map((p) => Math.abs(p.dy)))).toBeGreaterThanOrEqual(0.079);
  });

  it("never stretches past 1.08 so a monster stays in its tile (FR-005)", () => {
    for (const style of STYLES) for (const p of sample(style)) expect(p.sy).toBeLessThanOrEqual(1.08 + 1e-9);
  });

  it("is deterministic and varies with phase", () => {
    for (const style of STYLES) {
      expect(computeMonsterIdlePose(style, 123, 5)).toEqual(computeMonsterIdlePose(style, 123, 5));
      expect(computeMonsterIdlePose(style, 123, 5)).not.toEqual(computeMonsterIdlePose(style, 123, 6));
    }
  });

  it("puts neighbouring tiles at least 15% of a cycle apart (FR-004)", () => {
    const apart = (style: MonsterIdleStyle, a: number, b: number) => {
      const d = Math.abs(idlePhaseOffsetMs(style, a) - idlePhaseOffsetMs(style, b)) % PERIOD[style];
      return Math.min(d, PERIOD[style] - d) / PERIOD[style];
    };
    for (const style of STYLES) {
      for (let x = 0; x < 13; x++) {
        for (let y = 0; y < 13; y++) {
          const here = computePositionPhase({ x, y });
          expect(apart(style, here, computePositionPhase({ x: x + 1, y }))).toBeGreaterThanOrEqual(0.15);
          expect(apart(style, here, computePositionPhase({ x, y: y + 1 }))).toBeGreaterThanOrEqual(0.15);
        }
      }
    }
  });
});

describe("computeMonsterIdleFrame (039 C3)", () => {
  it("alternates idle/breath every 430 ms", () => {
    expect(computeMonsterIdleFrame(0)).toBe("idle");
    expect(computeMonsterIdleFrame(429)).toBe("idle");
    expect(computeMonsterIdleFrame(430)).toBe("breath");
    expect(computeMonsterIdleFrame(860)).toBe("idle");
  });
});
