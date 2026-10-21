import { describe, expect, it } from "vitest";
import {
  copySetToAll,
  duplicateSet,
  formatRest,
  legacyColumns,
  moveItem,
  nextExerciseIndex,
  parseLoadText,
  parseRepsText,
  plannedSets,
  resizeSets,
  restAfterSet,
  supersetChains,
  type PlannedSet,
} from "./workout-sets";
import { dateForWeekday, isoForWeekday, startOfSaturdayWeek } from "./week";
import { isoDate } from "./format";

const set = (over: Partial<PlannedSet> = {}): PlannedSet => ({
  id: over.id ?? "a",
  type: "normal",
  reps: { mode: "fixed", value: 10 },
  load: { mode: "kg", value: 60 },
  ...over,
});

describe("legacy parsing", () => {
  it("reads reps text", () => {
    expect(parseRepsText("8-12")).toEqual({ mode: "range", min: 8, max: 12 });
    expect(parseRepsText("12–8")).toEqual({ mode: "range", min: 8, max: 12 });
    expect(parseRepsText(" 10 ")).toEqual({ mode: "fixed", value: 10 });
    expect(parseRepsText("AMRAP")).toEqual({ mode: "amrap" });
    expect(parseRepsText("to failure")).toEqual({ mode: "failure" });
    expect(parseRepsText("")).toEqual({ mode: "none" });
  });

  it("reads load text", () => {
    expect(parseLoadText("60 kg")).toEqual({ mode: "kg", value: 60 });
    expect(parseLoadText("135lbs")).toEqual({ mode: "lbs", value: 135 });
    expect(parseLoadText("70%")).toEqual({ mode: "pct_1rm", value: 70 });
    expect(parseLoadText("BW")).toEqual({ mode: "bodyweight" });
    expect(parseLoadText(null)).toEqual({ mode: "none" });
  });

  it("expands a legacy row into planned sets", () => {
    const sets = plannedSets({ set_plan: [], sets: 3, reps: "8-10", load: "60 kg" });
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ type: "normal", reps: { mode: "range", min: 8, max: 10 } });
  });

  it("prefers a stored set plan and drops malformed entries", () => {
    const sets = plannedSets({
      set_plan: [set({ id: "x" }), { junk: true }],
      sets: 5,
      reps: "",
      load: null,
    });
    expect(sets.map((s) => s.id)).toEqual(["x"]);
  });
});

describe("set editing", () => {
  const three = [set({ id: "1" }), set({ id: "2", reps: { mode: "amrap" } }), set({ id: "3" })];

  it("copies one set to all, keeping ids", () => {
    const out = copySetToAll(three, 1);
    expect(out.map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(out.every((s) => s.reps.mode === "amrap")).toBe(true);
  });

  it("duplicates after the source with a new id", () => {
    const out = duplicateSet(three, 0);
    expect(out).toHaveLength(4);
    expect(out[1]!.id).not.toBe("1");
    expect(out[1]!.reps).toEqual(three[0]!.reps);
  });

  it("resizes within 1–20", () => {
    expect(resizeSets(three, 5)).toHaveLength(5);
    expect(resizeSets(three, 0)).toHaveLength(1);
    expect(resizeSets(three, 99)).toHaveLength(20);
  });

  it("moves items", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("summarises for the legacy columns, ignoring warm-ups for reps", () => {
    const out = legacyColumns([
      set({ type: "warmup", reps: { mode: "fixed", value: 15 }, load: { mode: "kg", value: 40 } }),
      set({ reps: { mode: "range", min: 6, max: 8 } }),
    ]);
    expect(out).toEqual({ sets: 2, reps: "6-8", load: "Varies" });
  });

  it("formats rest", () => {
    expect(formatRest(45)).toBe("45s");
    expect(formatRest(90)).toBe("1:30");
    expect(formatRest(null)).toBe("—");
    expect(formatRest(9999)).toBe("10:00");
  });
});

describe("rest and supersets", () => {
  const ex = { rest_seconds: 60, rest_after_seconds: 120, superset_with_next: false };

  it("uses the per-set override, then between-exercise rest on the last set", () => {
    expect(
      restAfterSet(ex, set({ rest_seconds: 30 }), { isLastSet: false, hasNextExercise: true }),
    ).toBe(30);
    expect(restAfterSet(ex, set(), { isLastSet: false, hasNextExercise: true })).toBe(60);
    expect(restAfterSet(ex, set(), { isLastSet: true, hasNextExercise: true })).toBe(120);
  });

  it("skips rest inside a superset", () => {
    const linked = { ...ex, superset_with_next: true };
    expect(
      restAfterSet(linked, set({ rest_seconds: 90 }), { isLastSet: false, hasNextExercise: true }),
    ).toBe(0);
  });

  it("groups superset chains", () => {
    const list = [
      { superset_with_next: true },
      { superset_with_next: false },
      { superset_with_next: false },
    ];
    expect(supersetChains(list)).toEqual([[0, 1], [2]]);
  });

  it("alternates through a superset, then moves on", () => {
    const list = [
      { superset_with_next: true },
      { superset_with_next: false },
      { superset_with_next: false },
    ];
    expect(nextExerciseIndex(list, [2, 3, 3], 0)).toBe(1);
    expect(nextExerciseIndex(list, [2, 2, 3], 1)).toBe(0);
    expect(nextExerciseIndex(list, [0, 1, 3], 0)).toBe(1);
    expect(nextExerciseIndex(list, [0, 0, 3], 1)).toBe(2);
    expect(nextExerciseIndex(list, [0, 0, 2], 2)).toBe(2);
  });
});

describe("Saturday-first weeks", () => {
  it("starts on Saturday", () => {
    // Wednesday 2026-09-30 -> Saturday 2026-09-26
    expect(isoDate(startOfSaturdayWeek(new Date(2026, 8, 30)))).toBe("2026-09-26");
    // Saturday itself
    expect(isoDate(startOfSaturdayWeek(new Date(2026, 8, 26)))).toBe("2026-09-26");
    // Friday is the last day of the same week
    expect(isoDate(startOfSaturdayWeek(new Date(2026, 9, 2)))).toBe("2026-09-26");
  });

  it("maps weekdays to dates in the current week", () => {
    const anchor = new Date(2026, 8, 30); // Wednesday
    expect(isoForWeekday(6, anchor)).toBe("2026-09-26"); // Saturday
    expect(isoForWeekday(5, anchor)).toBe("2026-10-02"); // Friday
    expect(dateForWeekday(3, anchor).getDay()).toBe(3);
  });
});
