-- Text-only posts: store copy in `caption`, leave `image_path` null.
-- Drops NOT NULL on image_path if present; removes strict check from migration 002 if you added it.
-- Refreshes PostgREST schema cache (fixes "could not find column in schema cache" after DDL).

alter table public.posts alter column image_path drop not null;

alter table public.posts drop constraint if exists posts_has_one_medium;

notify pgrst, 'reload schema';
