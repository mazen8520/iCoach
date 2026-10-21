// Per-set workout prescriptions. A workout exercise stores one PlannedSet per set in
// workout_exercises.set_plan; legacy rows (empty set_plan) are expanded from their plain
// sets/reps/load/rest_seconds columns so every screen can treat them the same way.

export const SET_TYPES = ["normal", "warmup", "drop", "failure", "superset", "rest_pause"] as const;
export type SetType = (typeof SET_TYPES)[number];

export type RepsSpec =
  | { mode: "fixed"; value: number }
  | { mode: "range"; min: number; max: number }
  | { mode: "amrap" }
  | { mode: "failure" }
  | { mode: "none" };
export type RepsMode = RepsSpec["mode"];

export type LoadSpec =
  | { mode: "kg" | "lbs" | "pct_1rm"; value: number }
  | { mode: "bodyweight"; value?: number | null }
  | { mode: "none" };
export type LoadMode = LoadSpec["mode"];

export type DistanceUnit = "m" | "km" | "mi";

export interface PlannedSet {
  id: string;
  type: SetType;
  reps: RepsSpec;
  load: LoadSpec;
  tempo?: string | null;
  rpe?: number | null;
  rir?: number | null;
  duration_seconds?: number | null;
  distance?: { value: number; unit: DistanceUnit } | null;
  /** Overrides the exercise's rest between sets, for the rest after this set. */
  rest_seconds?: number | null;
  notes?: string | null;
}

export const MIN_SETS = 1;
export const MAX_SETS = 20;
export const MAX_REST_SECONDS = 600;
export const REST_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240, 300] as const;
export const DEFAULT_REST_SECONDS = 90;

export function newSetId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clampRest(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(seconds)));
}

export function clampSetCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_SETS;
  return Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(count)));
}

/** Parses the legacy free-text reps column ("8", "8-12", "AMRAP", "failure"). */
export function parseRepsText(text: string | null | undefined): RepsSpec {
  const value = (text ?? "").trim().toLowerCase();
  if (!value) return { mode: "none" };
  if (value === "amrap") return { mode: "amrap" };
  if (value.includes("fail")) return { mode: "failure" };
  const range = value.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { mode: "range", min, max } : { mode: "range", min: max, max: min };
  }
  const fixed = value.match(/^(\d+)$/);
  if (fixed) return { mode: "fixed", value: Number(fixed[1]) };
  return { mode: "none" };
}

/** Parses the legacy free-text load column ("60 kg", "135lbs", "70%", "BW"). */
export function parseLoadText(text: string | null | undefined): LoadSpec {
  const value = (text ?? "").trim().toLowerCase();
  if (!value) return { mode: "none" };
  if (value === "bw" || value.includes("bodyweight")) return { mode: "bodyweight" };
  const number = Number(value.match(/[\d.]+/)?.[0]);
  if (!Number.isFinite(number)) return { mode: "none" };
  if (value.includes("%")) return { mode: "pct_1rm", value: number };
  if (value.includes("lb")) return { mode: "lbs", value: number };
  return { mode: "kg", value: number };
}

type SetSource = {
  set_plan?: unknown;
  sets: number;
  reps: string | null;
  load: string | null;
};

function isPlannedSet(value: unknown): value is PlannedSet {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PlannedSet>;
  return typeof v.id === "string" && !!v.reps && !!v.load;
}

/** The exercise's sets, from set_plan when present, otherwise expanded from the legacy columns. */
export function plannedSets(row: SetSource): PlannedSet[] {
  const plan = Array.isArray(row.set_plan) ? row.set_plan.filter(isPlannedSet) : [];
  if (plan.length > 0) {
    return plan.map((s) => ({ ...s, type: SET_TYPES.includes(s.type) ? s.type : "normal" }));
  }
  const reps = parseRepsText(row.reps);
  const load = parseLoadText(row.load);
  return Array.from({ length: clampSetCount(row.sets || 1) }, (_, i) => ({
    id: `legacy-${i}`,
    type: "normal" as const,
    reps,
    load,
  }));
}

export function blankSet(template?: PlannedSet): PlannedSet {
  if (template) return { ...structuredCloneSafe(template), id: newSetId() };
  return {
    id: newSetId(),
    type: "normal",
    reps: { mode: "range", min: 8, max: 12 },
    load: { mode: "none" },
  };
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Copies one set's prescription onto every set (keeping each set's id). */
export function copySetToAll(sets: PlannedSet[], index: number): PlannedSet[] {
  const source = sets[index];
  if (!source) return sets;
  return sets.map((s) => ({ ...structuredCloneSafe(source), id: s.id }));
}

export function duplicateSet(sets: PlannedSet[], index: number): PlannedSet[] {
  const source = sets[index];
  if (!source || sets.length >= MAX_SETS) return sets;
  return [...sets.slice(0, index + 1), blankSet(source), ...sets.slice(index + 1)];
}

