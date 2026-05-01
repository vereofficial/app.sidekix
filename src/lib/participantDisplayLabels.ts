type PostLike = { user_id: string; is_anonymous?: boolean | null };

/** Deduped participant labels for avatar initials (anonymous grouped). */
export function participantDisplayLabelsFromPosts(posts: PostLike[], usernames: Record<string, string>): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of posts) {
    const anon = Boolean(p.is_anonymous);
    const key = anon ? '__anon__' : p.user_id;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(anon ? 'anonymous' : usernames[p.user_id] ?? 'user');
  }
  return labels;
}
