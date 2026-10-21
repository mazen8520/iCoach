-- iCoach 0015: aggregate platform figures for the public home page.
-- Returns three whole-platform counts and nothing else: no names, ids or per-user data.

create or replace function public.platform_stats()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'athletes_coached', (select count(*) from public.coach_clients where client_id is not null),
    'workouts_completed', (select count(*) from public.workout_assignments where status = 'completed'),
    'programs_created', (select count(*) from public.workouts)
  );
$$;

revoke execute on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;
