-- Moving a session within its training week (#6).
--
-- A session's scheduled date can change, but only to another date in the
-- training week it was created in. The existing check
-- `training_week_start = training_week_start(scheduled_date)` already refuses a
-- date outside the week, so all that's left is to stop the week itself (and the
-- block, which fixes the block week) from changing after the session exists.
-- Moving to another week would be a new session, made by whoever plans that week.
--
-- Training weeks are Monday to Sunday dates. Which date is "today" is decided in
-- the profile's time zone by lifter_local_date; scheduled dates themselves are
-- plain local dates, so no time zone is needed here.

create function public.sessions_keep_training_week()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.training_week_start is distinct from old.training_week_start then
    raise exception 'A session can only be moved within its training week (week of %).', old.training_week_start
      using errcode = 'check_violation',
            hint = 'Change scheduled_date to another date from Monday to Sunday of the same week.';
  end if;
  if new.block_id is distinct from old.block_id then
    raise exception 'A session cannot be moved to another block.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.sessions_keep_training_week() is
  'Before-update trigger on sessions: training_week_start and block_id never change, so a move stays in its training week.';

create trigger sessions_keep_training_week
  before update of training_week_start, block_id on public.sessions
  for each row
  execute function public.sessions_keep_training_week();
