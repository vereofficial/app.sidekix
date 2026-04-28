import { useMemo } from 'react';
import { useTodayChallenge } from './useTodayChallenge';
import { useMyPosts } from './useMyPosts';

/** True when the current user has a post for the active sidequest (weekday or weekend run). */
export function usePostedToday(userId: string | undefined) {
  const { challenge } = useTodayChallenge();
  const { posts } = useMyPosts(userId);

  const postedToday = useMemo(() => {
    if (!challenge) return false;
    return posts.some((p) => p.challenge_id === challenge.id);
  }, [challenge, posts]);

  return postedToday;
}
