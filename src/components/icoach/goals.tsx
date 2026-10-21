// Client goals: the editor (coach, or athlete when allowed), the change history, and the
// athlete-facing goal card.
import { History, Lock, Pencil, Plus, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionTitle } from "./primitives";
import { Field } from "./shared";
import { ChipMultiSelect } from "./form-controls";
import { DumbbellLoader } from "./gym-visuals";
import {
  EMPTY_GOALS,
  useClientGoals,
  useGoalHistory,
  useMyGoals,
  useSaveClientGoals,
  useUpdateMyGoals,
  type GoalHistoryEntry,
  type GoalsInput,
} from "@/hooks/use-goals";
import {
  DIFFICULTIES,
  GOALS,
  MEASUREMENTS,
  TRAINING_LOCATIONS,
  isOneOf,
  type Goal,
} from "@/lib/taxonomy";
import { parseIsoDate } from "@/lib/format";
import { goalLabel } from "@/lib/goals";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import type {
  ClientGoalsRow,
  MeasurementKey,
  StrengthTarget,
  TargetMeasurements,
} from "@/lib/database.types";

// ============================================================
// Editor
// ============================================================

type Draft = {
  primary_goal: Goal | "";
  primary_goal_custom: string;
  secondary_goals: Goal[];
  target_weight_kg: string;
  target_body_fat_pct: string;
  measurements: Record<MeasurementKey, string>;
  target_date: string;
  strength: { key: string; exercise: string; weight: string; reps: string }[];
  weekly_training_days: number | null;
  notes: string;
  experience_level: ClientGoalsRow["experience_level"];
  training_location: ClientGoalsRow["training_location"];
  client_can_edit: boolean;
};

let rowKey = 0;
const nextRowKey = () => `s${++rowKey}`;

function draftFrom(goals: ClientGoalsRow | null): Draft {
  const g = goals ?? ({ ...EMPTY_GOALS } as GoalsInput);
  const measurements = Object.fromEntries(
    MEASUREMENTS.map((m) => [
      m,
      g.target_measurements?.[m] != null ? String(g.target_measurements[m]) : "",
    ]),
  ) as Record<MeasurementKey, string>;
  return {
    primary_goal: isOneOf(GOALS, g.primary_goal) ? g.primary_goal : "",
    primary_goal_custom: g.primary_goal_custom ?? "",
    secondary_goals: (g.secondary_goals ?? []).filter((x): x is Goal => isOneOf(GOALS, x)),
    target_weight_kg: g.target_weight_kg != null ? String(g.target_weight_kg) : "",
    target_body_fat_pct: g.target_body_fat_pct != null ? String(g.target_body_fat_pct) : "",
    measurements,
    target_date: g.target_date ?? "",
    strength: (g.strength_targets ?? []).map((s) => ({
      key: nextRowKey(),
      exercise: s.exercise,
      weight: s.weight_kg != null ? String(s.weight_kg) : "",
      reps: s.reps != null ? String(s.reps) : "",
    })),
    weekly_training_days: g.weekly_training_days,
    notes: g.notes ?? "",
    experience_level: g.experience_level,
    training_location: g.training_location,
    client_can_edit: g.client_can_edit,
  };
}

function parseOptional(value: string, min: number, max: number): number | null | "invalid" {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return "invalid";
  return Math.round(n * 10) / 10;
}

function toInput(d: Draft): Partial<GoalsInput> | "invalid" {
  const weight = parseOptional(d.target_weight_kg, 20, 400);
  const fat = parseOptional(d.target_body_fat_pct, 2, 70);
  if (weight === "invalid" || fat === "invalid") return "invalid";
  const measurements: TargetMeasurements = {};
  for (const m of MEASUREMENTS) {
    const v = parseOptional(d.measurements[m], 10, 300);
    if (v === "invalid") return "invalid";
    if (v != null) measurements[m] = v;
  }
  const strength: StrengthTarget[] = [];
  for (const s of d.strength) {
    if (!s.exercise.trim()) continue;
    const w = parseOptional(s.weight, 0, 1000);
    const r = parseOptional(s.reps, 1, 200);
    if (w === "invalid" || r === "invalid") return "invalid";
    strength.push({
      exercise: s.exercise.trim(),
      weight_kg: w,
      reps: r == null ? null : Math.round(r),
    });
  }
  return {
    primary_goal: d.primary_goal || null,
    primary_goal_custom: d.primary_goal === "custom" ? d.primary_goal_custom.trim() || null : null,
    secondary_goals: d.secondary_goals.filter((g) => g !== d.primary_goal),
    target_weight_kg: weight,
    target_body_fat_pct: fat,
    target_measurements: measurements,
    target_date: d.target_date || null,
    strength_targets: strength,
    weekly_training_days: d.weekly_training_days,
    notes: d.notes.trim() || null,
    experience_level: d.experience_level,
    training_location: d.training_location,
  };
}

