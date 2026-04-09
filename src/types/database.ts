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
  created_at: string;
};
