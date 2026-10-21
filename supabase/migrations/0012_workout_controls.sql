-- iCoach 0012: workout controls — per-set prescriptions, rest between sets and between exercises,
-- supersets, a per-workout default rest, and a richer, archivable exercise library.
-- Every new column has a default, so existing workouts and exercises keep working unchanged.

-- ============================================================
-- 1. Workouts: default rest applied to newly added exercises
-- ============================================================
alter table public.workouts
  add column if not exists default_rest_seconds integer not null default 90;
alter table public.workouts drop constraint if exists workouts_default_rest_range;
alter table public.workouts
  add constraint workouts_default_rest_range check (default_rest_seconds between 0 and 600);

-- ============================================================
-- 2. Workout exercises: per-set plan, rest between exercises, superset link
-- ============================================================
-- set_plan is an ordered JSON array with one object per set:
--   { id, type: normal|warmup|drop|failure|superset|rest_pause,
--     reps: {mode: fixed|range|amrap|failure|none, value?, min?, max?},
--     load: {mode: kg|lbs|pct_1rm|bodyweight|none, value?},
--     tempo?, rpe?, rir?, duration_seconds?, distance?: {value, unit: m|km|mi},
--     rest_seconds? (overrides the exercise's rest for this set), notes? }
-- An empty array means "legacy row": the app derives the sets from sets/reps/load/rest_seconds.
-- sets/reps/load stay filled as a plain-text summary so older views keep working.
alter table public.workout_exercises
  add column if not exists set_plan jsonb not null default '[]'::jsonb,
  add column if not exists rest_after_seconds integer,
  add column if not exists superset_with_next boolean not null default false;

alter table public.workout_exercises drop constraint if exists workout_exercises_set_plan_array;
alter table public.workout_exercises
  add constraint workout_exercises_set_plan_array check (jsonb_typeof(set_plan) = 'array');
alter table public.workout_exercises drop constraint if exists workout_exercises_rest_range;
alter table public.workout_exercises
  add constraint workout_exercises_rest_range
    check (rest_seconds is null or rest_seconds between 0 and 600) not valid;
alter table public.workout_exercises drop constraint if exists workout_exercises_rest_after_range;
alter table public.workout_exercises
  add constraint workout_exercises_rest_after_range
    check (rest_after_seconds is null or rest_after_seconds between 0 and 600);
alter table public.workout_exercises drop constraint if exists workout_exercises_sets_range;
alter table public.workout_exercises
  add constraint workout_exercises_sets_range check (sets between 1 and 20) not valid;

-- ============================================================
-- 3. Exercise library: coaching detail, muscles, equipment, difficulty, type, media,
--    substitutes, archive, and per-workout copies
-- ============================================================
alter table public.exercises
  add column if not exists description text,
  add column if not exists cues text,
  add column if not exists common_mistakes text,
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists equipment_list text[] not null default '{}',
  add column if not exists difficulty text,
  add column if not exists exercise_type text,
  add column if not exists image_url text,
  add column if not exists alternative_ids uuid[] not null default '{}',
  add column if not exists archived_at timestamptz,
  -- false for a private copy made when a coach edits an exercise "for this workout only";
  -- copies never show in the library but still render inside the workout that uses them.
  add column if not exists is_library boolean not null default true,
  add column if not exists source_exercise_id uuid references public.exercises(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.exercises drop constraint if exists exercises_difficulty_values;
alter table public.exercises
  add constraint exercises_difficulty_values
    check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced'));
alter table public.exercises drop constraint if exists exercises_type_values;
alter table public.exercises
  add constraint exercises_type_values check (
    exercise_type is null or exercise_type in (
      'strength', 'hypertrophy', 'cardio', 'hiit', 'mobility', 'stretching', 'plyometric',
      'powerlifting', 'olympic_lifting', 'rehab'
    )
  );
alter table public.exercises drop constraint if exists exercises_video_url_http;
alter table public.exercises
  add constraint exercises_video_url_http check (video_url is null or video_url ~* '^https?://') not valid;
alter table public.exercises drop constraint if exists exercises_image_url_http;
alter table public.exercises
  add constraint exercises_image_url_http check (image_url is null or image_url ~* '^https?://');

create index if not exists exercises_library_idx
  on public.exercises(coach_id, name) where is_library and archived_at is null;

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

-- Carry the old single-value muscle_group / equipment text into the new multi-select arrays
-- when it matches one of the known values.
update public.exercises
set primary_muscles = array[lower(btrim(muscle_group))]
where cardinality(primary_muscles) = 0
  and lower(btrim(muscle_group)) = any (array[
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'glutes',
    'quads', 'hamstrings', 'calves', 'adductors', 'abductors', 'traps', 'lats', 'lower_back',
    'neck', 'full_body', 'cardio'
  ]);

update public.exercises
set equipment_list = array[lower(btrim(equipment))]
where cardinality(equipment_list) = 0
  and lower(btrim(equipment)) = any (array[
    'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith_machine', 'resistance_band',
    'bodyweight', 'pull_up_bar', 'bench', 'ez_bar', 'trap_bar', 'medicine_ball', 'trx',
    'foam_roller', 'cardio_machine', 'other'
  ]);