function GoalEditor({
  draft,
  setDraft,
  asCoach,
}: {
  draft: Draft;
  setDraft: (updater: (d: Draft) => Draft) => void;
  asCoach: boolean;
}) {
  const { t } = useI18n();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <div className="goal-editor">
      <div className="form-block">
        <span className="form-block-title">{t("goals.primary")}</span>
        <ChipMultiSelect
          single
          label={t("goals.primary")}
          options={GOALS}
          value={draft.primary_goal ? [draft.primary_goal] : []}
          onChange={(v) => set("primary_goal", v[0] ?? "")}
          labelFor={(g) => t(`goal.${g}`)}
        />
        {draft.primary_goal === "custom" && (
          <Input
            className="mt-2"
            aria-label={t("goals.customLabel")}
            placeholder={t("goals.customPlaceholder")}
            maxLength={120}
            value={draft.primary_goal_custom}
            onChange={(e) => set("primary_goal_custom", e.target.value)}
          />
        )}
      </div>
      <div className="form-block">
        <span className="form-block-title">{t("goals.secondary")}</span>
        <ChipMultiSelect
          label={t("goals.secondary")}
          options={GOALS.filter((g) => g !== draft.primary_goal && g !== "custom")}
          value={draft.secondary_goals}
          onChange={(v) => set("secondary_goals", v)}
          labelFor={(g) => t(`goal.${g}`)}
        />
      </div>

      <div className="goal-targets">
        <Field label={t("goals.targetWeight")} htmlFor="goal-weight">
          <Input
            id="goal-weight"
            type="number"
            inputMode="decimal"
            min={20}
            max={400}
            step={0.1}
            value={draft.target_weight_kg}
            onChange={(e) => set("target_weight_kg", e.target.value)}
          />
        </Field>
        <Field label={t("goals.targetBodyFat")} htmlFor="goal-fat">
          <Input
            id="goal-fat"
            type="number"
            inputMode="decimal"
            min={2}
            max={70}
            step={0.1}
            value={draft.target_body_fat_pct}
            onChange={(e) => set("target_body_fat_pct", e.target.value)}
          />
        </Field>
        <Field label={t("goals.targetDate")} htmlFor="goal-date">
          <Input
            id="goal-date"
            type="date"
            value={draft.target_date}
            onChange={(e) => set("target_date", e.target.value)}
          />
        </Field>
      </div>

      <div className="form-block">
        <span className="form-block-title">{t("goals.measurements")}</span>
        <div className="goal-measurements">
          {MEASUREMENTS.map((m) => (
            <Field key={m} label={t(`measurement.${m}`)} htmlFor={`goal-m-${m}`}>
              <Input
                id={`goal-m-${m}`}
                type="number"
                inputMode="decimal"
                min={10}
                max={300}
                step={0.5}
                placeholder="cm"
                value={draft.measurements[m]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    measurements: { ...d.measurements, [m]: e.target.value },
                  }))
                }
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="form-block">
        <span className="form-block-title">{t("goals.strengthTargets")}</span>
        {draft.strength.map((s) => (
          <div className="strength-row" key={s.key}>
            <Input
              aria-label={t("goals.strengthExercise")}
              placeholder={t("goals.strengthExercisePlaceholder")}
              value={s.exercise}
              maxLength={80}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  strength: d.strength.map((x) =>
                    x.key === s.key ? { ...x, exercise: e.target.value } : x,
                  ),
                }))
              }
            />
            <Input
              aria-label={t("goals.strengthWeight")}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              placeholder="kg"
              value={s.weight}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  strength: d.strength.map((x) =>
                    x.key === s.key ? { ...x, weight: e.target.value } : x,
                  ),
                }))
              }
            />
            <Input
              aria-label={t("goals.strengthReps")}
              type="number"
              inputMode="numeric"
              min={1}
              placeholder={t("goals.repsShort")}
              value={s.reps}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  strength: d.strength.map((x) =>
                    x.key === s.key ? { ...x, reps: e.target.value } : x,
                  ),
                }))
              }
            />
            <button
              type="button"
              className="icon-button"
              aria-label={t("goals.removeStrength")}
              onClick={() =>
                setDraft((d) => ({ ...d, strength: d.strength.filter((x) => x.key !== s.key) }))
              }
            >
              <X />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              strength: [...d.strength, { key: nextRowKey(), exercise: "", weight: "", reps: "" }],
            }))
          }
        >
          <Plus />
          {t("goals.addStrength")}
        </Button>
      </div>

      <div className="goal-targets">
        <div className="form-block">
          <span className="form-block-title">{t("goals.weeklyDays")}</span>
          <ChipMultiSelect
            single
            label={t("goals.weeklyDays")}
            options={["1", "2", "3", "4", "5", "6", "7"] as const}
            value={draft.weekly_training_days ? [String(draft.weekly_training_days) as "1"] : []}
            onChange={(v) => set("weekly_training_days", v[0] ? Number(v[0]) : null)}
            labelFor={(n) => n}
          />
        </div>
        <div className="form-block">
          <span className="form-block-title">{t("goals.experience")}</span>
          <ChipMultiSelect
            single
            label={t("goals.experience")}
            options={DIFFICULTIES}
            value={draft.experience_level ? [draft.experience_level] : []}
            onChange={(v) => set("experience_level", v[0] ?? null)}
            labelFor={(d) => t(`difficulty.${d}`)}
          />
        </div>
        <div className="form-block">
          <span className="form-block-title">{t("goals.location")}</span>
          <ChipMultiSelect
            single
            label={t("goals.location")}
            options={TRAINING_LOCATIONS}
            value={draft.training_location ? [draft.training_location] : []}
            onChange={(v) => set("training_location", v[0] ?? null)}
            labelFor={(l) => t(`location.${l}`)}
          />
        </div>
      </div>

      <Field label={t("goals.notes")} htmlFor="goal-notes">
        <Textarea
          id="goal-notes"
          rows={3}
          maxLength={1000}
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder={t("goals.notesPlaceholder")}
        />
      </Field>

      {asCoach && (
        <label className="superset-toggle">
          <Switch
            checked={draft.client_can_edit}
            onCheckedChange={(v) => set("client_can_edit", v)}
          />
          <span>
            <b>{t("goals.allowClientEdit")}</b>
            <small>{t("goals.allowClientEditHint")}</small>
          </span>
        </label>
      )}
    </div>
  );
}

