-- iCoach 0007: role-separation hardening, coach schedule events, meeting links, multi-plan
-- nutrition details, structured notification metadata and storage listing lockdown.

-- ============================================================
-- 1. Account role is decided server-side only
-- ============================================================
-- Public sign-up always creates a coach. Athletes are only ever created by their coach through
-- the server-side createAthleteAccount function, which marks them in app_metadata — writable only
-- with the service-role key — so nobody can self-register as an athlete by passing role metadata
-- to signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role := case
    when new.raw_app_meta_data->>'role' = 'client' then 'client'::public.user_role
    else 'coach'::public.user_role
  end;
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), v_role);

  -- Pending coach invites only ever apply to athlete accounts.
  if v_role = 'client' then
    update public.coach_clients
    set client_id = new.id, invited_email = null, joined_at = now()
    where invited_email = lower(new.email) and client_id is null;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 2. Users can never change their own role or email on their profile row
-- ============================================================
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role and SQL-editor requests carry no end-user JWT (auth.uid() is null).
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'You cannot change your account role.' using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'Your email can only be changed through account authentication.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity before update on public.profiles
  for each row execute function public.protect_profile_identity();

-- ============================================================
-- 3. Coach-only writes: the writer must be a coach, and client-scoped rows must target one of
--    the coach's own linked athletes (previously any client_id was accepted).
-- ============================================================
drop policy if exists "programs_coach_crud" on public.programs;
create policy "programs_coach_crud" on public.programs for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

drop policy if exists "exercises_coach_crud" on public.exercises;
create policy "exercises_coach_crud" on public.exercises for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.current_role() = 'coach');

drop policy if exists "workouts_coach_crud" on public.workouts;
create policy "workouts_coach_crud" on public.workouts for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.current_role() = 'coach');

drop policy if exists "workout_assignments_coach_crud" on public.workout_assignments;
create policy "workout_assignments_coach_crud" on public.workout_assignments for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and public.is_coach_of(client_id)
    and exists (select 1 from public.workouts w where w.id = workout_id and w.coach_id = auth.uid())
  );

drop policy if exists "nutrition_plans_coach_crud" on public.nutrition_plans;
create policy "nutrition_plans_coach_crud" on public.nutrition_plans for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

drop policy if exists "habit_targets_coach_crud" on public.habit_targets;
create policy "habit_targets_coach_crud" on public.habit_targets for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

drop policy if exists "meetings_coach_crud" on public.meetings;
create policy "meetings_coach_crud" on public.meetings for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

-- Athletes may only record progress on their own assignments — never re-point them at another
-- workout, coach, athlete or date.
create or replace function public.restrict_client_assignment_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.client_id and auth.uid() <> old.coach_id then
    if new.workout_id is distinct from old.workout_id
      or new.client_id is distinct from old.client_id
      or new.coach_id is distinct from old.coach_id
      or new.scheduled_date is distinct from old.scheduled_date
      or new.scheduled_time is distinct from old.scheduled_time
      or new.created_at is distinct from old.created_at then
      raise exception 'Athletes can only update workout progress.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workout_assignments_restrict_client_update on public.workout_assignments;
create trigger workout_assignments_restrict_client_update
  before update on public.workout_assignments
  for each row execute function public.restrict_client_assignment_update();

-- ============================================================
-- 4. Meetings: the Zoom meeting link lives in meetings.video_url; only http(s) links are stored
--    so a link can never be rendered as a javascript: URL.
-- ============================================================
alter table public.meetings drop constraint if exists meetings_video_url_http;
alter table public.meetings
  add constraint meetings_video_url_http check (video_url is null or video_url ~* '^https?://');

-- ============================================================
-- 5. Nutrition: a coach can run several plans per athlete; each plan carries its own notes.
-- ============================================================
alter table public.nutrition_plans add column if not exists notes text;
create index if not exists nutrition_plans_coach_idx on public.nutrition_plans(coach_id);

