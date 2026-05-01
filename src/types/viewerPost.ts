/** Minimal shape for fullscreen media viewer (works for `posts` and `sidequest_posts`). */
export type MediaViewerPost = {
  id: string;
  user_id: string;
  image_path: string | null;
  video_path: string | null;
  body: string | null;
  caption?: string | null;
};
