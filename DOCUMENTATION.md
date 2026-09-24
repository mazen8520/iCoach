# iCoach — Documentation

iCoach is a premium online fitness coaching platform connecting coaches and their athletes
around programs, workouts, nutrition, progress tracking, check-ins, messaging and meetings.
This document explains how the application is built, how data flows from the database to the
UI, and exactly which formulas and calculations are used where.

> Written for: the developer(s) maintaining or extending this codebase after the Supabase
> backend was connected to the previously frontend-only prototype.

---

## 1. Project overview

**Coach functionality**: manage a roster of athletes, build workout templates from an exercise
library and assign them on a schedule, create nutrition plans, review weekly check-ins, message
clients, schedule 1:1 meetings, and see roster-wide analytics (completion, streaks, at-risk
athletes).

**Client functionality**: see today's plan (workout + meals + habits) as one actionable list,
run through an active workout session with set-by-set logging and a rest timer, follow a
nutrition plan, log body-weight/PRs, submit weekly check-ins (with optional progress photos),
message their coach, and see upcoming meetings on a calendar.

**Architecture**: TanStack Start (file-based routing, SSR-capable Vite app) + React 19 +
TanStack Query for data fetching/caching + Supabase (Postgres, Auth, Storage, Realtime) as the
entire backend. There is no custom API server — the browser talks to Supabase directly, secured
by Row Level Security (RLS).

---

## 2. Supabase

### 2.1 Database structure

All tables live in the `public` schema. SQL migrations are in `supabase/migrations/`, applied in
order:

| File | Contents |
| --- | --- |
| `0001_schema.sql` | Enums + all tables |
| `0002_functions_triggers.sql` | `handle_new_user`, RLS helper functions, `add_client_by_email`, notification triggers |
| `0003_rls.sql` | Row Level Security policies for every table |
| `0004_storage.sql` | Storage buckets + their policies, realtime publication |
| `0005_fix_exercise_fk.sql` | Fixes `workout_exercises.exercise_id` to `on delete cascade` (see note below) |
| `0006_athlete_profile_fields.sql` | Adds `age`, `sex`, `height_cm` to `profiles` for coach-created athlete accounts |
| `0007_roles_events_meetings_nutrition.sql` | Role-separation hardening (role decided server-side, role/email immutable, coach writes limited to linked athletes), `schedule_events` table, meeting-link check, `nutrition_plans.notes`, notification `metadata`, storage listing lockdown |
| `0008_sync_role_from_app_metadata.sql` | Applies `app_metadata.role` to `profiles.role` when Supabase Auth writes it (it lands in an UPDATE after the insert) |
| `0009_fix_assignment_policy_recursion.sql` | `is_workout_owner()` helper so the assignment write policy doesn't recurse through `workouts` RLS |
| `0010_function_privileges.sql` | Revokes RPC access to trigger-only functions, pins `set_updated_at` search_path |
| `0011_zoom_integration.sql` | Zoom: `zoom_connections` + `zoom_oauth_states` (server-only, RLS with no policies), Zoom columns on `meetings` |

