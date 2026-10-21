-- iCoach 0013: structured client goals with an audit history.
-- One goals row per athlete. The coach always manages it; the athlete can read it, and can edit it
-- only while the coach has switched client_can_edit on. Every insert/update writes a history row
-- (who, when, field: old -> new) from a trigger, so history cannot be skipped or forged.

create table if not exists public.client_goals (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  primary_goal text,
  primary_goal_custom text,
  secondary_goals text[] not null default '{}',
  target_weight_kg numeric,
  target_body_fat_pct numeric,
  -- centimetres: { waist?, chest?, arms?, hips?, thighs? }
  target_measurements jsonb not null default '{}'::jsonb,
  target_date date,
  -- [{ exercise, weight_kg?, reps? }]
  strength_targets jsonb not null default '[]'::jsonb,
  weekly_training_days smallint,
  notes text,
  experience_level text,
  training_location text,
  client_can_edit boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_goals_primary_values check (primary_goal is null or primary_goal in (
    'fat_loss', 'muscle_gain', 'strength', 'recomposition', 'endurance', 'general_fitness',
    'athletic_performance', 'sport_specific', 'mobility', 'rehab', 'healthy_lifestyle',
    'competition_prep', 'maintenance', 'custom'
  )),
  constraint client_goals_secondary_values check (secondary_goals <@ array[
    'fat_loss', 'muscle_gain', 'strength', 'recomposition', 'endurance', 'general_fitness',
    'athletic_performance', 'sport_specific', 'mobility', 'rehab', 'healthy_lifestyle',
    'competition_prep', 'maintenance', 'custom'
  ]::text[]),
  constraint client_goals_weight_range
    check (target_weight_kg is null or (target_weight_kg > 0 and target_weight_kg < 500)),
  constraint client_goals_body_fat_range
    check (target_body_fat_pct is null or (target_body_fat_pct >= 2 and target_body_fat_pct <= 70)),
  constraint client_goals_measurements_object check (jsonb_typeof(target_measurements) = 'object'),
  constraint client_goals_strength_array check (jsonb_typeof(strength_targets) = 'array'),
  constraint client_goals_days_range
    check (weekly_training_days is null or weekly_training_days between 1 and 7),
  constraint client_goals_experience_values
    check (experience_level is null or experience_level in ('beginner', 'intermediate', 'advanced')),
  constraint client_goals_location_values
    check (training_location is null or training_location in ('home', 'gym', 'both'))
);
create index if not exists client_goals_coach_idx on public.client_goals(coach_id);

create table if not exists public.client_goal_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  -- { field: { "old": <value|null>, "new": <value|null> } }
  changes jsonb not null
);
create index if not exists client_goal_history_client_idx
  on public.client_goal_history(client_id, changed_at desc);

-- Existing free-text goals become the athlete's starting "custom" goal. Runs before the history
-- trigger exists, so it doesn't invent change entries nobody made.
insert into public.client_goals (client_id, coach_id, primary_goal, primary_goal_custom)
select p.id, cc.coach_id, 'custom', btrim(p.goal)
from public.profiles p
join public.coach_clients cc on cc.client_id = p.id
where p.role = 'client' and coalesce(btrim(p.goal), '') <> ''
on conflict (client_id) do nothing;

-- ============================================================
-- Guard: who may change what
-- ============================================================
create or replace function public.guard_client_goals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new; -- service role / SQL editor
  end if;
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' and auth.uid() = old.client_id then
    -- The athlete (not their coach) is editing their own goals.
    if not old.client_can_edit then
      raise exception 'Your coach manages your goals.' using errcode = '42501';
    end if;
    if new.client_can_edit is distinct from old.client_can_edit
      or new.coach_id is distinct from old.coach_id
      or new.client_id is distinct from old.client_id then
      raise exception 'Athletes can only update their goal details.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists client_goals_guard on public.client_goals;
create trigger client_goals_guard before insert or update on public.client_goals
  for each row execute function public.guard_client_goals();

-- ============================================================
-- History: one row per insert/update listing each changed field
-- ============================================================
create or replace function public.log_client_goal_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := to_jsonb(new);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
begin
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key in ('client_id', 'coach_id', 'updated_by', 'created_at', 'updated_at') then
      continue;
    end if;
    if (v_old -> v_key) is distinct from (v_new -> v_key)
      and not (tg_op = 'INSERT' and (
        v_new -> v_key = 'null'::jsonb or v_new -> v_key in ('[]'::jsonb, '{}'::jsonb)
        or (v_key = 'client_can_edit' and v_new -> v_key = 'false'::jsonb)
      )) then
      v_changes := v_changes || jsonb_build_object(
        v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
      );
    end if;
  end loop;

  if v_changes <> '{}'::jsonb then
    insert into public.client_goal_history (client_id, changed_by, changes)
    values (new.client_id, auth.uid(), v_changes);
  end if;
  return new;
end;
$$;

drop trigger if exists client_goals_history on public.client_goals;
create trigger client_goals_history after insert or update on public.client_goals
  for each row execute function public.log_client_goal_change();

revoke execute on function public.log_client_goal_change() from public, anon, authenticated;
revoke execute on function public.guard_client_goals() from public, anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.client_goals enable row level security;
alter table public.client_goal_history enable row level security;

drop policy if exists "client_goals_select" on public.client_goals;
create policy "client_goals_select" on public.client_goals for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));

drop policy if exists "client_goals_coach_insert" on public.client_goals;
create policy "client_goals_coach_insert" on public.client_goals for insert
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

drop policy if exists "client_goals_update" on public.client_goals;
create policy "client_goals_update" on public.client_goals for update
  using (public.is_coach_of(client_id) or (client_id = auth.uid() and client_can_edit))
  with check (
    (coach_id = auth.uid() and public.is_coach_of(client_id))
    or (client_id = auth.uid() and client_can_edit)
  );

drop policy if exists "client_goals_coach_delete" on public.client_goals;
create policy "client_goals_coach_delete" on public.client_goals for delete
  using (public.is_coach_of(client_id));

drop policy if exists "client_goal_history_select" on public.client_goal_history;
create policy "client_goal_history_select" on public.client_goal_history for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));
-- No insert/update/delete policies: history is written only by the security-definer trigger.
