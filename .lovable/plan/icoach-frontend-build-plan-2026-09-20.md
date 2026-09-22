# iCoach Frontend Build Plan

## Product direction
Build iCoach as a dark, cinematic fitness product rather than a conventional admin dashboard. The visual system will use deep graphite surfaces, off-white typography, controlled performance red, sharp geometry, oversized athletic type, purposeful photography, and fast motion tied to user actions.

## Foundation
- Replace the placeholder home page with a cinematic iCoach entry experience and role selection for Coach or Client.
- Create a shared design system for colors, type, spacing, motion, surfaces, charts, progress indicators, controls, and responsive behavior.
- Build reusable TypeScript models and mock data for clients, workouts, nutrition, schedules, messages, meetings, check-ins, reports, and notifications.
- Create distinct coach and client shells: desktop side navigation, compact tablet navigation, and thumb-friendly mobile bottom navigation.

## Coach experience
- Dashboard: commanding Today view, active clients, attention queue, completion metrics, meetings, check-ins, and weekly performance.
- Clients: searchable/filterable roster plus rich client profiles with progress, schedule, workouts, nutrition, check-ins, calendar, and messages.
- Schedule: day/week/month controls, event creation/editing UI, and a dense visual calendar.
- Workouts: professional workout builder with exercise sequencing, sets, reps, rest, video, notes, and assignment UI.
- Videos: cinematic thumbnail library, categories, search, upload panel, details, and workout assignment.
- Nutrition: plan builder with meal timing and macro controls.
- Messages: conversation list, coach-client thread, attachments, timestamps, and read states.
- Meetings, progress, check-ins, and settings: complete working views, including daily report configuration UI only.

## Client experience
- Dashboard and Today: action-first daily plan with workout, meals, tasks, streak, coach message, meeting, and animated completion.
- Week and calendar: seven-day plan with day detail and workout/nutrition/task/meeting states.
- Workout session: exercise flow, video, set tracking, rest timer, progress, and premium completion feedback.
- Nutrition: highly scannable meals, timing, macros, notes, and daily progress.
- Progress, messages, meetings, check-ins, and settings: complete client-specific views with usable controls and mock interactions.

## Interaction and responsiveness
- Add fast entrance transitions, animated bars/rings/counters, responsive buttons, smooth tabs/panels, checkbox completion feedback, and restrained celebratory moments.
- Persist demo interactions only in local browser state where useful; no backend, auth, APIs, or external integrations.
- Ensure every requested URL is a real route with unique page metadata and no dead navigation.
- Verify key coach and client flows at desktop and mobile sizes, checking overflow, navigation, dialogs, task completion, and workout progression.

## Technical details
- TanStack Start routes for all requested paths, including `/coach/clients/$id` for client profiles.
- Shared page renderers where related routes use the same product shell, while preserving distinct content and layouts per route.
- Tailwind v4 semantic tokens in the global stylesheet; no ad hoc component colors.
- Existing UI primitives and Lucide icons; Recharts for animated data visualization.
- Generated fitness photography stored in the project and used selectively for the entry, workout, program, and video experiences.
