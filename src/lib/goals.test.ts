import { describe, expect, it } from "vitest";
import { goalLabel, reachedWeightTarget } from "./goals";

const t = (key: string) => `t:${key}`;

describe("goalLabel", () => {
  it("translates known goals and keeps custom wording", () => {
    expect(goalLabel(t, { primary_goal: "fat_loss", primary_goal_custom: null })).toBe(
      "t:goal.fat_loss",
    );
    expect(goalLabel(t, { primary_goal: "custom", primary_goal_custom: " Run a marathon " })).toBe(
      "Run a marathon",
    );
    expect(goalLabel(t, { primary_goal: "custom", primary_goal_custom: "" })).toBe("t:goal.custom");
    expect(goalLabel(t, null)).toBeNull();
  });
});

describe("reachedWeightTarget", () => {
  it("fires when a weigh-in reaches or crosses the target from either side", () => {
    expect(reachedWeightTarget(78, 80, 78.4)).toBe(false);
    expect(reachedWeightTarget(78, 80, 78)).toBe(true);
    expect(reachedWeightTarget(78, 80, 77.2)).toBe(true);
    expect(reachedWeightTarget(70, 66, 70.5)).toBe(true);
    expect(reachedWeightTarget(70, 66, 69)).toBe(false);
  });

  it("needs a target, and without history only fires when on target", () => {
    expect(reachedWeightTarget(null, 80, 70)).toBe(false);
    expect(reachedWeightTarget(78, null, 78.1)).toBe(true);
    expect(reachedWeightTarget(78, null, 82)).toBe(false);
  });
});
