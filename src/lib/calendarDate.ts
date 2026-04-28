/** YYYY-MM-DD in the device's local calendar (not UTC). Used for labels; active sidequest keys are in `sidequestPeriod.ts`. */
export function localCalendarYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