**Tables**

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users`. Role (`coach`/`client`), name, avatar, bio, goal, basic biometrics for athletes (`age`, `sex`, `height_cm` — set by the coach at account creation), notification/report preferences (jsonb). |
| `coach_clients` | The coach↔client relationship. `client_id` is `unique`, so a client has at most one coach. `invited_email` supports inviting someone who hasn't signed up yet. |
| `programs` | A named training block for one client (e.g. "Strength Foundation"), with a `start_date` used to compute week numbers. |
| `exercises` | A coach's exercise library. Doubles as the "training video library" — any exercise with a `video_url` shows up there. |
| `workouts` | A reusable workout template owned by a coach, optionally linked to a `program`. |
| `workout_exercises` | Ordered exercises within a workout, with sets/reps/load/rest prescription. |
| `workout_assignments` | A workout scheduled for a specific client on a specific date (+ optional time). This is the "workout session" a client sees on Today/Week/Calendar. |
| `set_logs` | Per-set completion during an active session (reps done, weight used). |
| `nutrition_plans` | Nutrition plans. A coach can run several per athlete (e.g. training-day and rest-day plans), each assigned to exactly one athlete (`client_id`) at creation, with its own name, `day_type` (`training`/`rest`/`any`), `notes`, calorie + macro targets and `is_active` flag (only active plans are visible to the athlete). |
| `meals` | Meals within a plan (name, time, food summary, calories/macros). |
| `meal_logs` | Whether a client completed a given meal on a given date. |
| `habit_targets` / `habit_logs` | Generic daily habits (e.g. water intake) a coach sets for a client, with daily completion logs. |
| `progress_entries` | Daily weight/body-fat log entries. |
| `progress_photos` | Storage references for progress photos, by date/angle. |
| `personal_records` | Client-logged PRs (e.g. "Back squat — 82.5 kg"). |
| `check_ins` | Weekly check-in submissions (weight, energy, sleep, mood, feedback) + coach's review/feedback. |
| `check_in_photos` | Storage references for photos attached to a check-in. |
| `conversations` / `messages` | One conversation per coach↔client pair; messages have `read_at` for read receipts. |
| `meetings` | Scheduled 1:1 meetings. Created through the Zoom integration: `video_url` holds Zoom's join link (only `http(s)` URLs are accepted, enforced by a check constraint), plus `zoom_meeting_id`, `zoom_passcode`, and `zoom_started_at`/`zoom_ended_at` (set by webhooks). The host start link is never stored. See [docs/zoom-integration.md](docs/zoom-integration.md). |
| `zoom_connections` | One row per coach who connected Zoom: Zoom user id/email and the OAuth tokens, **AES-256-GCM encrypted** by the server. RLS on with no policies and no grants to `anon`/`authenticated`: only server code (service role) can touch it. |
| `zoom_oauth_states` | Short-lived, single-use OAuth `state` + PKCE verifier for a coach's Connect Zoom attempt. Server-only like `zoom_connections`. |
| `schedule_events` | Custom coach calendar entries ("New event" on the Schedule page): title, `event_type`, `starts_at`/`ends_at`, description, optional `client_id`. Client-specific events also appear on that athlete's calendar. |
| `notifications` | In-app notification feed, populated by triggers (see below). `metadata` (jsonb) carries names/titles so the UI can render each notification in the viewer's language; `title` is the English fallback. |

### 2.2 Important relationships

- `auth.users (1) —— (1) profiles`, linked by trigger on sign-up.
- `profiles (coach) (1) —— (1) coach_clients (many) —— (1) profiles (client)`: enforced by
  `coach_clients.client_id` being `unique`.
- `workouts (1) —— (many) workout_exercises (many) —— (1) exercises`
- `workouts (1) —— (many) workout_assignments (many) —— (1) profiles (client)`
- `workout_assignments (1) —— (many) set_logs`
- `nutrition_plans (1) —— (many) meals (1) —— (many) meal_logs`
- `conversations (1) —— (many) messages`

### 2.3 Authentication

There are exactly two roles, and only one public entry point creates an account:

- **Coach**: signs up themselves at `/sign-up` (email + password via `@supabase/supabase-js`).
  **Every public sign-up becomes a coach**: `handle_new_user()` ignores any role a user passes in
  `user_metadata` and only makes an account an athlete when `app_metadata.role = 'client'`, which
  only the service role can write. So nobody can self-register as an athlete through the API.
- **Athlete**: **cannot self-register.** There is no athlete sign-up UI or route. A coach creates
  the athlete's real Supabase Auth account (with the default temporary password) from **Coach → Clients
  → Add client**, which calls the `createAthleteAccount` server function
  (`src/lib/create-athlete.functions.ts`) — see §2.3.1. The athlete then signs in normally at
  `/sign-in` with those credentials.

If a coach previously *invited* an email that hadn't signed up yet (the legacy `add_client_by_email`
RPC path, `coach_clients.invited_email` set with no `client_id`), the `handle_new_user()` trigger
only auto-links it for athlete accounts. In practice this path is now
unused by the UI — Add Client always creates the account directly — but the RPC and trigger branch
are left in place since they're harmless and already exist in the schema.

#### 2.3.1 Coach-created athlete accounts (privileged, server-only)

Creating an athlete requires the Supabase **service-role (secret) key** — to call
`admin.auth.admin.createUser()` — which must never reach the browser. This runs as a TanStack
Start **server function** (`createServerFn`, see `src/lib/create-athlete.functions.ts`), which
compiles to two halves: the real handler (with the secret key) ships only in the server bundle,
and the browser gets a thin RPC stub that POSTs to a `/_serverFn/...` endpoint. Verified directly
in the build output: the secret key and `admin.createUser` calls exist only in `.output/server/`,
never in `.output/public/assets/`.

The handler, step by step:

1. **Verify the caller is real**: the browser sends its current Supabase `access_token` as part of
   the request payload (not trusted as-is — it's handed to `supabase.auth.getUser(token)`, which
   validates the JWT against Supabase Auth itself).
2. **Re-check the caller's role from the database, not from client input**: using a Supabase client
   scoped to that verified user's own token, it reads `profiles.role` (through the same RLS policy
   every other read goes through) and rejects with "Only coaches can add athletes." if it isn't
   `coach`. A client-supplied `role` or `coachId` is never trusted — this is why a byte-identical
   replay of a real request, with only the access token swapped for an athlete's, is rejected by
   this check (verified manually during development).
3. **Only then** does it create a service-role client and call `admin.auth.admin.createUser({
   email, password: DEFAULT_ATHLETE_PASSWORD, email_confirm: true, user_metadata: { full_name },
   app_metadata: { role: "client", must_change_password: true } })`. Every athlete starts with the
   default temporary password **`icoach123`** (`src/lib/account.ts`). **The coach never types a
   password** — there is no password field in the Add Client form. Supabase Auth writes
   `app_metadata` in an UPDATE right after inserting the user, so the `profiles` row is created by
   `handle_new_user()` and switched to `client` by `sync_role_from_app_metadata()` (0008); the
   server function also sets `role = 'client'` explicitly.
4. It then sets the athlete's `age`/`sex`/`height_cm` on that profile, inserts the `coach_clients`
   link, and (if a starting weight was given) logs it as the athlete's first `progress_entries` row
   — reusing the existing progress-tracking table rather than adding a duplicate weight field.
5. **All-or-nothing**: steps 3–4 are wrapped so that if anything after account creation fails, the
   auth user is deleted (`admin.auth.admin.deleteUser`), which cascades and removes the
   half-created profile/link/weight-entry automatically via the existing FK constraints — never
   leaving an orphaned or partially-set-up athlete. This was confirmed during development: a real
   failure (a not-yet-applied migration) triggered the rollback and left zero trace.
6. The UI then shows the coach the athlete's email and the temporary password (with a copy
   button) to relay. The password is not stored anywhere in the app's tables or metadata — only as
   Supabase Auth's own hash in `auth.users.encrypted_password`. Duplicate emails are rejected with
   "An account with this email already exists." Errors are returned as stable codes
   (`EMAIL_EXISTS`, `NOT_COACH`, `SESSION_EXPIRED`, ...) that the UI translates.

**Forced password change on first login.** The account is flagged `must_change_password: true` in
**`app_metadata`**, which users cannot edit themselves. `AppShell` and the sign-in page check this
flag first and send the athlete to `/reset-password` — no other page is reachable until the
temporary password is replaced. Because the flag can only be cleared with the service role, the
change goes through a second server function, `completeRequiredPasswordChange`
(`src/lib/password.functions.ts`): it verifies the caller's token, refuses to reuse `icoach123`,
sets the new password and clears the flag. Changing a password revokes the old refresh token, so
the client then signs in again with the new password and lands on the athlete dashboard. Voluntary
changes (Settings) and emailed recovery links use `supabase.auth.updateUser({ password })`.

### 2.4 Row Level Security

RLS is enabled on every table. The general pattern:

- **Own data**: a user can always read/write rows where they are the owner (`client_id = auth.uid()`
  or `coach_id = auth.uid()`), e.g. `profiles`, `progress_entries`, `check_ins`.
- **Coach ↔ their clients**: a coach can manage rows for clients linked to them via
  `coach_clients`; a client can read (but not write) data assigned to them by their coach, e.g. a
  client can `select` a `workout` assigned to them but only the owning coach can `update` it.
- Two `security definer` helper functions, `is_coach_of(client_id)` and `is_client_of(coach_id)`,
  centralize the "are these two users linked" check so policies stay simple and avoid recursive
  RLS lookups.
- **Role separation is enforced in the database, not only in the UI** (0007–0009):
  - `profiles.role` and `profiles.email` cannot be changed by the user (`protect_profile_identity`
    trigger) — an athlete can't promote themselves to coach.
  - Coach-owned tables (`workouts`, `exercises`, `schedule_events`) require `current_role() =
    'coach'` to write; client-scoped coach tables (`programs`, `nutrition_plans`, `habit_targets`,
    `meetings`, `workout_assignments`, `schedule_events.client_id`) additionally require
    `is_coach_of(client_id)`, so a coach can only write data for their **own** linked athletes.
    Assignments also require the workout to belong to the coach (`is_workout_owner`).
  - Athletes may update only the progress fields of their own assignments
    (`restrict_client_assignment_update` trigger).
- `add_client_by_email(email)` is a `security definer` RPC: it looks up a client profile by email
  (which isn't otherwise selectable across users) and creates the `coach_clients` link, or stores
  a pending invite if the email hasn't signed up yet. This is how "Add client" works without
  exposing other users' emails through a normal `select`.

**No service-role key is used anywhere in the frontend.** The publishable (anon) key is the only
Supabase credential shipped to the browser (`VITE_SUPABASE_PUBLISHABLE_KEY`); everything a user
can do through it is governed by the RLS policies above.

### 2.5 Storage

Four buckets (`supabase/migrations/0004_storage.sql`):

| Bucket | Public? | Path convention | Who can write |
| --- | --- | --- | --- |
| `avatars` | Yes (by URL) | `{user_id}/avatar.ext` | Owner only |
| `media` | Yes (by URL) | `{coach_id}/...` | Owning coach only (coach role required) — training videos, covers, thumbnails |
| `progress-photos` | No | `{client_id}/...` | Owning client only; the client's coach can also read |
| `check-in-photos` | No | `{client_id}/...` | Owning client only; the client's coach can also read |

Public buckets serve a file to anyone holding its URL (needed so athletes can stream their coach's
exercise videos) but **listing** a bucket is restricted to the owner's own folder (0007), so nobody
can enumerate other users' uploads. Videos stream with HTTP range requests (seekable).

### 2.6 Realtime

`messages` and `notifications` are added to the `supabase_realtime` publication. The frontend
subscribes with `postgres_changes` filters (per conversation, per user) in
`src/hooks/use-messages.ts` and `src/hooks/use-notifications.ts`, invalidating the relevant
TanStack Query cache entry when a row changes — no manual state syncing.

### 2.7 Database functions & triggers

| Function/trigger | Fires on | Effect |
| --- | --- | --- |
| `handle_new_user()` | `after insert on auth.users` | Creates the matching `profiles` row; auto-links a pending coach invite. |
| `set_updated_at()` | `before update` on `profiles`/`programs`/`workouts` | Keeps `updated_at` current. |
| `notify_new_message()` | `after insert on messages` | Bumps `conversations.last_message_at`; inserts a `notifications` row for the recipient. |
| `notify_check_in_submitted()` | `after insert on check_ins` | Notifies the coach. |
| `notify_workout_completed()` | `after update on workout_assignments` (status → completed) | Notifies the coach. |
| `notify_meeting_scheduled()` | `after insert on meetings` | Notifies the client. |
| `notify_event_scheduled()` | `after insert on schedule_events` | Notifies the athlete of a client-specific event. |
| `sync_role_from_app_metadata()` | `after update of raw_app_meta_data on auth.users` | Applies a service-role-set `app_metadata.role` to `profiles.role`. |
| `protect_profile_identity()` | `before update on profiles` | Blocks users changing their own `role`/`email`. |
| `restrict_client_assignment_update()` | `before update on workout_assignments` | Athletes may only change progress fields. |
| `add_client_by_email(text)` | RPC, called from "Add client" | See §2.4. |

---

## 3. Frontend

### 3.1 Main folders

```
src/
  routes/                 File-based routes (TanStack Router). One file = one URL.
  components/icoach/      App-specific screens: app-shell.tsx, coach-pages.tsx,
                          coach-client-profile.tsx, coach-schedule.tsx, coach-nutrition.tsx,
                          coach-shared.tsx, client-pages.tsx, shared.tsx (video player, confirm &
                          meeting dialogs), language-switch.tsx, auth-layout.tsx, primitives.tsx
  components/ui/          shadcn/ui primitives (Button, Dialog, Input, Switch, ...)
  hooks/                  All Supabase data-fetching/mutation hooks, one file per domain
  lib/                    supabase.ts (client), auth.tsx (auth context), account.ts (default
                          password + role helpers), *.functions.ts (server functions),
                          database.types.ts (hand-written row types), format.ts (local-date
                          helpers), i18n/ (en.ts, ar.ts dictionaries + provider)
