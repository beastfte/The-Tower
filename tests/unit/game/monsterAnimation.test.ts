import { describe, expect, it } from "vitest";
import { MONSTER_SPECIES } from "../../../src/data/monsterSpecies";
import {
  computeMonsterAttackFrame,
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
