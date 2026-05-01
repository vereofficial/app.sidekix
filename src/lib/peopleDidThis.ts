/** Line for aggregate activity counts. Empty when nobody has participated yet — row is omitted in the UI. */
export function peopleDidThisLine(count: number): string {
  if (count < 1) return '';
  if (count === 1) return '1 person did this';
  return `${count} people did this`;
}