```

### 3.2 Routes

Coach: `/coach/dashboard`, `/coach/clients`, `/coach/clients/:id` (file
`coach.clients_.$id.tsx` — the trailing `_` keeps it out of the roster page's layout; tabs via
`?tab=overview|progress|analysis|workouts|nutrition|schedule|check-ins|activity`), `/coach/schedule`,
`/coach/workouts`, `/coach/videos`, `/coach/nutrition`, `/coach/messages`, `/coach/meetings`,
`/coach/progress`, `/coach/check-ins`, `/coach/settings`.

Client: `/client/dashboard`, `/client/today`, `/client/week`, `/client/workouts`,
`/client/nutrition`, `/client/progress`, `/client/calendar`, `/client/messages`,
`/client/meetings`, `/client/check-ins`, `/client/settings`.

Auth: `/sign-in` (with `?as=coach` / `?as=athlete` for the two portals linked from the home page —
same centered layout, role-specific copy), `/sign-up` (coaches), `/forgot-password`,
`/reset-password`.

Every coach/client route renders through `<AppShell role="coach|client">`
(`src/components/icoach/app-shell.tsx`), which is also where route protection lives: it renders
nothing protected until the CURRENT session's profile role is loaded from the database, redirects
to `/sign-in` without a session, to `/reset-password` while a password change is pending, and to
the user's own dashboard on a route for the other role (always with history `replace`).

### 3.3 Components

`coach-pages.tsx` and `client-pages.tsx` each export one top-level `<CoachPage page="..."/>` /
`<ClientPage page="..."/>` component that switches on the `page` prop to render the matching
screen function. This mirrors the original mock's structure — only the internals of each screen
function were rewired from static arrays to hooks.

### 3.4 Data fetching & mutations

All server state goes through TanStack Query via hooks in `src/hooks/`:

| Hook file | Covers |
| --- | --- |
| `use-clients.ts` | Coach roster (with computed status/streak/completion), add/remove client, "my coach" for clients |
| `use-client-detail.ts` | Coach's view of one athlete: assignments (−90/+60 days), meetings, meal logs — all filtered by that athlete's id |
| `use-dashboard.ts` | Coach dashboard aggregates, client "Today" task composition, habit logging, client stats |
| `use-workouts.ts` | Exercise library, video library, workout builder CRUD, assignments, set logging, active-session lifecycle |
| `use-nutrition.ts` | Multiple plans per athlete (create/edit/activate/delete), meals, meal logging, `planForDay` |
| `use-progress.ts` | Weight entries, personal records, 30-day completion stats |
| `use-check-ins.ts` | Submit/review check-ins, check-in photo upload |
| `use-messages.ts` | Conversations, messages, realtime subscriptions, read receipts |
| `use-meetings.ts` | Listing meetings; schedule / edit / cancel / start go through the Zoom server functions (`src/lib/zoom.functions.ts`) |
| `use-zoom.ts` | Coach's Zoom connection: status, Connect (redirects to Zoom), Disconnect |
| `use-schedule.ts` | Coach calendar for any day/week/month range (assignments + meetings + custom events merged), event create/delete, athletes' own events |
| `use-settings.ts` | Profile updates, notification preferences, avatar upload |
| `use-notifications.ts` | Notification feed + realtime + mark-read |

Mutations call `queryClient.invalidateQueries(...)` for the affected query keys on success, so the
UI refreshes from the next query without a page reload.

### 3.5 Authentication flow

`src/lib/auth.tsx` exposes `AuthProvider`/`useAuth()`, wrapping the whole app in
`src/routes/__root.tsx`. It tracks the Supabase `session`/`user` and loads the matching `profiles`
row. `sign-in.tsx`/`sign-up.tsx`/`forgot-password.tsx`/`reset-password.tsx` call
`signIn`/`signUp`/`resetPassword`/`updatePassword` from this context; `AppShell`'s sign-out (desktop sidebar, and on phones the
"More" sheet / header avatar) calls `signOut()`.

`AuthProvider` tags the loaded profile with the user id it belongs to and never exposes a profile
that doesn't match the current session, so a previous account's role can't be applied to a newly
signed-in one (this was the cause of "signing in as an athlete sends me to the coach dashboard").
Supabase calls are never awaited inside `onAuthStateChange` (supabase-js can deadlock there); the
profile is fetched by an effect keyed on the user id. When the account on the device changes, the
whole TanStack Query cache is cleared.

### 3.6 Language (English / Arabic)

- `src/lib/i18n/en.ts` holds every user-facing string; `ar.ts` is typed against it, so a missing
  Arabic translation fails the build. Plurals use `_one`/`_other` keys (Arabic adds
  `_zero`/`_two`/`_few`/`_many`) through `Intl.PluralRules`.
- `useI18n()` returns `t(key, params)`, `tp(key, count)`, locale-aware formatters (`fmt.date`,
  `fmt.clock`, `fmt.weekday`, `fmt.timeAgo`) and `setLang`. Arabic dates keep Latin digits.
- The choice is stored in the `icoach-lang` cookie (and localStorage). The root route reads the
  cookie on the server and in the browser, so the first HTML already has the right
  `<html lang dir>` and text — no flash of English after a refresh. Route `<title>`s are
  translated through `pageMeta()`.
- RTL: `<html dir="rtl">` plus logical CSS properties (`inset-inline-*`, `margin-inline-*`, ...)
  mirror the layout; `styles.css` flips the few things logical properties can't (gradients, hover
  nudges, arrow icons) and removes letter-spacing for Arabic script.
- User-entered data (names, workout/plan titles, notes) is shown as typed. Server errors are stable
  codes mapped to translations in `src/lib/i18n/errors.ts`.

---

## 4. Analytics

All figures below are computed from live Supabase data — none are hardcoded.

| Metric | Where | How it's calculated |
| --- | --- | --- |
| **Active clients** | Coach dashboard, Progress | `count(coach_clients where client_id is not null)` |
| **Weekly completion (per client)** | Roster, dashboard | `completed / total` of that client's `workout_assignments` scheduled in the last 7 days, ×100 |
| **Avg completion (roster)** | Coach dashboard, Progress | Mean of each client's weekly completion % |
| **Streak (days)** | Roster, client dashboard/progress | See §"Streak formula" below |
| **Check-ins due** | Coach dashboard | `count(check_ins where status = 'pending')` |
| **Attention queue / at-risk** | Roster, dashboard, Progress | A client is `attention` if they have a `scheduled` (not completed) assignment whose date is in the past, OR their last check-in was submitted more than 9 days ago. `new` overrides this for clients who joined ≤ 13 days ago. Otherwise `on-track`. |
| **Team performance (7-day chart)** | Coach dashboard, Progress | For each of the last 7 days: `completed assignments that day / total assignments that day` across the whole roster |
| **Client weekly score** | Client dashboard | Same weekly-completion formula, scoped to the signed-in client |
| **30-day consistency %** | Client Progress | `(completed workout_assignments + completed meal_logs) / (total of both)` over the last 30 days |
| **Last active** | Roster | The later of the client's last completed assignment (`completed_at`) or last check-in (`submitted_at`) |

**Streak formula** (`computeStreak` in `src/hooks/use-clients.ts`, reused for both the coach
roster and the client's own stats): walking backward from today, a day counts toward the streak
if every `workout_assignment` scheduled that day has `status = 'completed'`. A day with **no**
assignment scheduled does not break the streak (rest days are neutral, not penalized). The streak
stops at the first day that has an incomplete assignment.

This is a documented, defensible choice — the original mock's "18 day streak" was a static
number with no defined rule, so this formula was chosen to reward consistency on training days
without punishing rest days.

---

## 5. Nutrition

**Design decision on BMR/TDEE**: the original UI (and the "Nutrition plans" feature as designed)
has the **coach directly set** a client's daily calorie and macro targets when creating a plan —
there is no client biometric input (height/weight/age/activity level) anywhere in the existing
screens, and no BMR/TDEE calculator UI was ever part of the design. Adding one would require new
input fields and a new UI flow, which falls outside "connect the existing frontend to a backend"
and the explicit instruction not to introduce new UI beyond authentication. So: **nutrition
targets are coach-prescribed, not auto-calculated from a formula.** If a BMR/TDEE-driven
calculator is wanted later, the natural place is the `CreatePlanDialog` in `coach-pages.tsx`,
computing suggested `target_calories`/macros from new `profiles` columns (height/weight/age/sex/
activity level) before the coach confirms them — the standard formula to use would be
Mifflin-St Jeor for BMR (`10×kg + 6.25×cm − 5×age + 5` for men, `−161` for women) × an activity
multiplier for TDEE, then a goal adjustment (deficit/surplus).

**Multiple plans.** A coach creates any number of plans, choosing the athlete in the create
dialog, and can edit, activate/deactivate or delete each one and add/remove meals (with time,
foods and macros). The athlete sees all of their **active** plans with a switcher; the default for
today (also used by Today/Week) is `planForDay`: the plan whose day type matches (training if a
workout is scheduled today, rest otherwise), then an every-day plan, then the newest.

**What is calculated today:**

| Value | Formula |
| --- | --- |
| Daily energy consumed | Sum of `calories` for every `meal` whose `meal_log` for today has `completed = true` |
| Daily protein/carbs/fat consumed | Same, summing `protein_g`/`carbs_g`/`fat_g` |
| Progress bar vs. target | `consumed / plan.target_calories × 100` |
| Macro calorie conversion | Not needed for display (grams are shown directly per the original design), but for reference: protein and carbs are 4 kcal/g, fat is 9 kcal/g |

---

## 6. Progress

- **Weight trend**: `progress_entries.weight_kg` ordered by `entry_date`, charted directly (no
  smoothing/averaging — the original design showed raw week-over-week points).
- **Measurement changes**: not tracked as a separate metric beyond the raw `progress_entries`
  history; a coach or client can read the trend chart to see change over time.
- **Personal records**: manually logged by the client (`personal_records`), shown with an
  optional `previous_value` for context — no automatic PR detection is performed on set logs.
- **Adherence / check-in calculations**: see the "30-day consistency %" and "check-ins due"
  formulas above.

---

## 7. Programs & workouts

- **Programs** are a named block (`programs`) with a `start_date`; workouts can optionally belong
  to a program (`workouts.program_id`) so a workout's "week number" can be derived from
  `floor((assignment.scheduled_date - program.start_date) / 7) + 1` if needed for display.
- **Workout creation**: a coach builds a `workout` (title/duration/notes), then adds ordered
  `workout_exercises` (sets/reps/load/rest) pulled from their `exercises` library — created ad hoc
  if the exercise doesn't exist yet.
- **Assignment**: a coach assigns a workout to a client on a specific `scheduled_date` (optional
  `scheduled_time`), creating a `workout_assignments` row with `status = 'scheduled'`.
- **Client completion tracking**: opening the assigned workout marks it `started_at`; each
  "Complete set" press upserts a `set_logs` row; once logged sets reach the total prescribed sets,
  the assignment is automatically marked `status = 'completed'` with `completed_at`, which is what
  the roster/dashboard completion percentages read from.
- **Rest timer chime**: pressing "Complete set" also starts the rest countdown and calls
  `unlockChimeAudio()` (`src/lib/chime.ts`), which creates/resumes a shared `AudioContext` from
  that click — a genuine user gesture, satisfying mobile/desktop autoplay policies. When the
  countdown reaches `00:00` (natural countdown, or manually via `-15`), `playRestChime()` fires a
  short two-tone tone synthesized with Web Audio oscillators (no audio asset shipped). Pressing
  "Skip" sets the timer to null directly without passing through zero, so it does not chime. No
  sound plays on repeat — reaching zero only ever happens once per rest period, since the state
  is immediately cleared to `null` in the same effect run.

---

## 8. Authentication (user-facing flow)

- **Sign up** (`/sign-up`): **coaches only** — name, email, password (≥ 8 chars). There is no role
  choice and no athlete sign-up path anywhere in the UI. Creates the `auth.users` row with
  `role: "coach"`/`full_name` metadata; the DB trigger creates the `profiles` row.
- **Athletes never sign up.** Their account is created by their coach from **Clients → Add client**
  (name, email, age, sex, height, starting weight — **no password field**) via the
  `createAthleteAccount` server function, which generates a random temporary password server-side
  — see §2.3.1 for the full security design and the forced first-login password change. The
  athlete then uses `/sign-in` with the credentials the coach relays to them.
- **Sign in** (`/sign-in`, `/sign-in?as=coach`, `/sign-in?as=athlete`): email + password via
  `supabase.auth.signInWithPassword`, for both roles. The role is always read from the database
  for the account that just signed in, and that account's own dashboard opens. If someone is
  already signed in with the **other** role (e.g. a coach clicks "I'm an athlete" on the home
  page), the page shows "You're signed in as … (Coach)" with **Sign out & switch account** instead
  of letting that session through; same-role visits go straight to the dashboard.
- **Sessions**: persisted by `@supabase/supabase-js` (localStorage) with auto-refresh; `AuthProvider`
  subscribes to `onAuthStateChange` so the whole app reacts to sign-in/out immediately. Every
  profile fetch is tagged with the user id it's for and discarded if a newer sign-in/sign-out
  has since superseded it, so a slow network response for a previous session can never overwrite
  the current one — see §9 for why this matters for account switching.
- **Sign out**: desktop sidebar footer, and on phones the "More" sheet (also opened by tapping the
  header avatar) — for both roles. It ends the session (`signOut({ scope: "local" })`, and wipes
  the stored token even if the network call fails), clears user/profile state and the whole
  TanStack Query cache, and navigates to `/sign-in` with history `replace` so Back can't reveal the
  previous dashboard. A page restored from the back/forward cache re-checks the session.
- **Password reset**: `/forgot-password` sends a reset email (`resetPasswordForEmail`) pointing at
  `/reset-password`, which calls `updateUser({ password })` once the recovery session is active.
  Either role can also change their password any time from **Settings → Profile** (same underlying
  call, via the shared `ChangePasswordCard`) — the one place an athlete can replace the temporary
  password their coach set for them, besides the forced first-login flow.
- **Roles**: `coach` or `client`, stored on `profiles.role`, set at account-creation time (by the
  user themselves for a coach, by their coach for an athlete) and immutable through the UI.
- **Protected routes**: enforced in `AppShell` (see §3.2) rather than per-route, since every
  coach/client screen renders through it — and independently by RLS in the database (§2.4), so
  hiding UI is never the only protection.

---

## 9. Security

- **RLS** is the only authorization layer; there is no separate backend to bypass it. See §2.4 for
  the policy pattern.
- **Coach permissions**: full CRUD on their own `workouts`/`exercises`/`programs`/`nutrition_plans`
  /`meetings`, and on `coach_clients` rows where they are the coach; read-only on their clients'
  personal logs (progress, check-ins) via `is_coach_of()`.
- **Client permissions**: full CRUD on their own logs (`progress_entries`, `meal_logs`,
  `set_logs`, `check_ins` insert-only, `personal_records`); read-only on what their coach assigns
  them (`workouts`, `nutrition_plans`, `programs`).
- **Storage security**: see §2.5 — private buckets restrict reads to the owning client and their
  linked coach; public buckets (`avatars`, `media`) only restrict **writes** to the owner's folder.
- **No service-role key in the browser.** The secret key is read via `process.env` only inside
  server code (`create-athlete.functions.ts`, `password.functions.ts`, `zoom.functions.ts`,
  `src/lib/server/**`, the `/api/zoom/*` routes) and admin scripts; the production client bundle
  was checked to contain neither the key nor its name, nor any Zoom secret.
- **Server functions re-verify everything**: a replay of a real "add athlete" request with an
  athlete's token is rejected (`NOT_COACH`), and a forged token is rejected (`SESSION_EXPIRED`).

---

## 10. Deployment

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env`, build-time (public) | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env`, build-time (public) | Anon/publishable API key |
| `SUPABASE_SECRET_KEY` | `.env` locally; a real server-only env var on whatever host runs the app in production | Used by local admin scripts (`scripts/apply-migrations.mjs`) **and** by the `createAthleteAccount` server function (`src/lib/create-athlete.functions.ts`) that powers Coach → Add Client. Read only via `process.env` inside a `createServerFn` handler — never imported by anything in the client bundle, and never has the `VITE_` prefix. Must be set as an environment variable on your deployment platform (Vercel/Netlify/etc.) or "Add Client" will fail in production even though everything else works. |
| `SUPABASE_DB_URL` | `.env`, never bundled | Postgres connection string, for running migrations locally (not needed on the host) |
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | server-only | Zoom app credentials |
| `ZOOM_REDIRECT_URI` | server-only | `https://<your-domain>/api/zoom/callback` in production; must exactly match the Zoom app |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | server-only | Verifies Zoom webhook signatures |
| `ZOOM_TOKEN_ENCRYPTION_KEY` | server-only | 32 random bytes (base64) encrypting stored Zoom tokens |

Zoom setup and the production checklist: [docs/zoom-integration.md](docs/zoom-integration.md).

Copy `.env.example` to `.env` and fill in the values from your Supabase dashboard
(**Settings → API** for the first two, **Settings → Database** for the connection string).

### Running locally

```sh
npm install
npm run dev
```

### Building and testing

```sh
npm run build
npm test   # unit tests (Zoom token refresh, API calls, webhook verification; Zoom is mocked)
```

Outputs a Node server build to `.output/` (Nitro's default preset). Run it with
`node --env-file=.env .output/server/index.mjs` (or set the variables in your environment).
`vite.config.ts` is a plain Vite config (TanStack Start, React, Tailwind, tsconfig paths, Nitro).

### Deploying to Vercel or Netlify

This app is server-rendered (TanStack Start on Nitro), not a plain client-side SPA — every route,
including deep links and page refreshes, is handled by a real server function, so no SPA
catch-all/rewrite rule is needed on either platform.

**The one thing that isn't automatic**: Nitro's build target ("preset") only changes when you tell
it to. Without an explicit preset it builds a plain Node server, which is the wrong output shape
for Vercel or Netlify. Both
`vercel.json` and `netlify.toml` are already committed and set the correct preset via the
`NITRO_PRESET` env var baked into the build command, so no manual project-settings changes are
needed for this part:

- **Vercel** (`vercel.json`): `NITRO_PRESET=vercel bun run build` → outputs `.vercel/output` in
  Vercel's Build Output API v3 format (verified locally: static assets get long-lived cache
  headers, everything else routes to the SSR function).
- **Netlify** (`netlify.toml`): `NITRO_PRESET=netlify bun run build`, `publish = "dist"` → outputs
  static assets to `dist/` (with generated `_headers`/`_redirects`) and the SSR function to
  `.netlify/functions-internal` (verified locally).

Both were test-built locally with their real presets before committing this config, and the
project's own lockfile is `bun.lock` only (no stray `package-lock.json`), so package-manager
detection on either platform is unambiguous.

**What you still have to do in the platform's dashboard** (not something a config file can safely
contain): add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables so
the build can bake them in, and add `SUPABASE_SECRET_KEY` as a (server-only) environment variable
so **Coach → Add Client** works in production — without it, everything else in the app works but
that one feature will fail. For meetings, also add the five `ZOOM_*` variables (without them
Settings → Integrations says Zoom isn't set up). In Supabase → Authentication → URL
Configuration, set the Site URL to your domain and add `https://<your-domain>/reset-password` to
the Redirect URLs, or password-reset emails will point at the wrong site.

### Supabase configuration required for production

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` **in order** (0001 → 0011) via the SQL editor, the
   CLI (`supabase db push`), the Management API, or `node scripts/apply-migrations.mjs` (requires
   `npm install --no-save pg` and `SUPABASE_DB_URL` set to a connection string reachable from
   wherever you run it — note the direct `db.<ref>.supabase.co` host is IPv6-only; use the
   **Connection Pooling** string from Settings → Database if your network is IPv4-only).
3. Copy the project URL and anon/publishable key into `.env` (or your host's environment
   variables).
4. No seed data is required or included — the schema and RLS policies work correctly against a
   completely empty database, matching a fresh production launch. This was verified end-to-end
   with temporary throwaway accounts exercising the full coach/client flow, all deleted
   afterward.

---

## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY` on boot | `.env` wasn't created/filled in. Copy `.env.example` → `.env`. |
| "Add client" fails with "That password is too weak" | The project's Auth password policy (Authentication → Policies) is stricter than the default temporary password `icoach123`, or **leaked-password protection** is on (it rejects common passwords). Relax the policy or change `DEFAULT_ATHLETE_PASSWORD` in `src/lib/account.ts`. |
| An athlete created before 0008 shows the coach dashboard | Run migration `0008` — it repairs any profile whose role doesn't match `app_metadata.role`. |
| Sign-up succeeds but the app shows "loading" forever | The `handle_new_user` trigger/migration `0002` wasn't applied — no matching `profiles` row exists for the new `auth.users` row. |
| Coach can't see a client's data (empty roster row / 403-like empty results) | The `coach_clients` link is missing or `client_id` is still null (pending invite) — the client needs to sign up with the exact email the coach invited. |
| "Add client" errors "This client already has a coach" | `coach_clients.client_id` is `unique` by design — a client can only be linked to one coach at a time. |
| Realtime messages/notifications don't update live | Confirm `messages`/`notifications` are still in the `supabase_realtime` publication (migration `0004`) and that the browser client's websocket isn't blocked by a proxy/firewall. |
| Storage upload fails with a policy error | Check the upload path matches the `{owner_user_id}/...` convention the bucket's policies expect (see §2.5). |
| Zoom shows "Invalid redirect … (4,700)" after Connect Zoom | One of three things: `ZOOM_REDIRECT_URI` isn't registered in the Zoom app; it's registered on the other Development/Production side than the Client ID you use; or it's `http://localhost` (Zoom rejects it, use an HTTPS tunnel locally). Register the exact URL (no trailing slash) as **OAuth Redirect URL** and in the **OAuth Allow List**. |
| Zoom says "Invalid URL" for the webhook endpoint | Zoom must be able to reach it over public HTTPS at that moment (localhost never works; temporary tunnels expire). |
| Settings → Integrations says Zoom isn't set up | One of the five `ZOOM_*` variables is missing on the server. |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` when running `scripts/apply-migrations.mjs` | That hostname is IPv6-only on many networks/hosts. Use the Connection Pooling (Supavisor) string instead — Settings → Database → Connection Pooling → Session mode. |
| Deleting a coach account fails with a foreign key error on `exercises`/`workout_exercises` | Make sure migration `0005_fix_exercise_fk.sql` has been applied — earlier schema versions had `workout_exercises.exercise_id` as `on delete restrict`, which can deadlock against the cascade from deleting the owning `auth.users` row. |
| TypeScript errors on Supabase query results after changing the schema | `src/lib/database.types.ts` is hand-written, not generated — update the matching interface there (and any `.select()`/`.returns<>()` typed shape in `src/hooks/`) to match your migration. |
