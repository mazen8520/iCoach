-- iCoach 0010: tighten function exposure flagged by the Supabase security advisor.

-- Trigger functions are never meant to be called through /rest/v1/rpc. EXECUTE is only checked
-- when a trigger is created, not when it fires, so revoking it doesn't affect the triggers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_role_from_app_metadata() from public, anon, authenticated;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
revoke execute on function public.notify_check_in_submitted() from public, anon, authenticated;
revoke execute on function public.notify_workout_completed() from public, anon, authenticated;
revoke execute on function public.notify_meeting_scheduled() from public, anon, authenticated;
revoke execute on function public.notify_event_scheduled() from public, anon, authenticated;
revoke execute on function public.protect_profile_identity() from public, anon, authenticated;
revoke execute on function public.restrict_client_assignment_update() from public, anon, authenticated;

-- Coach-only RPC: never callable without signing in.
revoke execute on function public.add_client_by_email(text) from public, anon;

-- Pin search_path (advisor: function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;
