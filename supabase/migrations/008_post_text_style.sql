-- Optional text-only post background preset (0–4). Safe to run on existing DBs.
alter table public.posts add column if not exists text_style smallint not null default 0;

comment on column public.posts.text_style is 'Preset index for text-only post card backgrounds (0–4).';
