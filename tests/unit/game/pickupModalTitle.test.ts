import { describe, expect, it } from "vitest";
import { pickupModalTitle } from "../../../src/game/pickupModalTitle";

describe("pickupModalTitle", () => {
  it("shows a generic title for a key pickup", () => {
    expect(pickupModalTitle("key", "bronze key")).toBe("Key acquired!");
  });

  it("shows a generic title for a currency pickup", () => {
    expect(pickupModalTitle("currency", "30 gold")).toBe("Gold found!");
  });

  // bug fix: potion-banner-mislabeled — every potion sub-type must show its own name, not a
  // hardcoded "Health Potion!" regardless of which potion was actually picked up.
  it("shows the specific potion name for a plain health potion", () => {
    expect(pickupModalTitle("potion", "Health Potion")).toBe("Health Potion!");
  });

  it("shows the specific potion name for an attack potion", () => {
    expect(pickupModalTitle("potion", "Attack Potion")).toBe("Attack Potion!");
  });

  it("shows the specific potion name for a defense potion", () => {
    expect(pickupModalTitle("potion", "Defense Potion")).toBe("Defense Potion!");
  });
});