/** Grows or shrinks the list to `count`, copying the last set when adding. */
export function resizeSets(sets: PlannedSet[], count: number): PlannedSet[] {
  const target = clampSetCount(count);
  if (target === sets.length) return sets;
  if (target < sets.length) return sets.slice(0, target);
  const next = [...sets];
  while (next.length < target) next.push(blankSet(next[next.length - 1]));
  return next;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

// ------------------------------------------------------------
// Display (language-neutral pieces; words come from i18n at the call site)
// ------------------------------------------------------------

/** "1:30", "45s", "2:00". */
export function formatRest(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = clampRest(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "01:30" countdown clock. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Plain-text reps for the legacy `reps` column ("8-12", "10", "AMRAP", "Failure"). */
export function repsSummary(reps: RepsSpec): string {
  switch (reps.mode) {
    case "fixed":
      return String(reps.value);
    case "range":
      return `${reps.min}-${reps.max}`;
    case "amrap":
      return "AMRAP";
    case "failure":
      return "Failure";
    default:
      return "";
  }
}

/** Plain-text load for the legacy `load` column ("60 kg", "135 lbs", "70% 1RM", "BW"). */
export function loadSummary(load: LoadSpec): string | null {
  switch (load.mode) {
    case "kg":
      return `${load.value} kg`;
    case "lbs":
      return `${load.value} lbs`;
    case "pct_1rm":
      return `${load.value}% 1RM`;
    case "bodyweight":
      return load.value ? `BW + ${load.value} kg` : "BW";
    default:
      return null;
  }
}

/** The legacy summary columns derived from a set plan, so older views stay accurate. */
export function legacyColumns(sets: PlannedSet[]): {
  sets: number;
  reps: string;
  load: string | null;
} {
  const working = sets.filter((s) => s.type !== "warmup");
  const basis = working[0] ?? sets[0];
  const reps = basis ? repsSummary(basis.reps) : "";
  const loads = new Set(sets.map((s) => loadSummary(s.load)).filter(Boolean));
  return {
    sets: clampSetCount(sets.length),
    reps,
    load: basis && loads.size === 1 ? loadSummary(basis.load) : loads.size > 1 ? "Varies" : null,
  };
}

// ------------------------------------------------------------
// Rest logic used by the athlete's session
// ------------------------------------------------------------

type RestSource = {
  rest_seconds: number | null;
  rest_after_seconds: number | null;
  superset_with_next: boolean;
};

/**
 * Seconds of rest after completing set `setIndex` of an exercise, or 0 when the athlete moves
 * straight on (superset). `isLastSet` means the exercise has no sets left after this one.
 */
export function restAfterSet(
  exercise: RestSource,
  set: PlannedSet | undefined,
  { isLastSet, hasNextExercise }: { isLastSet: boolean; hasNextExercise: boolean },
): number {
  if (exercise.superset_with_next && hasNextExercise) return 0;
  if (set?.rest_seconds != null) return clampRest(set.rest_seconds);
  if (isLastSet && hasNextExercise && exercise.rest_after_seconds != null) {
    return clampRest(exercise.rest_after_seconds);
  }
  return clampRest(exercise.rest_seconds ?? DEFAULT_REST_SECONDS);
}

/**
 * Superset chains: consecutive exercises joined by superset_with_next. Returns, for each index,
 * the indices of the chain it belongs to (a lone exercise is its own chain).
 */
export function supersetChains(exercises: { superset_with_next: boolean }[]): number[][] {
  const chains: number[][] = [];
  let current: number[] = [];
  exercises.forEach((e, i) => {
    current.push(i);
    if (!e.superset_with_next || i === exercises.length - 1) {
      chains.push(current);
      current = [];
    }
  });
  return chains;
}

/**
 * Where the athlete goes after logging a set on exercise `index`: the next exercise in its
 * superset chain, back to the first chain member that still has sets, or the next exercise
 * once the whole chain is done. Returns `index` itself when that exercise still has sets.
 */
export function nextExerciseIndex(
  exercises: { superset_with_next: boolean }[],
  remaining: number[],
  index: number,
): number {
  const chain = supersetChains(exercises).find((c) => c.includes(index)) ?? [index];
  if (chain.length > 1) {
    const position = chain.indexOf(index);
    for (let step = 1; step <= chain.length; step++) {
      const candidate = chain[(position + step) % chain.length]!;
      if ((remaining[candidate] ?? 0) > 0) return candidate;
    }
  } else if ((remaining[index] ?? 0) > 0) {
    return index;
  }
  const after = remaining.findIndex((r, i) => i > (chain.at(-1) ?? index) && r > 0);
  if (after !== -1) return after;
  const before = remaining.findIndex((r) => r > 0);
  return before === -1 ? index : before;
}

type LibraryDefaults = {
  default_sets: number | null;
  default_reps: string | null;
  default_rest_seconds: number | null;
  default_duration_seconds: number | null;
  equipment_list: string[];
};

/**
 * The starting prescription when an exercise is added to a program: the library exercise's own
 * defaults when it has them, otherwise 3 × 8–12 with the workout's default rest. Everything is
 * copied into the program, so editing it there never touches the library exercise.
 */
export function startingPrescription(
  ex: LibraryDefaults,
  workoutRest: number,
): { set_plan: PlannedSet[]; rest_seconds: number } {
  const count = clampSetCount(ex.default_sets ?? 3);
  const duration = ex.default_duration_seconds ?? null;
  const reps: RepsSpec = ex.default_reps
    ? parseRepsText(ex.default_reps)
    : duration
      ? { mode: "none" }
      : { mode: "range", min: 8, max: 12 };
  const bodyweightOnly =
    ex.equipment_list.length > 0 && ex.equipment_list.every((e) => e === "bodyweight");
  const load: LoadSpec = bodyweightOnly ? { mode: "bodyweight", value: null } : { mode: "none" };
  const set_plan = Array.from({ length: count }, () => ({
    id: newSetId(),
    type: "normal" as const,
    reps,
    load,
    ...(duration ? { duration_seconds: duration } : {}),
  }));
  return { set_plan, rest_seconds: clampRest(ex.default_rest_seconds ?? workoutRest) };
}
