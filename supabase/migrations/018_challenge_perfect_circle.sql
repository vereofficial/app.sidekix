-- Today's sidequest copy: emphasis must appear in title (see splitChallengeTitle).
-- `day` uses UTC calendar date (Supabase default). If the app shows a different "today"
-- near timezone boundaries, run the same upsert in the SQL editor with an explicit `day`.

insert into public.challenges (day, title, emphasis, display_number)
values (
  (timezone('utc', now()))::date,
  'draw the most perfect circle in existence',
  'circle',
  coalesce((select max(display_number) from public.challenges c2), 0) + 1
)
on conflict (day) do update set
  title = excluded.title,
  emphasis = excluded.emphasis;
