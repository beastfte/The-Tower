import { describe, expect, it } from "vitest";
import { resolveAttack } from "../../../src/domain/combat/resolveAttack";
import { simulateEncounter } from "../../../src/domain/combat/simulateEncounter";

describe("resolveAttack", () => {
  it("deals damage minus defence", () => {
    expect(resolveAttack({ damage: 10, defence: 3, hp: 1 }, { damage: 0, defence: 4, hp: 1 })).toBe(
      6,
    );
  });

  it("never deals negative damage", () => {
    expect(resolveAttack({ damage: 2, defence: 0, hp: 1 }, { damage: 0, defence: 10, hp: 1 })).toBe(
      0,
    );
  });
});

describe("simulateEncounter", () => {
  it("has the player win when clearly stronger", () => {
    const result = simulateEncounter(
      { damage: 10, defence: 2, hp: 30 },
      { damage: 2, defence: 0, hp: 10 },
    );
    expect(result.winner).toBe("player");
    expect(result.turns[0]!.attacker).toBe("player");
  });

  it("has the enemy win when clearly stronger", () => {
    const result = simulateEncounter(
      { damage: 2, defence: 0, hp: 10 },
      { damage: 10, defence: 0, hp: 30 },
    );
    expect(result.winner).toBe("enemy");
  });

  it("alternates player then enemy each turn", () => {
    const result = simulateEncounter(
      { damage: 5, defence: 0, hp: 20 },
      { damage: 5, defence: 0, hp: 20 },
    );
    for (let i = 0; i < result.turns.length; i++) {
      expect(result.turns[i]!.attacker).toBe(i % 2 === 0 ? "player" : "enemy");
    }
  });

  it("declares the enemy the winner on a damage stalemate instead of looping forever", () => {
    const result = simulateEncounter(
      { damage: 1, defence: 10, hp: 10 },
      { damage: 1, defence: 10, hp: 10 },
    );
    expect(result.winner).toBe("enemy");
    expect(result.turns.length).toBeLessThan(10);
  });

  it("never mutates the CombatStats passed in", () => {
    const player = { damage: 10, defence: 2, hp: 30 };
    const enemy = { damage: 2, defence: 0, hp: 10 };
    const playerCopy = { ...player };
    const enemyCopy = { ...enemy };
    simulateEncounter(player, enemy);
    expect(player).toEqual(playerCopy);
    expect(enemy).toEqual(enemyCopy);
  });
});
