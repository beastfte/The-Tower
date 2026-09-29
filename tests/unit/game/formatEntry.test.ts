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
    const entry = formatCombatEntry("Goblin", result);
    expect(entry.kind).toBe("combat");
    expect(entry.message).toContain("Defeated Goblin");
    expect(entry.message).toContain("3 turn(s)");
  });

  it("describes an enemy win", () => {
    const result: EncounterResult = {
      winner: "enemy",
      turns: [{ attacker: "enemy", damageDealt: 10, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("Wizard", result);
    expect(entry.kind).toBe("combat");
    expect(entry.message).toContain("Lost the encounter with Wizard");
  });

  // bug fix: currency-not-logged — a defeated enemy's currency drop is folded into this same
  // entry rather than getting its own standalone pickup entry.
  it("folds a currency drop into the win message", () => {
    const result: EncounterResult = {
      winner: "player",
      turns: [{ attacker: "player", damageDealt: 20, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("Ogre", result, 100);
    expect(entry.message).toBe("Defeated Ogre (1 turn(s)). Found 100 gold.");
  });

  it("does not mention gold when the enemy had no currency drop", () => {
    const result: EncounterResult = {
      winner: "player",
      turns: [{ attacker: "player", damageDealt: 20, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("Goblin", result);
    expect(entry.message).toBe("Defeated Goblin (1 turn(s)).");
  });

  it("does not mention gold on a loss, even if the enemy has a currency drop", () => {
    const result: EncounterResult = {
      winner: "enemy",
      turns: [{ attacker: "enemy", damageDealt: 10, defenderHpAfter: 0 }],
    };
    const entry = formatCombatEntry("Wizard", result, 100);
    expect(entry.message).toBe("Lost the encounter with Wizard.");
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

  it("describes a weapon pickup", () => {
    const entry = formatPickupEntry("weapon", "Gold Sword");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up weapon: Gold Sword.");
  });

  it("describes an armor pickup", () => {
    const entry = formatPickupEntry("armor", "Leather Helm");
    expect(entry.kind).toBe("pickup");
    expect(entry.message).toBe("Picked up armor: Leather Helm.");
  });
});
