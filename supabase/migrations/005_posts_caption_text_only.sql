-- Text-only posts: `image_path` may be null when `caption` has content.
-- Safe if you never ran migration 002 (adds video_path / body first).

alter table public.posts add column if not exists video_path text;
alter table public.posts add column if not exists body text;
alter table public.posts add column if not exists caption text;

alter table public.posts alter column image_path drop not null;

alter table public.posts drop constraint if exists posts_has_one_medium;

alter table public.posts add constraint posts_has_one_medium check (
  (
    (image_path is not null and trim(image_path) <> '')
    or (video_path is not null and trim(video_path) <> '')
    or (body is not null and trim(body) <> '')
    or (caption is not null and trim(caption) <> '')
  )
);

notify pgrst, 'reload schema';
