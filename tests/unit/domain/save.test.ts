import { describe, expect, it } from "vitest";
import { ensureCheckpointCharacter } from "../../../src/domain/character/save";
import { createInitialPlayerSave } from "../../../src/domain/character/initialState";

const position = { x: 0, y: 0 };

describe("ensureCheckpointCharacter (bug fix: checkpoint-restart-stat-exploit, reopened)", () => {
  it("backfills a missing checkpoint from the current character", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const farmed = { ...save, character: { ...save.character, currency: 999 }, checkpointCharacter: undefined };

    const result = ensureCheckpointCharacter(farmed);

    expect(result.checkpointCharacter).toEqual(farmed.character);
    expect(result.checkpointCharacter?.currency).toBe(999);
  });

  it("leaves an already-present checkpoint untouched, not overwritten with the current (farmed) character", () => {
    const save = createInitialPlayerSave("floor-01", position);
    const withCheckpoint = {
      ...save,
      character: { ...save.character, currency: 999 },
      checkpointCharacter: { ...save.character, currency: 0 },
    };

    const result = ensureCheckpointCharacter(withCheckpoint);

    expect(result).toBe(withCheckpoint);
    expect(result.checkpointCharacter?.currency).toBe(0);
  });
});
