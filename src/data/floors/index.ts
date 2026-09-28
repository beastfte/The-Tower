import { createTower } from "../../domain/floor/tower";
import { FLOOR_1 } from "./floor-1";
import { FLOOR_2 } from "./floor-2";

/** The tower's ordered floor list (FR-001), registering every authored floor. */
export const TOWER = createTower([FLOOR_1, FLOOR_2]);
