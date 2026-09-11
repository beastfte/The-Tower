import { describe, expect, it } from "vitest";
import { validateFloorDefinition } from "../../../src/domain/floor/validator";
import { validateTower } from "../../../src/domain/floor/tower";
import { TOWER } from "../../../src/data/floors";

describe("authored floor content", () => {
  it.each(TOWER.floors)("floor $id satisfies the floor-data contract invariants", (floor) => {
    const result = validateFloorDefinition(floor);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("the tower satisfies the tower-level invariants (end boss, key reachability)", () => {
    const result = validateTower(TOWER);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
