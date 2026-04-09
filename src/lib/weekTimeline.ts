/** Progress through the current Mon–Sun week (0 = Mon 00:00, 1 = next Mon 00:00). */
export function mondayToSundayWeekProgress(now = new Date()): number {
  const d = new Date(now);
  const day = d.getDay();
  const offsetFromMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - offsetFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const t = (d.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime());
  return Math.max(0, Math.min(1, t));
}
