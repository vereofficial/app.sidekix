export type ChallengeRow = {
  id: string;
  day: string;
  title: string;
  emphasis: string;
  display_number: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  username: string;
  display_emoji: string;
  avatar_path?: string | null;
  /** When true, posts + profile are only visible to followers (see RLS). */
  friends_only?: boolean | null;
  created_at: string;
};

export type PostRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  image_path: string | null;
  video_path: string | null;
  body: string | null;
  is_anonymous: boolean;
  caption: string | null;
  /** Preset index for text-only cards (0–4). Omitted on older rows / before migration. */
  text_style?: number | null;
  created_at: string;
};
