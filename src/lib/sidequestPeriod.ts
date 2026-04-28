import { localCalendarYmd } from './calendarDate';

/**
 * Sidekix uses **two challenges per calendar week**, keyed by `challenges.day`:
 * - **Weekday run (Mon–Thu):** `day` = that week’s **Monday** (local YYYY-MM-DD).
 * - **Weekend run (Fri–Sun):** `day` = that week’s **Friday** (local YYYY-MM-DD).
 *
 * Each run ends at **Thursday 23:59** or **Sunday 23:59** local (see `activeSidequestDeadline`).
 */

/** Monday 00:00:00 local for the week containing `d` (week = Mon–Sun). */
export function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diffToMon);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function activeSidequestSlot(d: Date = new Date()): 'weekday' | 'weekend' {
  const dow = d.getDay();
  // Sun=0, Mon=1 .. Thu=4 → weekday; Fri=5, Sat=6 → weekend
  if (dow === 0 || dow === 5 || dow === 6) return 'weekend';
  return 'weekday';
}

/** Value to match `challenges.day` for the active sidequest. */
export function activeChallengeDayYmd(d: Date = new Date()): string {
  const mon = mondayOfWeekContaining(d);
  if (activeSidequestSlot(d) === 'weekend') {
    const fri = new Date(mon);
    fri.setDate(fri.getDate() + 4);
    return localCalendarYmd(fri);
  }
  return localCalendarYmd(mon);
}

/** End of the current sidequest window (Thu or Sun end-of-day, local). */
export function activeSidequestDeadline(d: Date = new Date()): Date {
  const mon = mondayOfWeekContaining(d);
  const end = new Date(mon);
  if (activeSidequestSlot(d) === 'weekday') {
    end.setDate(end.getDate() + 3);
  } else {
    end.setDate(end.getDate() + 6);
  }
  end.setHours(23, 59, 59, 999);
  return end;
}

export function msUntilActiveSidequestDeadline(d: Date = new Date()): number {
  return activeSidequestDeadline(d).getTime() - d.getTime();
}

/** e.g. "thursday at midnight" — lowercase for inline copy. */
export function activeSidequestDeadlinePhrase(d: Date = new Date()): string {
  return activeSidequestSlot(d) === 'weekday' ? 'thursday at midnight' : 'sunday at midnight';
}

export function sidequestDeadlineSentence(d: Date = new Date()): string {
  return `you have until ${activeSidequestDeadlinePhrase(d)}.`;
}

/** Short label for UI chips (drop overlay, etc.). */
export function activeSidequestSlotLabel(d: Date = new Date()): string {
  return activeSidequestSlot(d) === 'weekday' ? 'mon–thu' : 'fri–sun';
}

/** Small tag line: "this challenge · mon–thu" / "fri–sun" (no serial number). */
export function activeSidequestTag(d: Date = new Date()): string {
  return `this challenge · ${activeSidequestSlotLabel(d)}`;
}

function ymdsFromStart(startMidnight: Date, dayCount: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startMidnight);
    d.setDate(startMidnight.getDate() + i);
    out.push(localCalendarYmd(d));
  }
  return out;
}

/**
 * True if the user has a post tied to any challenge whose `day` falls in the same
 * sidequest window as `anchor` (Mon–Thu or Fri–Sun of that ISO week).
 * Matches legacy daily `challenges.day` rows (e.g. Tuesday) as long as the date lies in the window.
 */
export function postedForSidequestSlotAt(anchor: Date, postedChallengeDays: Set<string>): boolean {
  const mon = mondayOfWeekContaining(anchor);
  const slot = activeSidequestSlot(anchor);
  if (slot === 'weekday') {
    return ymdsFromStart(mon, 4).some((ymd) => postedChallengeDays.has(ymd));
  }
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return ymdsFromStart(fri, 3).some((ymd) => postedChallengeDays.has(ymd));
}

/** Move `anchor` to a time inside the previous sidequest slot (walking backward in time). */
export function previousSidequestCursor(anchor: Date): Date {
  const slot = activeSidequestSlot(anchor);
  const mon = mondayOfWeekContaining(anchor);
  if (slot === 'weekend') {
    const d = new Date(mon);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const prevFri = new Date(mon);
  prevFri.setDate(mon.getDate() - 3);
  prevFri.setHours(12, 0, 0, 0);
  return prevFri;
}

/**
 * Consecutive sidequests posted, walking backward from `from` (usually “now”).
 * Each slot is one Mon–Thu run or one Fri–Sun run; missing any slot breaks the count.
 */
export function computeSidequestPostStreak(postedChallengeDays: Set<string>, from: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  const max = 200;
  while (streak < max) {
    if (!postedForSidequestSlotAt(cursor, postedChallengeDays)) break;
    streak += 1;
    const next = previousSidequestCursor(cursor);
    if (next.getTime() === cursor.getTime()) break;
    cursor.setTime(next.getTime());
  }
  return streak;
}
