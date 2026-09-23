-- iCoach 0008: keep profiles.role in sync with the server-controlled app_metadata.role.
--
-- Supabase Auth's admin createUser() inserts the auth.users row first and writes custom
-- app_metadata in a follow-up UPDATE, so handle_new_user (AFTER INSERT) can't see the athlete
-- role yet. This trigger applies it when that UPDATE lands. app_metadata is writable only with
-- the service role, so end users still cannot choose their own role.

create or replace function public.sync_role_from_app_metadata()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := new.raw_app_meta_data->>'role';
begin
  if v_role in ('coach', 'client')
    and v_role is distinct from (old.raw_app_meta_data->>'role') then
    update public.profiles set role = v_role::public.user_role where id = new.id;

    if v_role = 'client' then
      update public.coach_clients
      set client_id = new.id, invited_email = null, joined_at = now()
      where invited_email = lower(new.email) and client_id is null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_app_metadata_updated on auth.users;
create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_role_from_app_metadata();

-- Repair any account already created with app_metadata.role but the wrong profile role.
update public.profiles p
set role = (u.raw_app_meta_data->>'role')::public.user_role
from auth.users u
where u.id = p.id
  and u.raw_app_meta_data->>'role' in ('coach', 'client')
  and p.role::text is distinct from u.raw_app_meta_data->>'role';
