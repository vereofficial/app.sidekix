-- If you already ran an older 006 that notified on public.follows, remove it here.
-- Safe to run even when the trigger never existed.

drop trigger if exists follows_enqueue_notify on public.follows;
drop function if exists public.enqueue_new_follow();
