-- Performance + defence-in-depth pass from the October 2026 security audit.
--
-- 1. Row-level security: every policy that called auth.uid() directly re-evaluated it for every
--    row scanned. Wrapping it as (select auth.uid()) lets Postgres evaluate it once per query
--    (Supabase advisor "auth_rls_initplan"). The policy logic itself is unchanged — the rewrite is
--    generated from the live definitions, and the negative lookbehind keeps it idempotent.
-- 2. Indexes for the foreign keys that had none, so joins, RLS EXISTS checks and cascading deletes
--    stop scanning whole tables as data grows.
-- 3. Signed-out visitors (the `anon` role) never read tables directly — the public home page only
--    calls platform_stats(). Their table and helper-function privileges are removed, so a leaked
--    publishable key can't be used to probe data even if a future policy is written too loosely.

do $$
declare
  p record;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.uid\(\)'
        or coalesce(with_check, '') ~ '(?<!SELECT )auth\.uid\(\)')
  loop
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      stmt := stmt || ' using (' ||
        regexp_replace(p.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') || ')';
    end if;
    if p.with_check is not null then
      stmt := stmt || ' with check (' ||
        regexp_replace(p.with_check, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') || ')';
    end if;
    execute stmt;
  end loop;
end $$;

create index if not exists check_in_photos_check_in_id_idx on public.check_in_photos (check_in_id);
create index if not exists client_goal_history_changed_by_idx on public.client_goal_history (changed_by);
create index if not exists client_goals_updated_by_idx on public.client_goals (updated_by);
create index if not exists conversations_client_id_idx on public.conversations (client_id);
create index if not exists exercises_source_exercise_id_idx on public.exercises (source_exercise_id);
create index if not exists habit_targets_coach_id_idx on public.habit_targets (coach_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists set_logs_workout_exercise_id_idx on public.set_logs (workout_exercise_id);
create index if not exists workout_assignments_workout_id_idx on public.workout_assignments (workout_id);
create index if not exists workout_exercises_exercise_id_idx on public.workout_exercises (exercise_id);
create index if not exists zoom_oauth_states_coach_id_idx on public.zoom_oauth_states (coach_id);

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

revoke execute on function public."current_role"() from anon, public;
revoke execute on function public.is_client_of(uuid) from anon, public;
revoke execute on function public.is_coach_of(uuid) from anon, public;
revoke execute on function public.is_workout_owner(uuid) from anon, public;
revoke execute on function public.my_coach_id() from anon, public;
grant execute on function public."current_role"() to authenticated;
grant execute on function public.is_client_of(uuid) to authenticated;
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.is_workout_owner(uuid) to authenticated;
grant execute on function public.my_coach_id() to authenticated;
-- platform_stats() stays callable by anon: it returns only aggregate counts for the home page.
