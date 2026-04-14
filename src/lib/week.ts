import { localCalendarYmd } from './calendarDate';

/** Monday 00:00 local time as ISO string (used for weekly leaderboard windows). */
export function startOfWeekIso(): string {
  const x = new Date();
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

/** Mon–Sun local calendar days as `YYYY-MM-DD` for the week containing `d`. */
export function weekLocalYmdsContaining(d: Date = new Date()): string[] {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(x);
    cur.setDate(x.getDate() + i);
    out.push(localCalendarYmd(cur));
  }
  return out;
}
