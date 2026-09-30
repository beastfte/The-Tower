export type EventLogKind = "combat" | "pickup" | "purchase";

/** Session-only log entry (002 FR-015/FR-017) — never persisted to PlayerSave/localStorage. */
export interface EventLogEntry {
  kind: EventLogKind;
  message: string;
}
