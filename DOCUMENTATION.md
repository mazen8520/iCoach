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
| `nutrition_plans` | A client's active (or historical) nutrition target: calories + macro targets. |
| `meals` | Meals within a plan (name, time, food summary, calories/macros). |
| `meal_logs` | Whether a client completed a given meal on a given date. |
| `habit_targets` / `habit_logs` | Generic daily habits (e.g. water intake) a coach sets for a client, with daily completion logs. |
| `progress_entries` | Daily weight/body-fat log entries. |
| `progress_photos` | Storage references for progress photos, by date/angle. |
| `personal_records` | Client-logged PRs (e.g. "Back squat — 82.5 kg"). |
| `check_ins` | Weekly check-in submissions (weight, energy, sleep, mood, feedback) + coach's review/feedback. |
| `check_in_photos` | Storage references for photos attached to a check-in. |
| `conversations` / `messages` | One conversation per coach↔client pair; messages have `read_at` for read receipts. |
| `meetings` | Scheduled 1:1 meetings. |
| `notifications` | In-app notification feed, populated by triggers (see below). |

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
  Role and name are captured as `auth.users.raw_user_meta_data` (`{ full_name, role: "coach" }`)
  and copied into `public.profiles` by the `handle_new_user()` trigger.
- **Athlete**: **cannot self-register.** There is no athlete sign-up UI or route. A coach creates
  the athlete's real Supabase Auth account (with the coach-chosen password) from **Coach → Clients
  → Add client**, which calls the `createAthleteAccount` server function
  (`src/lib/create-athlete.functions.ts`) — see §2.3.1. The athlete then signs in normally at
  `/sign-in` with those credentials.

If a coach previously *invited* an email that hadn't signed up yet (the legacy `add_client_by_email`
RPC path, `coach_clients.invited_email` set with no `client_id`), the `handle_new_user()` trigger
still auto-links it if that email is ever used for a coach sign-up. In practice this path is now
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
   email, password, email_confirm: true, user_metadata: { full_name, role: "client" } })`. The
   existing `handle_new_user()` trigger fires exactly as it does for a normal sign-up, creating the
   matching `profiles` row.
4. It then sets the athlete's `age`/`sex`/`height_cm` on that profile, inserts the `coach_clients`
   link, and (if a starting weight was given) logs it as the athlete's first `progress_entries` row
   — reusing the existing progress-tracking table rather than adding a duplicate weight field.
5. **All-or-nothing**: steps 3–4 are wrapped so that if anything after account creation fails, the
   auth user is deleted (`admin.auth.admin.deleteUser`), which cascades and removes the
   half-created profile/link/weight-entry automatically via the existing FK constraints — never
   leaving an orphaned or partially-set-up athlete. This was confirmed during development: a real
   failure (a not-yet-applied migration) triggered the rollback and left zero trace.

The athlete's password is passed straight into `admin.auth.admin.createUser()` — Supabase Auth
hashes and stores it in `auth.users`; it is never written to `public.profiles` or any other
application table. There is no "force password change" flow (none of the existing UI supports
one); an athlete can change their password from **Settings** any time via the same
`supabase.auth.updateUser({ password })` call the password-reset page already used.

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
| `avatars` | Yes (read) | `{user_id}/avatar.ext` | Owner only |
| `media` | Yes (read) | `{coach_id}/...` | Owning coach only — workout covers, exercise/video thumbnails |
| `progress-photos` | No | `{client_id}/...` | Owning client only; the client's coach can also read |
| `check-in-photos` | No | `{client_id}/...` | Owning client only; the client's coach can also read |

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
| `add_client_by_email(text)` | RPC, called from "Add client" | See §2.4. |

---

## 3. Frontend

### 3.1 Main folders

```
src/
  routes/                 File-based routes (TanStack Router). One file = one URL.
  components/icoach/      App-specific screens: app-shell.tsx, coach-pages.tsx,
                          client-pages.tsx, auth-layout.tsx, primitives.tsx, brand.tsx
  components/ui/          shadcn/ui primitives (Button, Dialog, Input, Switch, ...)
  hooks/                  All Supabase data-fetching/mutation hooks, one file per domain
  lib/                    supabase.ts (client), auth.tsx (auth context), database.types.ts
                          (hand-written row types), format.ts (date/number helpers)
