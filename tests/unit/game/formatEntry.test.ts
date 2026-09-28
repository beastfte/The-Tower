import { describe, expect, it } from "vitest";
import { formatCombatEntry, formatPickupEntry } from "../../../src/game/eventLog/formatEntry";
import type { EncounterResult } from "../../../src/domain/combat/simulateEncounter";

describe("formatCombatEntry", () => {
  it("describes a player win, including the turn count", () => {
    const result: EncounterResult = {
      winner: "player",
      turns: [
        { attacker: "player", damageDealt: 5, defenderHpAfter: 5 },
        { attacker: "enemy", damageDealt: 2, defenderHpAfter: 28 },
        { attacker: "player", damageDealt: 5, defenderHpAfter: 0 },
      ],
    };
    const entry = formatCombatEntry("floor01-goblin", result);
    expect(entry.kind).toBe("combat");
    expect(entry.message).toContain("Defeated floor01-goblin");
    expect(entry.message).toContain("3 turn(s)");
  });

  it("describes an enemy win", () => {
    const result: EncounterResult = {
      winner: "enemy",
      turns: [{ attacker: "enemy", damageDealt: 10, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("floor-final-boss", result);
    expect(entry.kind).toBe("combat");
    expect(entry.message).toContain("Lost the encounter with floor-final-boss");
  });

  // bug fix: currency-not-logged — a defeated enemy's currency drop is folded into this same
  // entry rather than getting its own standalone pickup entry.
  it("folds a currency drop into the win message", () => {
    const result: EncounterResult = {
      winner: "player",
      turns: [{ attacker: "player", damageDealt: 20, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("floor-1-enemy-1", result, 100);
    expect(entry.message).toBe("Defeated floor-1-enemy-1 (1 turn(s)). Found 100 gold.");
  });

  it("does not mention gold when the enemy had no currency drop", () => {
    const result: EncounterResult = {
      winner: "player",
      turns: [{ attacker: "player", damageDealt: 20, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("floor01-goblin", result);
    expect(entry.message).toBe("Defeated floor01-goblin (1 turn(s)).");
  });

  it("does not mention gold on a loss, even if the enemy has a currency drop", () => {
    const result: EncounterResult = {
      winner: "enemy",
      turns: [{ attacker: "enemy", damageDealt: 10, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("floor-final-boss", result, 100);
    expect(entry.message).toBe("Lost the encounter with floor-final-boss.");
  });
});

describe("formatPickupEntry", () => {
  it("describes a key pickup", () => {
    const entry = formatPickupEntry("key", "bronze key");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up key: bronze key.");
  });

  it("describes a currency pickup", () => {
    const entry = formatPickupEntry("currency", "30 gold");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up gold: 30 gold.");
  });
});
