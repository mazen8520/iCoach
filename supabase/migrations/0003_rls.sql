-- iCoach: Row Level Security
-- Every user-facing table is locked down: users see their own data, coaches see
-- data belonging to their linked clients, clients see data belonging to their
-- linked coach where relevant (e.g. workouts assigned to them).

alter table public.profiles enable row level security;
alter table public.coach_clients enable row level security;
alter table public.programs enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.set_logs enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meals enable row level security;
alter table public.meal_logs enable row level security;
alter table public.habit_targets enable row level security;
alter table public.habit_logs enable row level security;
alter table public.progress_entries enable row level security;
alter table public.progress_photos enable row level security;
alter table public.personal_records enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.meetings enable row level security;
alter table public.notifications enable row level security;

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_select_self_or_linked" on public.profiles for select
  using (id = auth.uid() or public.is_coach_of(id) or public.is_client_of(id));
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- inserts happen only via the handle_new_user trigger (security definer).

-- ============================================================
-- coach_clients
-- ============================================================
create policy "coach_clients_select" on public.coach_clients for select
  using (coach_id = auth.uid() or client_id = auth.uid());
create policy "coach_clients_delete_by_coach" on public.coach_clients for delete
  using (coach_id = auth.uid());
-- inserts happen only via the add_client_by_email() function (security definer).

-- ============================================================
-- programs
-- ============================================================
create policy "programs_coach_crud" on public.programs for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "programs_client_select" on public.programs for select
  using (client_id = auth.uid());

-- ============================================================
-- exercises
-- ============================================================
create policy "exercises_coach_crud" on public.exercises for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "exercises_client_select_assigned" on public.exercises for select
  using (exists (
    select 1 from public.workout_exercises we
    join public.workout_assignments wa on wa.workout_id = we.workout_id
    where we.exercise_id = exercises.id and wa.client_id = auth.uid()
  ));

-- ============================================================
-- workouts
-- ============================================================
create policy "workouts_coach_crud" on public.workouts for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "workouts_client_select_assigned" on public.workouts for select
  using (exists (
    select 1 from public.workout_assignments wa
    where wa.workout_id = workouts.id and wa.client_id = auth.uid()
  ));

-- ============================================================
-- workout_exercises
-- ============================================================
create policy "workout_exercises_coach_crud" on public.workout_exercises for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.coach_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.coach_id = auth.uid()));
create policy "workout_exercises_client_select" on public.workout_exercises for select
  using (exists (
    select 1 from public.workout_assignments wa
    where wa.workout_id = workout_exercises.workout_id and wa.client_id = auth.uid()
  ));

-- ============================================================
-- workout_assignments
-- ============================================================
create policy "workout_assignments_coach_crud" on public.workout_assignments for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "workout_assignments_client_select" on public.workout_assignments for select
  using (client_id = auth.uid());
create policy "workout_assignments_client_update_progress" on public.workout_assignments for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- ============================================================
-- set_logs
-- ============================================================
create policy "set_logs_client_crud" on public.set_logs for all
  using (exists (
    select 1 from public.workout_assignments wa
    where wa.id = assignment_id and wa.client_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_assignments wa
    where wa.id = assignment_id and wa.client_id = auth.uid()
  ));
create policy "set_logs_coach_select" on public.set_logs for select
  using (exists (
    select 1 from public.workout_assignments wa
    where wa.id = assignment_id and wa.coach_id = auth.uid()
  ));

-- ============================================================
-- nutrition_plans
-- ============================================================
create policy "nutrition_plans_coach_crud" on public.nutrition_plans for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "nutrition_plans_client_select" on public.nutrition_plans for select
  using (client_id = auth.uid());

-- ============================================================
-- meals
-- ============================================================
create policy "meals_coach_crud" on public.meals for all
  using (exists (select 1 from public.nutrition_plans p where p.id = nutrition_plan_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.nutrition_plans p where p.id = nutrition_plan_id and p.coach_id = auth.uid()));
create policy "meals_client_select" on public.meals for select
  using (exists (select 1 from public.nutrition_plans p where p.id = nutrition_plan_id and p.client_id = auth.uid()));

-- ============================================================
-- meal_logs
-- ============================================================
create policy "meal_logs_client_crud" on public.meal_logs for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "meal_logs_coach_select" on public.meal_logs for select
  using (public.is_coach_of(client_id));

-- ============================================================
-- habit_targets / habit_logs
-- ============================================================
create policy "habit_targets_coach_crud" on public.habit_targets for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "habit_targets_client_select" on public.habit_targets for select
  using (client_id = auth.uid());

create policy "habit_logs_client_crud" on public.habit_logs for all
  using (exists (select 1 from public.habit_targets t where t.id = habit_target_id and t.client_id = auth.uid()))
  with check (exists (select 1 from public.habit_targets t where t.id = habit_target_id and t.client_id = auth.uid()));
create policy "habit_logs_coach_select" on public.habit_logs for select
  using (exists (select 1 from public.habit_targets t where t.id = habit_target_id and t.coach_id = auth.uid()));

-- ============================================================
-- progress_entries / progress_photos / personal_records
-- ============================================================
create policy "progress_entries_client_crud" on public.progress_entries for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "progress_entries_coach_select" on public.progress_entries for select
  using (public.is_coach_of(client_id));

create policy "progress_photos_client_crud" on public.progress_photos for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "progress_photos_coach_select" on public.progress_photos for select
  using (public.is_coach_of(client_id));

create policy "personal_records_client_crud" on public.personal_records for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "personal_records_coach_select" on public.personal_records for select
  using (public.is_coach_of(client_id));

-- ============================================================
-- check_ins / check_in_photos
-- ============================================================
create policy "check_ins_client_insert_select" on public.check_ins for select
  using (client_id = auth.uid() or coach_id = auth.uid());
create policy "check_ins_client_insert" on public.check_ins for insert
  with check (client_id = auth.uid() and public.is_client_of(coach_id));
create policy "check_ins_coach_update" on public.check_ins for update
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create policy "check_in_photos_select" on public.check_in_photos for select
  using (exists (
    select 1 from public.check_ins c
    where c.id = check_in_id and (c.client_id = auth.uid() or c.coach_id = auth.uid())
  ));
create policy "check_in_photos_client_insert" on public.check_in_photos for insert
  with check (exists (select 1 from public.check_ins c where c.id = check_in_id and c.client_id = auth.uid()));

-- ============================================================
-- conversations / messages
-- ============================================================
create policy "conversations_select" on public.conversations for select
  using (coach_id = auth.uid() or client_id = auth.uid());
create policy "conversations_insert" on public.conversations for insert
  with check (
    (coach_id = auth.uid() and public.is_coach_of(client_id)) or
    (client_id = auth.uid() and public.is_client_of(coach_id))
  );

create policy "messages_select" on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.coach_id = auth.uid() or c.client_id = auth.uid())
  ));
create policy "messages_insert" on public.messages for insert
  with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.coach_id = auth.uid() or c.client_id = auth.uid())
    )
  );
create policy "messages_mark_read" on public.messages for update
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.coach_id = auth.uid() or c.client_id = auth.uid())
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.coach_id = auth.uid() or c.client_id = auth.uid())
  ));

-- ============================================================
-- meetings
-- ============================================================
create policy "meetings_coach_crud" on public.meetings for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "meetings_client_select" on public.meetings for select
  using (client_id = auth.uid());

-- ============================================================
-- notifications
-- ============================================================
create policy "notifications_select_own" on public.notifications for select
  using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications for delete
  using (user_id = auth.uid());
