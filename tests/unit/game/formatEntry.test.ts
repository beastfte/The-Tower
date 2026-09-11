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
});

describe("formatPickupEntry", () => {
  it("describes a key pickup", () => {
    const entry = formatPickupEntry("key", "bronze key");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up key: bronze key.");
  });

  it("describes a powerup pickup", () => {
    const entry = formatPickupEntry("powerup", "power-glove");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up powerup: power-glove.");
  });
});
