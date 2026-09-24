-- iCoach 0011: Zoom integration. Coaches connect their own Zoom account (OAuth, user-managed app);
-- scheduling a meeting creates a real Zoom meeting whose links are stored on the meeting row.

-- ============================================================
-- 1. Per-coach Zoom OAuth connection
-- ============================================================
-- Tokens are AES-256-GCM encrypted by the app server before they are written
-- (ZOOM_TOKEN_ENCRYPTION_KEY), and the table has RLS with no policies: only the service role
-- (server code) can read or write it. The browser learns connection status through a server
-- function that never returns the tokens.
create table if not exists public.zoom_connections (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  zoom_user_id text not null,
  zoom_account_id text,
  zoom_email text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists zoom_connections_zoom_user_idx on public.zoom_connections(zoom_user_id);

drop trigger if exists zoom_connections_set_updated_at on public.zoom_connections;
create trigger zoom_connections_set_updated_at before update on public.zoom_connections
  for each row execute function public.set_updated_at();

alter table public.zoom_connections enable row level security;
revoke all on public.zoom_connections from anon, authenticated;

-- ============================================================
-- 2. One-time OAuth state (CSRF protection + PKCE verifier), consumed by the callback
-- ============================================================
create table if not exists public.zoom_oauth_states (
  state text primary key,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  code_verifier text not null,
  created_at timestamptz not null default now()
);
create index if not exists zoom_oauth_states_created_idx on public.zoom_oauth_states(created_at);

alter table public.zoom_oauth_states enable row level security;
revoke all on public.zoom_oauth_states from anon, authenticated;

-- ============================================================
-- 3. Zoom fields on meetings. video_url keeps holding the join link (already http(s)-checked).
--    The host start_url is never stored: it is fetched on demand because it expires.
-- ============================================================
alter table public.meetings add column if not exists zoom_meeting_id text;
alter table public.meetings add column if not exists zoom_passcode text;
alter table public.meetings add column if not exists zoom_started_at timestamptz;
alter table public.meetings add column if not exists zoom_ended_at timestamptz;
create index if not exists meetings_zoom_meeting_idx on public.meetings(zoom_meeting_id)
  where zoom_meeting_id is not null;
