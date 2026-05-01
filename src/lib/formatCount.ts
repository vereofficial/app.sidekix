export function reactionsLabel(n: number): string {
  return `${n} ${n === 1 ? 'reaction' : 'reactions'}`;
}

export function postsLabel(n: number): string {
  return `${n} ${n === 1 ? 'post' : 'posts'}`;
}

/** Feed subtitle: show a numeric count only when there are 10+ posts; otherwise omit (no placeholder copy). */
export function postsFeedCountLine(n: number): string | null {
  if (n < 10) return null;
  return postsLabel(n);
}

/** Past row suffix after " · " only when n ≥ 10; otherwise omit (no "no posts" line). */
export function pastChallengePostCountSuffix(n: number): string | null {
  if (n < 10) return null;
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'post' : 'posts'}`;
}

/** Uppercase labels for profile stat row (CHALLENGE / CHALLENGES). */
export function statSidequestsKey(n: number): string {
  return n === 1 ? 'CHALLENGE' : 'CHALLENGES';
}

/** Profile stat row: TIME CREDITED vs TIMES CREDITED. */
export function statTimesCreditedKey(n: number): string {
  return n === 1 ? 'TIME CREDITED' : 'TIMES CREDITED';
}

export function statReactionsKey(n: number): string {
  return n === 1 ? 'REACTION' : 'REACTIONS';
}
