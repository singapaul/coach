-- Step 1 walking skeleton: profiles, owned by the logged-in user (ADR 0005).

-- True when `tz` is an IANA time zone name Postgres knows, e.g. 'Europe/London'.
-- Marked immutable so it can back a check constraint; the zone list only changes
-- with a Postgres tzdata update.
create function public.is_iana_timezone(tz text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- An instant as ISO 8601 UTC with a trailing Z and microseconds, e.g.
-- 2026-11-20T07:30:00.123456Z: the timestamp format of every published object.
-- to_json(timestamptz) gives a +00:00 offset, which the contract rejects, so
-- RPCs format timestamps with this instead.
create function public.iso_utc(t timestamptz)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;

comment on function public.iso_utc(timestamptz) is
  'ISO 8601 UTC with a trailing Z, e.g. 2026-11-20T07:30:00.123456Z: how published objects write timestamps.';

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm numeric(4, 1) check (height_cm > 0 and height_cm < 300),
  birth_year smallint check (birth_year between 1900 and 2100),
  sex text check (sex in ('male', 'female')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  training_days_per_week smallint check (training_days_per_week between 1 and 7),
  -- Every training-week and day boundary is worked out in this zone.
  timezone text not null default 'UTC' check (public.is_iana_timezone(timezone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per lifter. Created on sign-up; only its owner can read or change it.';
comment on column public.profiles.timezone is 'IANA time zone name. Training weeks run Monday to Sunday in this zone.';
comment on column public.profiles.units is 'Display units only. Stored values are always metric (kg, cm).';

alter table public.profiles enable row level security;

create policy "owner" on public.profiles
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Signing up gives the new user a profile. The app passes the phone's time zone
-- as `timezone` in the sign-up metadata; anything invalid falls back to UTC.
create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := new.raw_user_meta_data ->> 'timezone';
begin
  insert into public.profiles (user_id, timezone)
  values (
    new.id,
    case when tz is not null and public.is_iana_timezone(tz) then tz else 'UTC' end
  );
  return new;
end;
$$;

revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
