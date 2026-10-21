// Strings for the iOS/Android app: the app tour, the app's front door (/app) and the offline
// notice. Spread into `en` (src/lib/i18n/en.ts); Arabic lives in ar-mobile.ts.

const tour = {
  "tour.label": "App tour",
  "tour.next": "Next",
  "tour.back": "Back",
  "tour.skipAll": "Skip all",
  "tour.start": "Start the tour",
  "tour.progress": "Step {current} of {total}",
  "tour.duration": "About a minute",
  "tour.hint": "Go step by step with Next, or Skip all at any time.",
  "tour.route": "Stops on this tour",
  "tour.replay": "App tour",
  "tour.welcome.title": "Welcome, {name}",
  "tour.welcome.titleAnon": "Welcome to iCoach",
  "tour.welcome.coach":
    "Your whole coaching business, in your pocket. Here's where everything lives.",
  "tour.welcome.client":
    "Everything your coach plans for you, from training to meals and check-ins, in one place.",
  "tour.coach.overview":
    "Your roster at a glance: today's sessions, pending check-ins and the athletes who need you first.",
  "tour.coach.clients":
    "Add athletes and manage their profiles. Each new athlete gets their own login with a temporary password.",
  "tour.coach.schedule": "Assign workouts to dates and plan every athlete's week.",
  "tour.coach.workouts":
    "Build workout templates from the exercise library, with sets, reps and rest built in.",
  "tour.coach.more":
    "Nutrition plans, videos, messages, Zoom meetings, progress, check-ins and settings live here.",
  "tour.client.home": "Your streak, your progress and what's coming up next.",
  "tour.client.today":
    "Today's workout, meals and habits as one checklist. Tick things off as you go.",
  "tour.client.week": "The whole week your coach planned, day by day.",
  "tour.client.train": "Start a workout, log every set and let the rest timer pace you.",
  "tour.client.more":
    "Nutrition, progress photos, your calendar, coach chat, meetings and weekly check-ins live here.",
  "tour.notifications.coach":
    "New messages, check-ins and finished workouts land here as they happen.",
  "tour.notifications.client": "Messages from your coach, new plans and meeting invites land here.",
  "tour.language.title": "English or Arabic",
  "tour.language.body": "Switch any time. In Arabic the whole app reads right to left.",
  "tour.finish.title": "You're all set",
  "tour.finish.coach":
    "Add your first athlete from Clients to get going. Replay this tour any time from More.",
  "tour.finish.client":
    "Open Today to see what your coach planned. Replay this tour any time from More.",
  "tour.finish.ctaCoach": "Start coaching",
  "tour.finish.ctaClient": "Let's train",
};

const app = {
  "meta.app": "iCoach",
  "app.newCoach": "New coach?",
  "offline.banner": "You're offline. Changes won't save until you reconnect.",
};

export const enMobile = {
  ...tour,
  ...app,
};
