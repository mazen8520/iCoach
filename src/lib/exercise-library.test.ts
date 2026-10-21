import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BODY_REGIONS, exerciseGroup, exerciseRegion, isOneOf } from "./taxonomy";
import { startingPrescription } from "./workout-sets";

const ex = (over: Partial<Parameters<typeof exerciseRegion>[0]> = {}) => ({
  body_region: null,
  primary_muscles: [] as string[],
  exercise_type: null,
  ...over,
});

describe("library categories", () => {
  it("uses the stored region, else infers it from the primary muscle or type", () => {
    expect(exerciseRegion(ex({ body_region: "core", primary_muscles: ["chest"] }))).toBe("core");
    expect(exerciseRegion(ex({ primary_muscles: ["lats"] }))).toBe("upper_body");
    expect(exerciseRegion(ex({ primary_muscles: ["abductors"] }))).toBe("lower_body");
    expect(exerciseRegion(ex({ exercise_type: "stretching", primary_muscles: ["quads"] }))).toBe(
      "mobility",
    );
    expect(exerciseRegion(ex())).toBeNull();
  });

  it("groups muscles into the region's sections", () => {
    expect(exerciseGroup(ex({ primary_muscles: ["lats"] }), "upper_body")).toBe("back");
    expect(exerciseGroup(ex({ primary_muscles: ["abductors"] }), "lower_body")).toBe("adductors");
    expect(exerciseGroup(ex({ primary_muscles: ["chest"] }), "lower_body")).toBe("other");
    expect(exerciseGroup(ex({ primary_muscles: ["quads"] }), "cardio")).toBe("all");
  });

  it("places every seeded exercise in a named section", () => {
    const sql = readFileSync("supabase/migrations/0017_seed_exercise_library.sql", "utf8");
    const rows = [...sql.matchAll(/^ {2}\('((?:[^']|'')+)', '(\w+)', array\['(\w+)'\]/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(200);
    for (const [, name, region, primary] of rows) {
      expect(isOneOf(BODY_REGIONS, region), name).toBe(true);
      const r = region as (typeof BODY_REGIONS)[number];
      const group = exerciseGroup(ex({ body_region: r, primary_muscles: [primary!] }), r);
      expect(group, `${name} (${primary})`).not.toBe("other");
    }
  });
});

describe("startingPrescription", () => {
  const base = {
    default_sets: null,
    default_reps: null,
    default_rest_seconds: null,
    default_duration_seconds: null,
    equipment_list: [] as string[],
  };

  it("uses the library defaults", () => {
    const out = startingPrescription(
      {
        ...base,
        default_sets: 4,
        default_reps: "6-10",
        default_rest_seconds: 120,
        equipment_list: ["barbell"],
      },
      90,
    );
    expect(out.rest_seconds).toBe(120);
    expect(out.set_plan).toHaveLength(4);
    expect(out.set_plan[0]).toMatchObject({
      reps: { mode: "range", min: 6, max: 10 },
      load: { mode: "none" },
    });
    expect(new Set(out.set_plan.map((s) => s.id)).size).toBe(4);
  });

  it("handles timed bodyweight holds", () => {
    const out = startingPrescription(
      {
        ...base,
        default_sets: 3,
        default_duration_seconds: 45,
        default_rest_seconds: 45,
        equipment_list: ["bodyweight"],
      },
      90,
    );
    expect(out.set_plan[0]).toMatchObject({
      reps: { mode: "none" },
      load: { mode: "bodyweight" },
      duration_seconds: 45,
    });
  });

  it("falls back to 3 × 8–12 and the workout's default rest for custom exercises", () => {
    const out = startingPrescription(base, 75);
    expect(out.rest_seconds).toBe(75);
    expect(out.set_plan).toHaveLength(3);
    expect(out.set_plan[0]!.reps).toEqual({ mode: "range", min: 8, max: 12 });
  });
});

describe("Arabic exercise names", () => {
  it("covers every seeded library exercise, with no stray entries", async () => {
    const { EXERCISE_NAMES_AR, exerciseDisplayName } = await import("./exercise-names-ar");
    const sql = readFileSync("supabase/migrations/0017_seed_exercise_library.sql", "utf8");
    const names = [...sql.matchAll(/^ {2}\('((?:[^']|'')+)'/gm)].map((m) =>
      m[1]!.replace(/''/g, "'"),
    );
    const missing = names.filter((n) => !EXERCISE_NAMES_AR[n]?.trim());
    expect(missing).toEqual([]);
    expect(Object.keys(EXERCISE_NAMES_AR).filter((k) => !names.includes(k))).toEqual([]);
    expect(exerciseDisplayName("Back Squat", "ar")).toBe("سكوات خلفي");
    expect(exerciseDisplayName("Back Squat", "en")).toBe("Back Squat");
    expect(exerciseDisplayName("My custom move", "ar")).toBe("My custom move");
  });
});
