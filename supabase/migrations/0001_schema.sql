-- iCoach: core schema
-- Roles: 'coach' | 'client'. One client has at most one coach (coach_clients.client_id is unique).

create extension if not exists pgcrypto;

create type public.user_role as enum ('coach', 'client');
create type public.workout_status as enum ('scheduled', 'completed', 'skipped');
create type public.program_status as enum ('active', 'completed', 'paused');
create type public.checkin_status as enum ('pending', 'reviewed');
create type public.meeting_status as enum ('scheduled', 'completed', 'cancelled');
create type public.sleep_quality as enum ('poor', 'okay', 'strong');
create type public.photo_angle as enum ('front', 'side', 'back');

-- ============================================================
-- Profiles (1:1 with auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'client',
  full_name text not null default '',
  avatar_url text,
  bio text,
  phone text,
  goal text,
  timezone text not null default 'UTC',
  notification_prefs jsonb not null default '{}'::jsonb,
  daily_report_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user; role determines coach vs client experience.';

-- ============================================================
-- Coach <-> Client relationship
-- ============================================================
create table public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid unique references public.profiles(id) on delete cascade,
  invited_email text,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coach_clients_target check (client_id is not null or invited_email is not null)
);
create index coach_clients_coach_idx on public.coach_clients(coach_id);

-- ============================================================
-- Programs (a training block assigned to one client)
-- ============================================================
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null default current_date,
  status public.program_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_client_idx on public.programs(client_id);
create index programs_coach_idx on public.programs(coach_id);

-- ============================================================
-- Exercise library
-- ============================================================
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  muscle_group text,
  equipment text,
  instructions text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);
create index exercises_coach_idx on public.exercises(coach_id);

-- ============================================================
-- Workouts (templates) + exercises + assignments + set logs
-- ============================================================
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  title text not null,
  description text,
  cover_image_url text,
  duration_minutes integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_coach_idx on public.workouts(coach_id);
create index workouts_program_idx on public.workouts(program_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  order_index integer not null default 0,
  sets integer not null default 3,
  reps text not null default '',
  load text,
  rest_seconds integer,
  notes text
);
create index workout_exercises_workout_idx on public.workout_exercises(workout_id);

create table public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  status public.workout_status not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index workout_assignments_client_idx on public.workout_assignments(client_id, scheduled_date);
create index workout_assignments_coach_idx on public.workout_assignments(coach_id, scheduled_date);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.workout_assignments(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  reps_done integer,
  weight_used numeric,
  completed_at timestamptz not null default now(),
  unique (assignment_id, workout_exercise_id, set_number)
);
create index set_logs_assignment_idx on public.set_logs(assignment_id);

-- ============================================================
-- Nutrition
-- ============================================================
create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  day_type text not null default 'training',
  target_calories integer not null default 0,
  target_protein_g integer not null default 0,
  target_carbs_g integer not null default 0,
  target_fat_g integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index nutrition_plans_client_idx on public.nutrition_plans(client_id);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  nutrition_plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  name text not null,
  meal_time time,
  order_index integer not null default 0,
  foods_summary text,
  calories integer not null default 0,
  protein_g integer not null default 0,
  carbs_g integer not null default 0,
  fat_g integer not null default 0
);
create index meals_plan_idx on public.meals(nutrition_plan_id);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (meal_id, log_date)
);
create index meal_logs_client_idx on public.meal_logs(client_id, log_date);

-- ============================================================
-- Habits (e.g. water intake) — generic daily target/log
-- ============================================================
create table public.habit_targets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_value numeric not null default 1,
  unit text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index habit_targets_client_idx on public.habit_targets(client_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_target_id uuid not null references public.habit_targets(id) on delete cascade,
  log_date date not null default current_date,
  value_logged numeric not null default 0,
  completed boolean not null default false,
  unique (habit_target_id, log_date)
);

-- ============================================================
-- Progress: weight/measurements, photos, personal records
-- ============================================================
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (client_id, entry_date)
);
create index progress_entries_client_idx on public.progress_entries(client_id, entry_date);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  angle public.photo_angle not null default 'front',
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index progress_photos_client_idx on public.progress_photos(client_id, entry_date);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null,
  value text not null,
  previous_value text,
  achieved_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index personal_records_client_idx on public.personal_records(client_id);

-- ============================================================
-- Check-ins
-- ============================================================
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  weight_kg numeric,
  energy integer check (energy between 1 and 10),
  sleep_hours numeric,
  sleep_quality public.sleep_quality,
  mood text,
  training_feedback text,
  status public.checkin_status not null default 'pending',
  coach_feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (client_id, week_start_date)
);
create index check_ins_coach_idx on public.check_ins(coach_id, status);
create index check_ins_client_idx on public.check_ins(client_id);

create table public.check_in_photos (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  angle public.photo_angle not null default 'front',
  storage_path text not null
);

-- ============================================================
-- Messaging
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (coach_id, client_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- ============================================================
-- Meetings
-- ============================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  status public.meeting_status not null default 'scheduled',
  video_url text,
  created_at timestamptz not null default now()
);
create index meetings_coach_idx on public.meetings(coach_id, scheduled_at);
create index meetings_client_idx on public.meetings(client_id, scheduled_at);

-- ============================================================
-- Notifications
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
