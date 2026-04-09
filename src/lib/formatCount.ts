export function upvotesLabel(n: number): string {
  return `${n} ${n === 1 ? 'upvote' : 'upvotes'}`;
}

export function postsLabel(n: number): string {
  return `${n} ${n === 1 ? 'post' : 'posts'}`;
}

/** Uppercase labels for profile stat row (SIDEQUEST / SIDEQUESTS). */
export function statSidequestsKey(n: number): string {
  return n === 1 ? 'SIDEQUEST' : 'SIDEQUESTS';
}

export function statUpvotesKey(n: number): string {
  return n === 1 ? 'UPVOTE' : 'UPVOTES';
}

