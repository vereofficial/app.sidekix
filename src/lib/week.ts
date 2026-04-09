/** Monday 00:00 local time as ISO string (used for weekly leaderboard windows). */
export function startOfWeekIso(): string {
  const x = new Date();
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