```

### 3.2 Routes

Coach: `/coach/dashboard`, `/coach/clients`, `/coach/clients/:id`, `/coach/schedule`,
`/coach/workouts`, `/coach/videos`, `/coach/nutrition`, `/coach/messages`, `/coach/meetings`,
`/coach/progress`, `/coach/check-ins`, `/coach/settings`.

Client: `/client/dashboard`, `/client/today`, `/client/week`, `/client/workouts`,
`/client/nutrition`, `/client/progress`, `/client/calendar`, `/client/messages`,
`/client/meetings`, `/client/check-ins`, `/client/settings`.

Auth (new, matching the existing dark/red visual language): `/sign-in`, `/sign-up`,
`/forgot-password`, `/reset-password`.

Every coach/client route renders through `<AppShell role="coach|client">`
(`src/components/icoach/app-shell.tsx`), which is also where route protection lives: it redirects
to `/sign-in` if there's no session, and redirects a signed-in user to their own role's dashboard
if they land on a route for the other role.

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
| `use-client-detail.ts` | Coach's view of one client (latest check-in, week schedule, weight trend) |
| `use-dashboard.ts` | Coach dashboard aggregates, client "Today" task composition, habit logging, client stats |
| `use-workouts.ts` | Exercise library, video library, workout builder CRUD, assignments, set logging, active-session lifecycle |
| `use-nutrition.ts` | Nutrition plans, meals, meal logging |
| `use-progress.ts` | Weight entries, personal records, 30-day completion stats |
| `use-check-ins.ts` | Submit/review check-ins, check-in photo upload |
| `use-messages.ts` | Conversations, messages, realtime subscriptions, read receipts |
| `use-meetings.ts` | Scheduling and listing meetings |
| `use-schedule.ts` | Coach's weekly calendar (assignments + meetings merged) |
| `use-settings.ts` | Profile updates, notification preferences, avatar upload |
| `use-notifications.ts` | Notification feed + realtime + mark-read |

Mutations call `queryClient.invalidateQueries(...)` for the affected query keys on success, so the
UI refreshes from the next query without a page reload.

### 3.5 Authentication flow

`src/lib/auth.tsx` exposes `AuthProvider`/`useAuth()`, wrapping the whole app in
`src/routes/__root.tsx`. It tracks the Supabase `session`/`user` and loads the matching `profiles`
row. `sign-in.tsx`/`sign-up.tsx`/`forgot-password.tsx`/`reset-password.tsx` call
`signIn`/`signUp`/`resetPassword`/`updatePassword` from this context; `AppShell`'s sign-out button
calls `signOut()`.

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

---

## 8. Authentication (user-facing flow)

- **Sign up** (`/sign-up`): **coaches only** — name, email, password (≥ 8 chars). There is no role
  choice and no athlete sign-up path anywhere in the UI. Creates the `auth.users` row with
  `role: "coach"`/`full_name` metadata; the DB trigger creates the `profiles` row.
- **Athletes never sign up.** Their account is created by their coach from **Clients → Add client**
  (name, email, password, age, sex, height, starting weight) via the `createAthleteAccount` server
  function — see §2.3.1 for the full security design. The athlete then uses `/sign-in` with those
  exact credentials.
- **Sign in** (`/sign-in`): email + password via `supabase.auth.signInWithPassword`, for both roles.
- **Sessions**: persisted by `@supabase/supabase-js` (localStorage) with auto-refresh; `AuthProvider`
  subscribes to `onAuthStateChange` so the whole app reacts to sign-in/out immediately.
- **Password reset**: `/forgot-password` sends a reset email (`resetPasswordForEmail`) pointing at
  `/reset-password`, which calls `updateUser({ password })` once the recovery session is active.
  Either role can also change their password any time from **Settings → Profile** (same
  `updateUser({ password })` call) — the one place an athlete can replace the password their coach
  originally set for them.
- **Roles**: `coach` or `client`, stored on `profiles.role`, set at account-creation time (by the
  user themselves for a coach, by their coach for an athlete) and immutable through the UI.
- **Protected routes**: enforced in `AppShell` (see §3.2) rather than per-route, since every
  coach/client screen renders through it.

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
- **No service-role key** is ever imported in `src/` — only the publishable (anon) key
  (`VITE_SUPABASE_PUBLISHABLE_KEY`). The secret key is only used by one-off admin scripts run
  outside the browser bundle (see `.env.example`).

---

## 10. Deployment

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env`, build-time (public) | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env`, build-time (public) | Anon/publishable API key |
| `SUPABASE_SECRET_KEY` | `.env` locally; a real server-only env var on whatever host runs the app in production | Used by local admin scripts (`scripts/apply-migrations.mjs`) **and** by the `createAthleteAccount` server function (`src/lib/create-athlete.functions.ts`) that powers Coach → Add Client. Read only via `process.env` inside a `createServerFn` handler — never imported by anything in the client bundle, and never has the `VITE_` prefix. Must be set as an environment variable on your deployment platform (Vercel/Netlify/etc.) or "Add Client" will fail in production even though everything else works. |
| `SUPABASE_DB_URL` | `.env`, never bundled | Postgres connection string, for running migrations locally |

Copy `.env.example` to `.env` and fill in the values from your Supabase dashboard
(**Settings → API** for the first two, **Settings → Database** for the connection string).

### Running locally

```sh
npm install
npm run dev
```

### Building

```sh
npm run build
```

Outputs a Cloudflare-targeted Nitro build to `.output/` by default (the target Lovable's Vite
config hardcodes via `defaultPreset: "cloudflare-module"`).

### Deploying to Vercel or Netlify

This app is server-rendered (TanStack Start on Nitro), not a plain client-side SPA — every route,
including deep links and page refreshes, is handled by a real server function, so no SPA
catch-all/rewrite rule is needed on either platform.

**The one thing that isn't automatic**: Nitro's build target ("preset") only changes when you tell
it to. Without an explicit preset, it always falls back to Lovable's Cloudflare default — even when
building on Vercel or Netlify — which produces the wrong output shape for those platforms. Both
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
that one feature will fail.

### Supabase configuration required for production

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` **in order** (0001 → 0006) via the SQL editor, the
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
| Sign-up succeeds but the app shows "loading" forever | The `handle_new_user` trigger/migration `0002` wasn't applied — no matching `profiles` row exists for the new `auth.users` row. |
| Coach can't see a client's data (empty roster row / 403-like empty results) | The `coach_clients` link is missing or `client_id` is still null (pending invite) — the client needs to sign up with the exact email the coach invited. |
| "Add client" errors "This client already has a coach" | `coach_clients.client_id` is `unique` by design — a client can only be linked to one coach at a time. |
| Realtime messages/notifications don't update live | Confirm `messages`/`notifications` are still in the `supabase_realtime` publication (migration `0004`) and that the browser client's websocket isn't blocked by a proxy/firewall. |
| Storage upload fails with a policy error | Check the upload path matches the `{owner_user_id}/...` convention the bucket's policies expect (see §2.5). |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` when running `scripts/apply-migrations.mjs` | That hostname is IPv6-only on many networks/hosts. Use the Connection Pooling (Supavisor) string instead — Settings → Database → Connection Pooling → Session mode. |
| Deleting a coach account fails with a foreign key error on `exercises`/`workout_exercises` | Make sure migration `0005_fix_exercise_fk.sql` has been applied — earlier schema versions had `workout_exercises.exercise_id` as `on delete restrict`, which can deadlock against the cascade from deleting the owning `auth.users` row. |
| TypeScript errors on Supabase query results after changing the schema | `src/lib/database.types.ts` is hand-written, not generated — update the matching interface there (and any `.select()`/`.returns<>()` typed shape in `src/hooks/`) to match your migration. |
