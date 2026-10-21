-- iCoach 0014: day-by-day nutrition planning (Saturday -> Friday), food items with "or" swaps,
-- plan templates, and calories/macros moved out of every table an athlete can read.
--
-- Calories and macros now live only in nutrition_plan_targets and meal_macros, whose RLS admits
-- the owning coach alone. Row-level security cannot hide single columns, so keeping those numbers
-- on nutrition_plans/meals would have leaked them to athletes through the API even if the UI hid
-- them. Existing values are copied across before the old columns are dropped.
--
-- Weekdays use JavaScript's numbering (0 = Sunday ... 6 = Saturday); the app lists them starting
-- on Saturday.

-- ============================================================
-- 1. Coach-only nutrition numbers
-- ============================================================
create table if not exists public.nutrition_plan_targets (
  plan_id uuid primary key references public.nutrition_plans(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  target_calories integer not null default 0 check (target_calories >= 0),
  target_protein_g integer not null default 0 check (target_protein_g >= 0),
  target_carbs_g integer not null default 0 check (target_carbs_g >= 0),
  target_fat_g integer not null default 0 check (target_fat_g >= 0)
);
create index if not exists nutrition_plan_targets_coach_idx on public.nutrition_plan_targets(coach_id);

create table if not exists public.meal_macros (
  meal_id uuid primary key references public.meals(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  calories integer not null default 0 check (calories >= 0),
  protein_g integer not null default 0 check (protein_g >= 0),
  carbs_g integer not null default 0 check (carbs_g >= 0),
  fat_g integer not null default 0 check (fat_g >= 0)
);
create index if not exists meal_macros_coach_idx on public.meal_macros(coach_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nutrition_plans' and column_name = 'target_calories'
  ) then
    insert into public.nutrition_plan_targets
      (plan_id, coach_id, target_calories, target_protein_g, target_carbs_g, target_fat_g)
    select id, coach_id, target_calories, target_protein_g, target_carbs_g, target_fat_g
    from public.nutrition_plans
    on conflict (plan_id) do nothing;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meals' and column_name = 'calories'
  ) then
    insert into public.meal_macros (meal_id, coach_id, calories, protein_g, carbs_g, fat_g)
    select m.id, p.coach_id, m.calories, m.protein_g, m.carbs_g, m.fat_g
    from public.meals m
    join public.nutrition_plans p on p.id = m.nutrition_plan_id
    on conflict (meal_id) do nothing;
  end if;
end $$;

alter table public.nutrition_plan_targets enable row level security;
alter table public.meal_macros enable row level security;

drop policy if exists "nutrition_plan_targets_coach_crud" on public.nutrition_plan_targets;
create policy "nutrition_plan_targets_coach_crud" on public.nutrition_plan_targets for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.nutrition_plans p where p.id = plan_id and p.coach_id = auth.uid())
  );

drop policy if exists "meal_macros_coach_crud" on public.meal_macros;
create policy "meal_macros_coach_crud" on public.meal_macros for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.meals m
      join public.nutrition_plans p on p.id = m.nutrition_plan_id
      where m.id = meal_id and p.coach_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Plans: templates and per-weekday day types
-- ============================================================
alter table public.nutrition_plans
  add column if not exists is_template boolean not null default false,
  -- { "<weekday 0-6>": "training" | "rest" | "refeed" }
  add column if not exists day_types jsonb not null default '{}'::jsonb;
alter table public.nutrition_plans alter column client_id drop not null;

alter table public.nutrition_plans drop constraint if exists nutrition_plans_template_client;
alter table public.nutrition_plans
  add constraint nutrition_plans_template_client check (
    (is_template and client_id is null) or (not is_template and client_id is not null)
  );
alter table public.nutrition_plans drop constraint if exists nutrition_plans_day_types_object;
alter table public.nutrition_plans
  add constraint nutrition_plans_day_types_object check (jsonb_typeof(day_types) = 'object');

-- Templates belong to no athlete; everything else must still target one of the coach's athletes.
drop policy if exists "nutrition_plans_coach_crud" on public.nutrition_plans;
create policy "nutrition_plans_coach_crud" on public.nutrition_plans for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and public.current_role() = 'coach'
    and ((is_template and client_id is null) or public.is_coach_of(client_id))
  );

-- ============================================================
-- 3. Meals: one weekday each
-- ============================================================
alter table public.meals add column if not exists day_of_week smallint;

-- Existing meals applied to every day. Give each one its own copy on all seven days (the original
-- keeps Saturday so its past check-offs stay attached), including its coach-only macros.
do $$
declare
  v_meal record;
  v_day smallint;
  v_new uuid;
begin
  for v_meal in select * from public.meals where day_of_week is null loop
    for v_day in 0..5 loop
      insert into public.meals (nutrition_plan_id, name, meal_time, order_index, foods_summary, day_of_week)
      values (v_meal.nutrition_plan_id, v_meal.name, v_meal.meal_time, v_meal.order_index,
              v_meal.foods_summary, v_day)
      returning id into v_new;
      insert into public.meal_macros (meal_id, coach_id, calories, protein_g, carbs_g, fat_g)
      select v_new, coach_id, calories, protein_g, carbs_g, fat_g
      from public.meal_macros where meal_id = v_meal.id;
    end loop;
    update public.meals set day_of_week = 6 where id = v_meal.id;
  end loop;
end $$;

alter table public.meals alter column day_of_week set not null;
alter table public.meals drop constraint if exists meals_day_of_week_range;
alter table public.meals
  add constraint meals_day_of_week_range check (day_of_week between 0 and 6);
create index if not exists meals_plan_day_idx on public.meals(nutrition_plan_id, day_of_week, order_index);

