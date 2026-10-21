# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: independent online coaches.** Solo personal trainers who run a remote coaching business with a roster of paying athletes. They use iCoach to program training and nutrition, review weekly check-ins, message athletes, run 1:1 Zoom calls, and spot athletes who are slipping, across their whole roster.

**Secondary: their athletes (clients).** Athletes are onboarded by their coach and cannot sign up on their own. Their job is to follow the plan: work through today's workout, meals and habits, log sets and personal records, submit check-ins and progress photos, and stay in touch with their coach.

## Product Purpose

iCoach is a premium online fitness coaching platform. It replaces the patchwork of spreadsheets, chat apps, PDFs and separate video-call tools that independent coaches usually juggle. Success means a coach can run the whole coaching relationship from one place, and athletes actually follow through on their plan day to day.

## Positioning

**Everything in one place.** Programming, exercise and video library, nutrition plans, habits, check-ins, progress tracking, messaging, scheduling and Zoom meetings all live in a single product that coach and athlete share. Nothing needs another app to finish the job.

## Operating Context

- **Coach workflow:** manage the roster → build workout templates from an exercise library and assign them to dates → create nutrition plans (several per athlete, e.g. training-day and rest-day) → review weekly check-ins → message → schedule Zoom meetings → watch roster-wide completion, streaks and at-risk athletes.
- **Athlete workflow:** open Today (workout + meals + habits as one actionable list) → run an active workout session with set-by-set logging and a rest timer → tick off meals and habits → log weight and PRs → submit the weekly check-in → message the coach → join meetings from the calendar.
- **Account creation:** every public sign-up is a coach. A coach creates each athlete account from Clients → Add client. The athlete gets a default temporary password and must change it.
- **Meetings:** created on the coach's connected Zoom account. The athlete sees only the join link and passcode.

## Capabilities and Constraints

- **Stack:** TanStack Start (React 19, file-based routing, SSR-capable), TanStack Query, Tailwind v4, Radix primitives, Supabase (Postgres, Auth, Storage, Realtime, RLS). Server functions handle privileged work such as creating athlete accounts and handling Zoom OAuth and webhooks. Deployed on Vercel.
- **Roles:** exactly two, coach and client (called "athlete" in the UI). A client has at most one coach.
- **Languages:** English and Arabic, with full RTL layout for Arabic. Every UI string goes through i18n (`src/lib/i18n/en.ts`, `ar.ts`), and notifications render in the viewer's language.
- **Integrations:** Zoom (OAuth, meeting create/update/delete, start/end webhooks). Zoom Marketplace review material is drafted in `docs/zoom-marketplace-review-draft.md` but not yet submitted.
- **Terminology:** coach; athlete (the `client` role in data); program; workout / workout template; assignment (a workout scheduled on a date); check-in; nutrition plan; habit; PR.
- **Undecided:** pricing and business model, a public support contact, and the public domain. None of these are confirmed yet.

## Brand Commitments

- **Name:** iCoach. The working tagline direction is "Train smarter. Perform stronger." The current landing copy reads "Train. Track. Transform."
- **Brief:** the owner's original brief in `README.md` is binding for visual work. It calls for a premium, serious fitness-technology brand, not a generic AI/SaaS dashboard. It specifies a dark base with a controlled red accent (no neon-green fitness template, no purple/blue AI gradients), purposeful motion, and cinematic athletic photography used strategically rather than in every card.

## Evidence on Hand

- **Photography:** `src/assets/icoach-hero.jpg`, `icoach-hero-man.jpg`, `workout-battle-rope.jpg`, `workout-runner.jpg`.
- **Stage:** private beta, with a small number of real coaches and athletes.
- **Missing:** there are no real usage statistics, testimonials, customer names, case studies or press. The landing figures (87% avg. completion, 24 active athletes, 164 training sessions) are **placeholders** and must not be presented as real. Replace them with real data or remove them.

## Product Principles

1. **One place, no hand-offs.** Every coaching task should finish inside iCoach. A feature that pushes the user out to another tool counts as a gap.
2. **Today is the athlete's product.** The athlete's experience centres on what to do now. Following the plan should take less effort than ignoring it.
3. **The coach sees the whole roster at a glance.** Coach screens put attention where it's needed (missed sessions, pending check-ins, athletes at risk) before showing detail.
4. **Serious, not gimmicky.** Premium means credible and precise. Nothing childish, no fake numbers, no decoration without a job.
5. **Both languages are first-class.** Arabic RTL gets the same quality as English, not a mirrored afterthought.

## Accessibility & Inclusion

- Full RTL support for Arabic is required on every surface.
- Screens must work at phone, tablet and desktop sizes. Athletes often use it on a phone mid-workout.
