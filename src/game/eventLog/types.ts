/** 033: "gear" = discard; "note" = a blocked or lost acquisition (full bag). */
export type EventLogKind = "combat" | "pickup" | "purchase" | "gear" | "note";

import type { GradeId } from "../../domain/character/grades";

/** Session-only log entry (002 FR-015/FR-017) — never persisted to PlayerSave/localStorage. */
export interface EventLogEntry {
  kind: EventLogKind;
  message: string;
  /** 034: a substring of `message` (a gear name) drawn in its grade colour. */
  highlight?: { text: string; grade: GradeId };
}
