// Strings for the public home page (src/components/icoach/landing.tsx) and the app-store
// buttons. Spread into `en` (src/lib/i18n/en.ts); Arabic lives in ar-home.ts. The small product
// scenes on the page are labelled as examples, so their names and numbers are illustrative.

const nav = {
  "home.nav.services": "Services",
  "home.nav.benefits": "Benefits",
  "home.nav.how": "How it works",
  "home.nav.app": "Get the app",
  "home.nav.start": "Get started",
  "home.nav.label": "Home page sections",
};

const hero = {
  "home.hero.platforms": "Web, iPhone and Android. One account, the same plan everywhere.",
  "home.chip.set": "Set 3 of 4 · 80 kg × 8",
  "home.chip.rest": "Rest",
  "home.chip.checkin": "Check-in sent to coach",
  "home.example": "Example",
};

const store = {
  "store.ios.top": "Download on the",
  "store.ios.name": "App Store",
  "store.android.top": "Get it on",
  "store.android.name": "Google Play",
  "store.soon": "Coming soon",
  "store.soon.ios":
    "The iPhone app is on its way. Until then, iCoach works in Safari: sign in, then Share → Add to Home Screen.",
  "store.soon.android":
    "The Android app is on its way. Until then, iCoach works in Chrome on your phone.",
  "store.label": "Download the iCoach app",
};

const services = {
  "home.pillar.train": "Train",
  "home.pillar.fuel": "Fuel",
  "home.pillar.track": "Track",
  "home.pillar.connect": "Connect",
  "home.train.title": "Programs built to the set",
  "home.train.body":
    "Build workouts from an exercise library with videos and assign them to any date. Athletes log every set while a rest timer keeps the pace.",
  "home.train.1": "Reps, ranges or AMRAP; kg, lbs or % of 1RM",
  "home.train.2": "Tempo, RPE, supersets and rest on every set",
  "home.train.3": "An exercise and video library that grows with you",
  "home.fuel.title": "Nutrition planned by the day",
  "home.fuel.body":
    "Training-day and rest-day plans, food swaps and reusable templates. Athletes tick meals off without counting a single calorie.",
  "home.fuel.1": "Week plans, Saturday to Friday",
  "home.fuel.2": "Swaps and templates you reuse",
  "home.fuel.3": "Daily habits beside every meal",
  "home.track.title": "Progress you can see",
  "home.track.body":
    "Weight, personal records and goals in one view, with weekly check-ins and progress photos that go straight to the coach.",
  "home.track.1": "Goals with targets and deadlines",
  "home.track.2": "Personal records and weight trends",
  "home.track.3": "Weekly check-ins with photos",
  "home.connect.title": "Coaching that stays in touch",
  "home.connect.body":
    "Real-time messages, instant notifications and Zoom sessions scheduled from the same calendar. The athlete only ever needs the join button.",
  "home.connect.1": "Messages and notifications in real time",
  "home.connect.2": "Zoom calls created from iCoach",
  "home.connect.3": "One calendar for sessions and events",
};

// Product scenes (illustrative).
const scenes = {
  "home.scene.squat": "Back squat",
  "home.scene.setRow": "Set {n}",
  "home.scene.restTimer": "Rest timer",
  "home.scene.trainingDay": "Training day",
  "home.scene.breakfast": "Breakfast · Oats and berries",
  "home.scene.lunch": "Lunch · Chicken and rice",
  "home.scene.dinner": "Dinner · Salmon and greens",
  "home.scene.water": "Water · 3 L",
  "home.scene.weight": "Body weight",
  "home.scene.weightDelta": "−4.2 kg in 8 weeks",
  "home.scene.pr": "New PR · Deadlift 160 kg",
  "home.scene.coachMsg": "Strong session. Add 2.5 kg to the squat next week.",
  "home.scene.athleteMsg": "Done. It felt fast today.",
  "home.scene.meeting": "Weekly review · Zoom",
  "home.scene.meetingTime": "Thursday · 18:00",
  "home.scene.join": "Join",
  "home.scene.bench": "Bench press · 4 × 8",
  "home.scene.pullups": "Pull-ups · 3 × 10",
  "home.scene.upper": "Upper body",
};

const benefits = {
  "home.benefits.title": "Built for both sides of the plan",
  "home.benefits.coach.1":
    "Your whole roster at a glance: who trained, who slipped, what needs you today.",
  "home.benefits.coach.2": "Program once, then assign it to any athlete on any date.",
  "home.benefits.coach.3": "Spot athletes who are drifting before they quit.",
  "home.benefits.coach.4": "Add athletes in seconds. Each one gets their own login.",
  "home.benefits.coach.5": "Run calls on your own Zoom account without leaving iCoach.",
  "home.benefits.athlete.1": "Open Today and know exactly what to do.",
  "home.benefits.athlete.2": "Log sets in seconds while the rest timer runs.",
  "home.benefits.athlete.3": "Meals and habits as a simple checklist.",
  "home.benefits.athlete.4": "Send check-ins and progress photos in a tap.",
  "home.benefits.athlete.5": "Message your coach any time and join calls from your calendar.",
};

const how = {
  "home.how.title": "From sign-up to the first session",
  "home.how.1.title": "Create your coach account",
  "home.how.1.body": "Sign up in a minute. Your coaching workspace is ready straight away.",
  "home.how.2.title": "Add athletes, build the plan",
  "home.how.2.body": "Create each athlete's login, then assign workouts, meals and goals.",
  "home.how.3.title": "Train, check in, adjust",
  "home.how.3.body":
    "Athletes follow Today on any device. You see every set and check-in as it happens.",
};

const app = {
  "home.app.title": "Your coach, in your pocket",
  "home.app.body":
    "The iCoach app for iPhone and Android takes Today, workouts, meals and messages to the gym floor, with the same account and data as the web.",
  "home.app.1": "The same account and data on every device",
  "home.app.2": "A guided tour the first time you open it",
  "home.app.3": "English and Arabic, right to left included",
};

export const enHome = {
  ...nav,
  ...hero,
  ...store,
  ...services,
  ...scenes,
  ...benefits,
  ...how,
  ...app,
};