-- ============================================================
-- 4. Food items inside a meal, with alternative ("or") options
-- ============================================================
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  order_index integer not null default 0,
  name text not null check (length(btrim(name)) > 0),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text check (unit is null or unit in (
    'g', 'ml', 'pieces', 'cups', 'tbsp', 'tsp', 'scoop', 'slice', 'serving'
  )),
  notes text,
  -- [{ name, quantity?, unit? }]
  alternatives jsonb not null default '[]'::jsonb check (jsonb_typeof(alternatives) = 'array')
);
create index if not exists meal_items_meal_idx on public.meal_items(meal_id, order_index);

alter table public.meal_items enable row level security;

drop policy if exists "meal_items_coach_crud" on public.meal_items;
create policy "meal_items_coach_crud" on public.meal_items for all
  using (exists (
    select 1 from public.meals m
    join public.nutrition_plans p on p.id = m.nutrition_plan_id
    where m.id = meal_id and p.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.meals m
    join public.nutrition_plans p on p.id = m.nutrition_plan_id
    where m.id = meal_id and p.coach_id = auth.uid()
  ));

drop policy if exists "meal_items_client_select" on public.meal_items;
create policy "meal_items_client_select" on public.meal_items for select
  using (exists (
    select 1 from public.meals m
    join public.nutrition_plans p on p.id = m.nutrition_plan_id
    where m.id = meal_id and p.client_id = auth.uid()
  ));

-- ============================================================
-- 5. Drop the calorie/macro columns athletes could read
-- ============================================================
alter table public.nutrition_plans
  drop column if exists target_calories,
  drop column if exists target_protein_g,
  drop column if exists target_carbs_g,
  drop column if exists target_fat_g;
alter table public.meals
  drop column if exists calories,
  drop column if exists protein_g,
  drop column if exists carbs_g,
  drop column if exists fat_g;

-- ============================================================
-- 6. Copy helpers (run as the caller, so RLS still applies to every row they touch)
-- ============================================================

-- Copies one meal (with its items and coach-only macros) onto a plan/weekday; returns the new id.
create or replace function public.copy_meal_to(p_meal_id uuid, p_plan_id uuid, p_day smallint)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_new uuid;
begin
  insert into public.meals (nutrition_plan_id, name, meal_time, order_index, foods_summary, day_of_week)
  select p_plan_id, name, meal_time, order_index, foods_summary, p_day
  from public.meals where id = p_meal_id
  returning id into v_new;

  insert into public.meal_items (meal_id, order_index, name, quantity, unit, notes, alternatives)
  select v_new, order_index, name, quantity, unit, notes, alternatives
  from public.meal_items where meal_id = p_meal_id;

  insert into public.meal_macros (meal_id, coach_id, calories, protein_g, carbs_g, fat_g)
  select v_new, coach_id, calories, protein_g, carbs_g, fat_g
  from public.meal_macros where meal_id = p_meal_id;

  return v_new;
end;
$$;

-- Replaces the meals on each target weekday with copies of the source weekday's meals.
create or replace function public.copy_nutrition_day(
  p_plan_id uuid,
  p_from_day smallint,
  p_to_days smallint[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_day smallint;
  v_meal record;
begin
  if not exists (select 1 from public.nutrition_plans where id = p_plan_id and coach_id = auth.uid()) then
    raise exception 'Nutrition plan not found.' using errcode = '42501';
  end if;
  foreach v_day in array p_to_days loop
    if v_day = p_from_day or v_day not between 0 and 6 then
      continue;
    end if;
    delete from public.meals where nutrition_plan_id = p_plan_id and day_of_week = v_day;
    for v_meal in
      select id from public.meals
      where nutrition_plan_id = p_plan_id and day_of_week = p_from_day
      order by order_index
    loop
      perform public.copy_meal_to(v_meal.id, p_plan_id, v_day);
    end loop;
  end loop;
end;
$$;

-- Duplicates a whole plan: as a template (p_as_template) or as a plan for one athlete.
-- Covers "save as template", "assign template to athlete" and "copy a whole week".
create or replace function public.copy_nutrition_plan(
  p_source_id uuid,
  p_client_id uuid,
  p_name text,
  p_as_template boolean
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_new uuid;
  v_meal record;
begin
  insert into public.nutrition_plans
    (coach_id, client_id, name, day_type, notes, is_active, is_template, day_types)
  select auth.uid(),
         case when p_as_template then null else p_client_id end,
         coalesce(nullif(btrim(p_name), ''), name),
         day_type, notes, not p_as_template, p_as_template, day_types
  from public.nutrition_plans
  where id = p_source_id and coach_id = auth.uid()
  returning id into v_new;

  if v_new is null then
    raise exception 'Nutrition plan not found.' using errcode = '42501';
  end if;

  insert into public.nutrition_plan_targets
    (plan_id, coach_id, target_calories, target_protein_g, target_carbs_g, target_fat_g)
  select v_new, coach_id, target_calories, target_protein_g, target_carbs_g, target_fat_g
  from public.nutrition_plan_targets where plan_id = p_source_id;

  for v_meal in
    select id, day_of_week from public.meals
    where nutrition_plan_id = p_source_id
    order by day_of_week, order_index
  loop
    perform public.copy_meal_to(v_meal.id, v_new, v_meal.day_of_week);
  end loop;

  return v_new;
end;
$$;

revoke execute on function public.copy_meal_to(uuid, uuid, smallint) from public, anon;
revoke execute on function public.copy_nutrition_day(uuid, smallint, smallint[]) from public, anon;
revoke execute on function public.copy_nutrition_plan(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.copy_meal_to(uuid, uuid, smallint) to authenticated;
grant execute on function public.copy_nutrition_day(uuid, smallint, smallint[]) to authenticated;
grant execute on function public.copy_nutrition_plan(uuid, uuid, text, boolean) to authenticated;
