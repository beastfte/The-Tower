import { describe, expect, it } from "vitest";
import { foldTurnsToLines } from "../../../src/game/combatLogReveal";
import type { Turn } from "../../../src/domain/combat/simulateEncounter";

describe("foldTurnsToLines", () => {
  it("folds a multi-turn encounter with correct running HP on every line, including the last", () => {
    const turns: Turn[] = [
      { attacker: "player", damageDealt: 5, defenderHpAfter: 15 },
      { attacker: "enemy", damageDealt: 3, defenderHpAfter: 27 },
      { attacker: "player", damageDealt: 5, defenderHpAfter: 10 },
      { attacker: "enemy", damageDealt: 3, defenderHpAfter: 24 },
    ];

    const result = foldTurnsToLines(turns, 30, 20, "Goblin");

    expect(result.lines).toEqual([
      "You attack for 5 dmg — You: 30 HP | Goblin: 15 HP",
      "Goblin attack for 3 dmg — You: 27 HP | Goblin: 15 HP",
      "You attack for 5 dmg — You: 27 HP | Goblin: 10 HP",
      "Goblin attack for 3 dmg — You: 24 HP | Goblin: 10 HP",
    ]);
    expect(result.playerHp).toBe(24);
    expect(result.enemyHp).toBe(10);
  });

  it("folds a single-turn encounter", () => {
    const turns: Turn[] = [{ attacker: "player", damageDealt: 20, defenderHpAfter: 0 }];

    const result = foldTurnsToLines(turns, 30, 20, "Rat");

    expect(result.lines).toEqual(["You attack for 20 dmg — You: 30 HP | Rat: 0 HP"]);
    expect(result.playerHp).toBe(30);
    expect(result.enemyHp).toBe(0);
  });

  it("folds an empty turn list into no lines, unchanged HP", () => {
    const result = foldTurnsToLines([], 30, 20, "Goblin");

    expect(result.lines).toEqual([]);
    expect(result.playerHp).toBe(30);
    expect(result.enemyHp).toBe(20);
  });

  it("resuming a fold from mid-encounter produces the same tail as folding from the start", () => {
    const turns: Turn[] = [
      { attacker: "player", damageDealt: 5, defenderHpAfter: 15 },
      { attacker: "enemy", damageDealt: 3, defenderHpAfter: 27 },
      { attacker: "player", damageDealt: 5, defenderHpAfter: 10 },
    ];

    const full = foldTurnsToLines(turns, 30, 20, "Goblin");
    const first = foldTurnsToLines(turns.slice(0, 1), 30, 20, "Goblin");
    const rest = foldTurnsToLines(turns.slice(1), first.playerHp, first.enemyHp, "Goblin");

    expect([...first.lines, ...rest.lines]).toEqual(full.lines);
    expect(rest.playerHp).toBe(full.playerHp);
    expect(rest.enemyHp).toBe(full.enemyHp);
  });
});
