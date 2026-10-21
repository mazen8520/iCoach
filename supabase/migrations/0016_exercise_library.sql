-- iCoach 0016: a shared, categorized exercise library.
-- Library ("global") exercises belong to no coach: every coach can browse them and add them to
-- programs, and nobody can edit them (the existing write policy only matches rows a coach owns).
-- Coaches' own exercises keep working exactly as before; only new columns are added, all
-- nullable or defaulted, and no existing row is changed.

alter table public.exercises alter column coach_id drop not null;

alter table public.exercises
  add column if not exists is_global boolean not null default false,
  -- upper_body | lower_body | core | full_body | cardio | mobility
  add column if not exists body_region text,
  -- Starting prescription copied into a program when the exercise is added (coach edits it there).
  add column if not exists default_sets smallint,
  add column if not exists default_reps text,
  add column if not exists default_rest_seconds integer,
  add column if not exists default_duration_seconds integer;

alter table public.exercises drop constraint if exists exercises_owner_or_global;
alter table public.exercises
  add constraint exercises_owner_or_global check (
    (is_global and coach_id is null) or (not is_global and coach_id is not null)
  );
alter table public.exercises drop constraint if exists exercises_body_region_values;
alter table public.exercises
  add constraint exercises_body_region_values check (
    body_region is null
    or body_region in ('upper_body', 'lower_body', 'core', 'full_body', 'cardio', 'mobility')
  );
alter table public.exercises drop constraint if exists exercises_default_ranges;
alter table public.exercises
  add constraint exercises_default_ranges check (
    (default_sets is null or default_sets between 1 and 20)
    and (default_rest_seconds is null or default_rest_seconds between 0 and 600)
    and (default_duration_seconds is null or default_duration_seconds between 0 and 7200)
  );

-- One global exercise per name (keeps the seed idempotent).
create unique index if not exists exercises_global_name_idx
  on public.exercises (lower(name)) where is_global;
create index if not exists exercises_global_region_idx
  on public.exercises (body_region) where is_global;

-- Coaches can read the shared library. Athletes already see any exercise in their assigned
-- workouts through exercises_client_select_assigned, which covers library exercises too.
drop policy if exists "exercises_coach_select_global" on public.exercises;
create policy "exercises_coach_select_global" on public.exercises for select
  using (is_global and public.current_role() = 'coach');
