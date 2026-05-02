/** Short relative label for submission timestamps (feed cards, detail). */
export function formatRelativePostTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1) return 'just now';
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return diffH === 1 ? '1 hour ago' : `${diffH} hours ago`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
