// Fixed value lists shared by the database checks (supabase/migrations 0012–0014), the editors
// and the filters. Labels come from i18n: `muscle.<value>`, `equipment.<value>`, etc.

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "adductors",
  "abductors",
  "traps",
  "lats",
  "lower_back",
  "neck",
  "full_body",
  "cardio",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "resistance_band",
  "bodyweight",
  "pull_up_bar",
  "bench",
  "ez_bar",
  "trap_bar",
  "medicine_ball",
  "trx",
  "foam_roller",
  "cardio_machine",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const EXERCISE_TYPES = [
  "strength",
  "hypertrophy",
  "cardio",
  "hiit",
  "mobility",
  "stretching",
  "plyometric",
  "powerlifting",
  "olympic_lifting",
  "rehab",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const GOALS = [
  "fat_loss",
  "muscle_gain",
  "strength",
  "recomposition",
  "endurance",
  "general_fitness",
  "athletic_performance",
  "sport_specific",
  "mobility",
  "rehab",
  "healthy_lifestyle",
  "competition_prep",
  "maintenance",
  "custom",
] as const;
export type Goal = (typeof GOALS)[number];

export const TRAINING_LOCATIONS = ["home", "gym", "both"] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

export const MEASUREMENTS = ["waist", "chest", "arms", "hips", "thighs"] as const;

export const FOOD_UNITS = [
  "g",
  "ml",
  "pieces",
  "cups",
  "tbsp",
  "tsp",
  "scoop",
  "slice",
  "serving",
] as const;

export const MEAL_PRESETS = [
  "breakfast",
  "snack1",
  "lunch",
  "snack2",
  "preWorkout",
  "postWorkout",
  "dinner",
  "beforeBed",
] as const;
export type MealPreset = (typeof MEAL_PRESETS)[number];

export const DAY_MARKERS = ["training", "rest", "refeed"] as const;

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// ------------------------------------------------------------
// Exercise library categories: body region -> muscle group
// ------------------------------------------------------------
export const BODY_REGIONS = [
  "upper_body",
  "lower_body",
  "core",
  "full_body",
  "cardio",
  "mobility",
] as const;
export type BodyRegionKey = (typeof BODY_REGIONS)[number];

/** Muscle-group sections inside each region (regions without sub-groups list none). Labels:
 *  `muscle.<group>`, except "adductors" which shows as "Adductors / Abductors". */
export const REGION_GROUPS: Record<BodyRegionKey, readonly string[]> = {
  upper_body: ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "traps"],
  lower_body: ["quads", "hamstrings", "glutes", "calves", "adductors"],
  core: ["abs", "obliques", "lower_back"],
  full_body: [],
  cardio: [],
  mobility: [],
};

const MUSCLE_REGION: Record<string, BodyRegionKey> = {
  chest: "upper_body",
  back: "upper_body",
  lats: "upper_body",
  shoulders: "upper_body",
  biceps: "upper_body",
  triceps: "upper_body",
  forearms: "upper_body",
  traps: "upper_body",
  neck: "upper_body",
  quads: "lower_body",
  hamstrings: "lower_body",
  glutes: "lower_body",
  calves: "lower_body",
  adductors: "lower_body",
  abductors: "lower_body",
  abs: "core",
  obliques: "core",
  lower_back: "core",
  full_body: "full_body",
  cardio: "cardio",
};

type Categorizable = {
  body_region: string | null;
  primary_muscles: string[];
  exercise_type: string | null;
};

/** The exercise's region: its own body_region, otherwise inferred from its primary muscle or
 *  type (so coaches' older custom exercises still land in a sensible section), else null. */
export function exerciseRegion(ex: Categorizable): BodyRegionKey | null {
  if (isOneOf(BODY_REGIONS, ex.body_region)) return ex.body_region;
  if (ex.exercise_type === "mobility" || ex.exercise_type === "stretching") return "mobility";
  const primary = ex.primary_muscles[0];
  if (primary && MUSCLE_REGION[primary]) return MUSCLE_REGION[primary];
  if (ex.exercise_type === "cardio" || ex.exercise_type === "hiit") return "cardio";
  return null;
}

/** The muscle-group section within the region, or "other" when it doesn't fit one. */
export function exerciseGroup(ex: Categorizable, region: BodyRegionKey): string {
  const groups = REGION_GROUPS[region];
  if (groups.length === 0) return "all";
  const primary = ex.primary_muscles[0] ?? "";
  const normalized =
    primary === "lats"
      ? "back"
      : primary === "abductors"
        ? "adductors"
        : primary === "neck"
          ? "traps"
          : primary;
  return groups.includes(normalized) ? normalized : "other";
}
