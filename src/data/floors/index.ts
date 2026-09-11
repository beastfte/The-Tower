import { createTower } from "../../domain/floor/tower";
import { FLOOR_01 } from "./floor-01";
import { FLOOR_FINAL } from "./floor-final";

/** The tower's ordered floor list (FR-001), registering every authored floor. */
export const TOWER = createTower([FLOOR_01, FLOOR_FINAL]);
