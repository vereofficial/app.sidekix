-- Sidequest/challenge metadata for categorization and richer detail view.
-- Backfills legacy challenges so feed/search can treat legacy + new content uniformly.

alter table if exists public.sidequests
  add column if not exists subtitle text;

alter table if exists public.challenges
  add column if not exists categories text[] not null default '{}',
  add column if not exists subtitle text;

update public.challenges
set categories = array['legacy']
where (categories is null or cardinality(categories) = 0);