-- ============================================================
-- 6. Coach schedule events (custom calendar entries, optionally tied to one athlete)
-- ============================================================
create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text,
  event_type text not null default 'session'
    check (event_type in ('session', 'check_in', 'reminder', 'call', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_events_time_order check (ends_at > starts_at)
);
create index if not exists schedule_events_coach_idx on public.schedule_events(coach_id, starts_at);
create index if not exists schedule_events_client_idx on public.schedule_events(client_id, starts_at);

drop trigger if exists schedule_events_set_updated_at on public.schedule_events;
create trigger schedule_events_set_updated_at before update on public.schedule_events
  for each row execute function public.set_updated_at();

alter table public.schedule_events enable row level security;

drop policy if exists "schedule_events_coach_crud" on public.schedule_events;
create policy "schedule_events_coach_crud" on public.schedule_events for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and public.current_role() = 'coach'
    and (client_id is null or public.is_coach_of(client_id))
  );

drop policy if exists "schedule_events_client_select" on public.schedule_events;
create policy "schedule_events_client_select" on public.schedule_events for select
  using (client_id = auth.uid());

-- ============================================================
-- 7. Notifications carry structured metadata so the UI can render them in any language
-- ============================================================
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_recipient uuid;
  v_sender_name text;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  v_recipient := case when new.sender_id = v_conversation.coach_id
    then v_conversation.client_id else v_conversation.coach_id end;
  select full_name into v_sender_name from public.profiles where id = new.sender_id;

  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

  insert into public.notifications
    (user_id, type, title, body, related_entity_type, related_entity_id, metadata)
  values (v_recipient, 'message', 'New message from ' || coalesce(v_sender_name, 'someone'), new.body,
          'conversation', new.conversation_id,
          jsonb_build_object('actor_name', v_sender_name));
  return new;
end;
$$;

create or replace function public.notify_check_in_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_name text;
begin
  select full_name into v_client_name from public.profiles where id = new.client_id;
  insert into public.notifications
    (user_id, type, title, body, related_entity_type, related_entity_id, metadata)
  values (new.coach_id, 'check_in', coalesce(v_client_name, 'A client') || ' submitted a check-in',
          new.training_feedback, 'check_in', new.id,
          jsonb_build_object('actor_name', v_client_name));
  return new;
end;
$$;

create or replace function public.notify_workout_completed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_name text;
  v_workout_title text;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    select full_name into v_client_name from public.profiles where id = new.client_id;
    select title into v_workout_title from public.workouts where id = new.workout_id;
    insert into public.notifications
      (user_id, type, title, body, related_entity_type, related_entity_id, metadata)
    values (new.coach_id, 'workout_completed',
            coalesce(v_client_name, 'A client') || ' completed ' || coalesce(v_workout_title, 'a workout'),
            null, 'workout_assignment', new.id,
            jsonb_build_object('actor_name', v_client_name, 'workout_title', v_workout_title));
  end if;
  return new;
end;
$$;

create or replace function public.notify_meeting_scheduled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications
    (user_id, type, title, body, related_entity_type, related_entity_id, metadata)
  values (new.client_id, 'meeting', 'New meeting scheduled: ' || new.title, null, 'meeting', new.id,
          jsonb_build_object('meeting_title', new.title, 'scheduled_at', new.scheduled_at));
  return new;
end;
$$;

create or replace function public.notify_event_scheduled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.client_id is not null then
    insert into public.notifications
      (user_id, type, title, body, related_entity_type, related_entity_id, metadata)
    values (new.client_id, 'event', 'New event scheduled: ' || new.title, new.description,
            'schedule_event', new.id,
            jsonb_build_object('event_title', new.title, 'starts_at', new.starts_at));
  end if;
  return new;
end;
$$;

drop trigger if exists on_schedule_event_created on public.schedule_events;
create trigger on_schedule_event_created
  after insert on public.schedule_events
  for each row execute function public.notify_event_scheduled();

-- ============================================================
-- 8. Storage: public buckets serve files by URL without any SELECT policy, so the old
--    "anyone can read" policies only served to let anyone LIST every user's files. Restrict
--    listing to the owner's own folder, and only coaches may upload training media.
-- ============================================================
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_read" on storage.objects;
create policy "avatars_owner_read" on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media_public_read" on storage.objects;
drop policy if exists "media_owner_read" on storage.objects;
create policy "media_owner_read" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media_owner_write" on storage.objects;
create policy "media_owner_write" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_role() = 'coach'
  );
