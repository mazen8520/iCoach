-- iCoach 0009: the workout_assignments write check from 0007 looked up `workouts` directly, whose
-- athlete-read policy looks up `workout_assignments` — Postgres rejects that as infinite policy
-- recursion. Check workout ownership through a security-definer helper instead (the same pattern
-- as is_coach_of), which reads `workouts` without re-entering RLS.

create or replace function public.is_workout_owner(target_workout_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workouts where id = target_workout_id and coach_id = auth.uid()
  );
$$;

drop policy if exists "workout_assignments_coach_crud" on public.workout_assignments;
create policy "workout_assignments_coach_crud" on public.workout_assignments for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and public.is_coach_of(client_id)
    and public.is_workout_owner(workout_id)
  );