// ============================================================
// Read-only summary
// ============================================================

function GoalSummary({ goals }: { goals: ClientGoalsRow }) {
  const { t, fmt } = useI18n();
  const primary = goalLabel(t, goals);
  const facts: [string, string][] = [];
  if (goals.target_weight_kg != null)
    facts.push([t("goals.targetWeight"), t("common.kgValue", { value: goals.target_weight_kg })]);
  if (goals.target_body_fat_pct != null)
    facts.push([t("goals.targetBodyFat"), `${goals.target_body_fat_pct}%`]);
  if (goals.target_date)
    facts.push([
      t("goals.targetDate"),
      fmt.date(parseIsoDate(goals.target_date), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ]);
  if (goals.weekly_training_days)
    facts.push([t("goals.weeklyDays"), t("goals.daysPerWeek", { n: goals.weekly_training_days })]);
  if (goals.experience_level)
    facts.push([t("goals.experience"), t(`difficulty.${goals.experience_level}`)]);
  if (goals.training_location)
    facts.push([t("goals.location"), t(`location.${goals.training_location}`)]);
  const measurements = MEASUREMENTS.filter((m) => goals.target_measurements?.[m] != null);

  return (
    <div className="goal-summary">
      <div className="goal-primary">
        <Target aria-hidden="true" />
        <div>
          <b>{primary ?? t("goals.noPrimary")}</b>
          {goals.secondary_goals.length > 0 && (
            <div className="chip-group mt-2">
              {goals.secondary_goals.map((g) => (
                <span key={g} className="chip static">
                  {isOneOf(GOALS, g) ? t(`goal.${g}`) : g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="goal-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {measurements.length > 0 && (
        <p className="goal-line">
          <span>{t("goals.measurements")}</span>
          {measurements
            .map((m) => `${t(`measurement.${m}`)} ${goals.target_measurements[m]} cm`)
            .join(" · ")}
        </p>
      )}
      {goals.strength_targets.length > 0 && (
        <ul className="goal-strength">
          {goals.strength_targets.map((s, i) => (
            <li key={i}>
              <b>{s.exercise}</b>
              <span dir="ltr">
                {s.weight_kg != null ? `${s.weight_kg} kg` : ""}
                {s.weight_kg != null && s.reps != null ? " × " : ""}
                {s.reps != null ? `${s.reps}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {goals.notes && <p className="goal-notes">{goals.notes}</p>}
    </div>
  );
}

// ============================================================
// History
// ============================================================

function useHistoryValue() {
  const { t, fmt } = useI18n();
  return (field: string, value: unknown): string => {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
    if (field === "primary_goal" || field === "secondary_goals") {
      const list = Array.isArray(value) ? value : [value];
      return list.map((g) => (isOneOf(GOALS, g) ? t(`goal.${g}`) : String(g))).join(", ");
    }
    if (field === "experience_level" && isOneOf(DIFFICULTIES, value))
      return t(`difficulty.${value}`);
    if (field === "training_location" && isOneOf(TRAINING_LOCATIONS, value))
      return t(`location.${value}`);
    if (field === "client_can_edit") return value ? t("common.yes") : t("common.no");
    if (field === "target_date" && typeof value === "string")
      return fmt.date(parseIsoDate(value), { day: "numeric", month: "short", year: "numeric" });
    if (field === "target_weight_kg") return t("common.kgValue", { value: String(value) });
    if (field === "target_body_fat_pct") return `${String(value)}%`;
    if (field === "target_measurements" && typeof value === "object") {
      const entries = Object.entries(value as Record<string, number>);
      return entries.length
        ? entries
            .map(([k, v]) => `${isOneOf(MEASUREMENTS, k) ? t(`measurement.${k}`) : k} ${v} cm`)
            .join(", ")
        : "—";
    }
    if (field === "strength_targets" && Array.isArray(value)) {
      return (value as StrengthTarget[])
        .map(
          (s) =>
            `${s.exercise}${s.weight_kg != null ? ` ${s.weight_kg} kg` : ""}${s.reps != null ? ` × ${s.reps}` : ""}`,
        )
        .join(", ");
    }
    return String(value);
  };
}

const HISTORY_FIELDS: Record<string, TranslationKey> = {
  primary_goal: "goals.primary",
  primary_goal_custom: "goals.customLabel",
  secondary_goals: "goals.secondary",
  target_weight_kg: "goals.targetWeight",
  target_body_fat_pct: "goals.targetBodyFat",
  target_measurements: "goals.measurements",
  target_date: "goals.targetDate",
  strength_targets: "goals.strengthTargets",
  weekly_training_days: "goals.weeklyDays",
  notes: "goals.notes",
  experience_level: "goals.experience",
  training_location: "goals.location",
  client_can_edit: "goals.allowClientEdit",
};

function GoalHistory({ clientId }: { clientId: string }) {
  const { t, fmt } = useI18n();
  const { data, isLoading } = useGoalHistory(clientId);
  const valueText = useHistoryValue();
  const entries = data ?? [];
  const who = (entry: GoalHistoryEntry) =>
    entry.changer
      ? `${entry.changer.full_name || t("common.someone")} (${t(entry.changer.role === "coach" ? "goals.byCoach" : "goals.byAthlete")})`
      : t("goals.bySystem");

  return (
    <section className="goal-history">
      <SectionTitle title={t("goals.history")} />
      {isLoading && <DumbbellLoader compact />}
      {!isLoading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("goals.noHistory")}</p>
      )}
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="history-dot" aria-hidden="true">
              <History />
            </span>
            <div>
              <p className="history-meta">
                <b>{who(entry)}</b>
                <time dateTime={entry.changed_at}>
                  {fmt.date(entry.changed_at, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
              <ul>
                {Object.entries(entry.changes).map(([field, change]) => (
                  <li key={field}>
                    <span className="history-field">
                      {HISTORY_FIELDS[field] ? t(HISTORY_FIELDS[field]) : field}
                    </span>
                    <span className="history-change">
                      <del>{valueText(field, change.old)}</del>
                      <span aria-hidden="true"> → </span>
                      <span className="sr-only">{t("goals.changedTo")}</span>
                      <ins>{valueText(field, change.new)}</ins>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ============================================================
// Coach: Goals tab on the athlete profile
// ============================================================

export function GoalsTab({ clientId }: { clientId: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: goals, isLoading } = useClientGoals(clientId);
  const save = useSaveClientGoals();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(null));

  useEffect(() => {
    if (!editing) setDraft(draftFrom(goals ?? null));
  }, [goals, editing]);

  const onSave = async () => {
    const input = toInput(draft);
    if (input === "invalid") {
      toast.error(t("validation.number"));
      return;
    }
    if (draft.primary_goal === "custom" && !draft.primary_goal_custom.trim()) {
      toast.error(t("goals.customRequired"));
      return;
    }
    try {
      await save.mutateAsync({
        clientId,
        goals: { ...input, client_can_edit: draft.client_can_edit },
        exists: !!goals,
      });
      toast.success(t("goals.saved"));
      setEditing(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "goals.saveFailed"));
    }
  };

  if (isLoading) return <DumbbellLoader />;

  return (
    <div className="goals-layout">
      <section>
        <SectionTitle
          overline={t("goals.overline")}
          title={t("goals.title")}
          action={
            !editing && (
              <Button onClick={() => setEditing(true)}>
                <Pencil />
                {goals ? t("goals.edit") : t("goals.set")}
              </Button>
            )
          }
        />
        {editing ? (
          <div className="panel p-5">
            <GoalEditor draft={draft} setDraft={setDraft} asCoach />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending ? t("common.saving") : t("goals.save")}
              </Button>
            </div>
          </div>
        ) : goals ? (
          <div className="panel p-5">
            <GoalSummary goals={goals} />
            <p className="goal-permission">
              {goals.client_can_edit ? (
                t("goals.clientCanEdit")
              ) : (
                <>
                  <Lock aria-hidden="true" />
                  {t("goals.clientReadOnly")}
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted-foreground">{t("goals.none")}</div>
        )}
      </section>
      <GoalHistory clientId={clientId} />
    </div>
  );
}

// ============================================================
// Athlete: goal card on the dashboard
// ============================================================

export function MyGoalCard() {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: goals, isLoading } = useMyGoals();
  const update = useUpdateMyGoals();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(null));

  if (isLoading) return null;

  const onSave = async () => {
    const input = toInput(draft);
    if (input === "invalid") {
      toast.error(t("validation.number"));
      return;
    }
    try {
      await update.mutateAsync(input);
      toast.success(t("goals.saved"));
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === "goals_locked"
          ? t("goals.locked")
          : errorText(err, i18n, "goals.saveFailed"),
      );
    }
  };

  return (
    <section className="my-goal">
      <SectionTitle
        overline={t("goals.yourGoal")}
        title={goalLabel(t, goals ?? null) ?? t("goals.notSetYet")}
        action={
          goals?.client_can_edit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(draftFrom(goals));
                setOpen(true);
              }}
            >
              <Pencil />
              {t("goals.edit")}
            </Button>
          ) : goals ? (
            <span className="goal-lock" title={t("goals.coachManaged")}>
              <Lock aria-hidden="true" />
              {t("goals.coachManaged")}
            </span>
          ) : null
        }
      />
      {goals ? (
        <div className="panel p-5">
          <GoalSummary goals={goals} />
        </div>
      ) : (
        <div className="panel p-5 text-sm text-muted-foreground">{t("goals.clientNone")}</div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("goals.editYours")}</DialogTitle>
            <DialogDescription>{t("goals.editYoursBody")}</DialogDescription>
          </DialogHeader>
          <GoalEditor draft={draft} setDraft={setDraft} asCoach={false} />
          <DialogFooter>
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t("common.saving") : t("goals.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
