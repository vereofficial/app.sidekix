export function reactionsLabel(n: number): string {
  return `${n} ${n === 1 ? 'reaction' : 'reactions'}`;
}

export function postsLabel(n: number): string {
  return `${n} ${n === 1 ? 'post' : 'posts'}`;
}

/** Uppercase labels for profile stat row (SIDEQUEST / SIDEQUESTS). */
export function statSidequestsKey(n: number): string {
  return n === 1 ? 'SIDEQUEST' : 'SIDEQUESTS';
}

export function statReactionsKey(n: number): string {
  return n === 1 ? 'REACTION' : 'REACTIONS';
}
