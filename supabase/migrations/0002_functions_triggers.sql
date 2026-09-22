-- iCoach: functions & triggers

-- ============================================================
-- updated_at helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger programs_set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger workouts_set_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

-- ============================================================
-- New auth user -> profile row
-- Role and full name come from signUp() options.data metadata.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'coach' then 'coach'::public.user_role
      else 'client'::public.user_role
    end
  );

  -- If a coach already invited this email, link the new client automatically.
  update public.coach_clients
  set client_id = new.id, invited_email = null, joined_at = now()
  where invited_email = new.email and client_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS helper functions (security definer to avoid recursive RLS lookups)
-- ============================================================
create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_coach_of(target_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and client_id = target_client_id
  );
$$;

create or replace function public.is_client_of(target_coach_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where client_id = auth.uid() and coach_id = target_coach_id
  );
$$;

create or replace function public.my_coach_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select coach_id from public.coach_clients where client_id = auth.uid();
$$;

-- ============================================================
-- Add client by email (coach-initiated). If the email has no account
-- yet, stores a pending invite that auto-links on sign-up.
-- ============================================================
create or replace function public.add_client_by_email(p_email text)
returns public.coach_clients
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_id uuid;
  v_row public.coach_clients;
begin
  if public.current_role() <> 'coach' then
    raise exception 'Only coaches can add clients';
  end if;

  select id into v_client_id
  from public.profiles
  where email = lower(p_email) and role = 'client';

  if v_client_id is not null then
    if exists (select 1 from public.coach_clients where client_id = v_client_id) then
      raise exception 'This client already has a coach';
    end if;
    insert into public.coach_clients (coach_id, client_id, joined_at)
    values (auth.uid(), v_client_id, now())
    returning * into v_row;
  else
    insert into public.coach_clients (coach_id, invited_email)
    values (auth.uid(), lower(p_email))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ============================================================
-- Notifications: auto-create on key events
-- ============================================================
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

  insert into public.notifications (user_id, type, title, body, related_entity_type, related_entity_id)
  values (v_recipient, 'message', 'New message from ' || coalesce(v_sender_name, 'someone'), new.body,
          'conversation', new.conversation_id);
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.notify_new_message();

create or replace function public.notify_check_in_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_name text;
begin
  select full_name into v_client_name from public.profiles where id = new.client_id;
  insert into public.notifications (user_id, type, title, body, related_entity_type, related_entity_id)
  values (new.coach_id, 'check_in', coalesce(v_client_name, 'A client') || ' submitted a check-in',
          new.training_feedback, 'check_in', new.id);
  return new;
end;
$$;

create trigger on_check_in_created
  after insert on public.check_ins
  for each row execute function public.notify_check_in_submitted();

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
    insert into public.notifications (user_id, type, title, body, related_entity_type, related_entity_id)
    values (new.coach_id, 'workout_completed',
            coalesce(v_client_name, 'A client') || ' completed ' || coalesce(v_workout_title, 'a workout'),
            null, 'workout_assignment', new.id);
  end if;
  return new;
end;
$$;

create trigger on_workout_assignment_updated
  after update on public.workout_assignments
  for each row execute function public.notify_workout_completed();

create or replace function public.notify_meeting_scheduled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, related_entity_type, related_entity_id)
  values (new.client_id, 'meeting', 'New meeting scheduled: ' || new.title, null, 'meeting', new.id);
  return new;
end;
$$;

create trigger on_meeting_created
  after insert on public.meetings
  for each row execute function public.notify_meeting_scheduled();
