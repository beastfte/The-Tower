import { describe, expect, it } from "vitest";
import { formatBattleEntry, formatPickupEntry } from "../../../src/game/eventLog/formatEntry";

/** 027 FR-024 / contract C19: one line per battle. */
describe("formatBattleEntry", () => {
  it("folds every drop into a victory line", () => {
    const entry = formatBattleEntry({ outcome: "victory", enemyName: "Goblin", loot: ["12 gold", "a Bronze key"] });
    expect(entry.kind).toBe("combat");
    expect(entry.message).toBe("You won against Goblin, looted 12 gold and a Bronze key.");
  });

  it("lists three or more drops with commas", () => {
    const entry = formatBattleEntry({ outcome: "victory", enemyName: "Ogre", loot: ["30 gold", "a Silver key", "Gem"] });
    expect(entry.message).toBe("You won against Ogre, looted 30 gold, a Silver key and Gem.");
  });

  it("omits the loot clause when nothing dropped", () => {
    expect(formatBattleEntry({ outcome: "victory", enemyName: "Slime" }).message).toBe("You won against Slime.");
  });

  it("describes fleeing", () => {
    expect(formatBattleEntry({ outcome: "fled", enemyName: "Ogre" }).message).toBe(
      "You engaged Ogre, it was too powerful and you fled.",
    );
  });

  it("describes a death, ignoring any loot", () => {
    expect(formatBattleEntry({ outcome: "defeat", enemyName: "Skeleton", loot: ["5 gold"] }).message).toBe(
      "You were slain by Skeleton.",
    );
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
