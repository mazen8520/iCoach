import { useNavigate, useSearch } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, PageHead, SectionTitle } from "./primitives";
import { ConfirmDialog, Field, FieldSelect } from "./shared";
import { useDisplayName } from "./coach-shared";
import { useCoachRoster } from "@/hooks/use-clients";
import {
  DAY_TYPES,
  useAddMeal,
  useCoachNutritionPlans,
  useCreateNutritionPlan,
  useDeleteMeal,
  useDeleteNutritionPlan,
  useUpdateNutritionPlan,
  type CoachPlan,
  type DayType,
} from "@/hooks/use-nutrition";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import { initialsFromName } from "@/lib/format";
import type { NutritionPlanRow } from "@/lib/database.types";

function dayTypeLabel(t: (key: TranslationKey) => string, dayType: string) {
  return DAY_TYPES.includes(dayType as DayType) ? t(`dayType.${dayType as DayType}`) : dayType;
}

function toNumber(value: string) {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// ============================================================
// Create / edit plan
// ============================================================

/** Creates a plan already assigned to an athlete, or edits an existing plan. */
export function PlanDialog({
  plan,
  clientId,
  trigger,
  onSaved,
}: {
  plan?: NutritionPlanRow;
  /** Pre-selected athlete (e.g. from their profile or the client filter). */
  clientId?: string | undefined;
  trigger?: ReactNode;
  onSaved?: (planId: string) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const { data: roster } = useCoachRoster();
  const createPlan = useCreateNutritionPlan();
  const updatePlan = useUpdateNutritionPlan();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [name, setName] = useState("");
  const [dayType, setDayType] = useState<DayType>("training");
  const [notes, setNotes] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [active, setActive] = useState(true);
  const pending = createPlan.isPending || updatePlan.isPending;

  const load = () => {
    setClient(plan?.client_id ?? clientId ?? "");
    setName(plan?.name ?? "");
    setDayType(
      DAY_TYPES.includes(plan?.day_type as DayType) ? (plan!.day_type as DayType) : "training",
    );
    setNotes(plan?.notes ?? "");
    setCalories(plan ? String(plan.target_calories) : "2100");
    setProtein(plan ? String(plan.target_protein_g) : "160");
    setCarbs(plan ? String(plan.target_carbs_g) : "240");
    setFat(plan ? String(plan.target_fat_g) : "65");
    setActive(plan?.is_active ?? true);
  };

  const onSubmit = async () => {
    if (!client) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    if (!name.trim()) {
      toast.error(t("validation.planNameRequired"));
      return;
    }
    const macros = [calories, protein, carbs, fat].map(toNumber);
    if (macros.some((m) => m === null)) {
      toast.error(t("validation.number"));
      return;
    }
    const [cal, p, c, f] = macros as number[];
    const input = {
      client_id: client,
      name: name.trim(),
      day_type: dayType,
      notes: notes.trim() || null,
      target_calories: cal!,
      target_protein_g: p!,
      target_carbs_g: c!,
      target_fat_g: f!,
      is_active: active,
    };
    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, ...input });
        toast.success(t("coach.nutrition.saved"));
        onSaved?.(plan.id);
      } else {
        const created = await createPlan.mutateAsync(input);
        toast.success(t("coach.nutrition.created"));
        onSaved?.(created.id);
      }
      setOpen(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.createFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) load();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            {t("coach.nutrition.createPlan")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plan ? t("coach.nutrition.editPlanTitle") : t("coach.nutrition.newPlanTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("coach.nutrition.client")} htmlFor="plan-client">
            <FieldSelect
              id="plan-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">{t("coach.nutrition.selectClient")}</option>
              {(roster ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {displayName(c.name)}
                </option>
              ))}
            </FieldSelect>
          </Field>
          <Field label={t("coach.nutrition.planName")} htmlFor="plan-name">
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("coach.nutrition.planNamePlaceholder")}
            />
          </Field>
          <Field label={t("coach.nutrition.dayType")} htmlFor="plan-day-type">
            <FieldSelect
              id="plan-day-type"
              value={dayType}
              onChange={(e) => setDayType(e.target.value as DayType)}
            >
              {DAY_TYPES.map((d) => (
                <option key={d} value={d}>
                  {t(`dayType.${d}`)}
                </option>
              ))}
            </FieldSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["plan-cal", "coach.nutrition.calories", calories, setCalories],
                ["plan-protein", "coach.nutrition.proteinG", protein, setProtein],
                ["plan-carbs", "coach.nutrition.carbsG", carbs, setCarbs],
                ["plan-fat", "coach.nutrition.fatG", fat, setFat],
              ] as const
            ).map(([id, labelKey, value, set]) => (
              <Field key={id} label={t(labelKey)} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </Field>
            ))}
          </div>
          <Field label={t("coach.nutrition.notesLabel")} htmlFor="plan-notes">
            <Textarea
              id="plan-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("coach.nutrition.notesPlaceholder")}
            />
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t("coach.nutrition.activeLabel")}</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending}>
            {pending
              ? plan
                ? t("common.saving")
                : t("coach.nutrition.creating")
              : plan
                ? t("coach.nutrition.saveChanges")
                : t("coach.nutrition.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Add meal
// ============================================================

function AddMealDialog({ plan }: { plan: CoachPlan }) {
  const i18n = useI18n();
  const { t } = i18n;
  const addMeal = useAddMeal();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [foods, setFoods] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const reset = () => {
    setName("");
    setTime("");
    setFoods("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("validation.mealNameRequired"));
      return;
    }
    const values = [kcal, protein, carbs, fat].map((v) => (v.trim() === "" ? 0 : toNumber(v)));
    if (values.some((v) => v === null)) {
      toast.error(t("validation.number"));
      return;
    }
    const [cal, p, c, f] = values as number[];
    try {
      await addMeal.mutateAsync({
        nutrition_plan_id: plan.id,
        name: name.trim(),
        meal_time: time || null,
        order_index: plan.meals.length,
        foods_summary: foods.trim() || null,
        calories: cal!,
        protein_g: p!,
        carbs_g: c!,
        fat_g: f!,
      });
      toast.success(t("coach.nutrition.mealAdded"));
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.mealFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus />
          {t("coach.nutrition.addMeal")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("coach.nutrition.addMealTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
            <Field label={t("coach.nutrition.mealName")} htmlFor="meal-name">
              <Input
                id="meal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("coach.nutrition.mealNamePlaceholder")}
              />
            </Field>
            <Field label={t("coach.nutrition.mealTime")} htmlFor="meal-time">
              <Input
                id="meal-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("coach.nutrition.foods")} htmlFor="meal-foods">
            <Input
              id="meal-foods"
              value={foods}
              onChange={(e) => setFoods(e.target.value)}
              placeholder={t("coach.nutrition.foodsPlaceholder")}
            />
          </Field>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["meal-kcal", "coach.nutrition.kcal", kcal, setKcal],
                ["meal-protein", "coach.nutrition.proteinG", protein, setProtein],
                ["meal-carbs", "coach.nutrition.carbsG", carbs, setCarbs],
                ["meal-fat", "coach.nutrition.fatG", fat, setFat],
              ] as const
            ).map(([id, labelKey, value, set]) => (
              <Field key={id} label={t(labelKey)} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={addMeal.isPending}>
            {addMeal.isPending ? t("common.saving") : t("coach.nutrition.addMeal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Page
// ============================================================

export function Nutrition() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const displayName = useDisplayName();
  const search = useSearch({ strict: false }) as { client?: string; plan?: string };
  const navigate = useNavigate();
  const { data: roster, isLoading: rosterLoading } = useCoachRoster();
  const { data: plans, isLoading, isError } = useCoachNutritionPlans();
  const updatePlan = useUpdateNutritionPlan();
  const deletePlan = useDeleteNutritionPlan();
  const deleteMeal = useDeleteMeal();
  const [clientFilter, setClientFilter] = useState(search.client ?? "");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(search.plan ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (search.plan) setSelectedId(search.plan);
    if (search.client) setClientFilter(search.client);
  }, [search.plan, search.client]);

  const all = plans ?? [];
  const needle = query.trim().toLowerCase();
  const shown = all.filter(
    (p) =>
      (!clientFilter || p.client_id === clientFilter) &&
      (!needle ||
        p.name.toLowerCase().includes(needle) ||
        (p.client?.full_name ?? "").toLowerCase().includes(needle)),
  );
  const selected = shown.find((p) => p.id === selectedId) ?? shown[0] ?? null;
  const selectedClientName = displayName(selected?.client?.full_name);

  const selectPlan = (id: string) => {
    setSelectedId(id);
    navigate({ to: "/coach/nutrition", search: (prev) => ({ ...prev, plan: id }), replace: true });
  };

  const toggleActive = async (plan: CoachPlan, next: boolean) => {
    try {
      await updatePlan.mutateAsync({ id: plan.id, is_active: next });
      toast.success(t(next ? "coach.nutrition.activated" : "coach.nutrition.deactivated"));
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.updateFailed"));
    }
  };

  const onDeletePlan = async () => {
    if (!selected) return;
    try {
      await deletePlan.mutateAsync(selected.id);
      toast.success(t("coach.nutrition.deleted"));
      setConfirmDelete(false);
      setSelectedId(null);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.deleteFailed"));
    }
  };

  const onDeleteMeal = async (mealId: string) => {
    try {
      await deleteMeal.mutateAsync(mealId);
      toast.success(t("coach.nutrition.mealDeleted"));
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.updateFailed"));
    }
  };

  const noClients = !rosterLoading && (roster ?? []).length === 0;

  return (
    <>
      <PageHead
        eyebrow={t("coach.nutrition.eyebrow")}
        title={t("coach.nutrition.title")}
        subtitle={t("coach.nutrition.subtitle")}
        action={
          noClients ? undefined : (
            <PlanDialog clientId={clientFilter || undefined} onSaved={selectPlan} />
          )
        }
      />
      {noClients ? (
        <EmptyState>{t("coach.nutrition.noClients")}</EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <div className="search-wrap">
              <Search />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("coach.nutrition.searchPlans")}
              />
            </div>
            <FieldSelect
              className="max-w-xs"
              aria-label={t("coach.nutrition.client")}
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                navigate({
                  to: "/coach/nutrition",
                  search: e.target.value ? { client: e.target.value } : {},
                  replace: true,
                });
              }}
            >
              <option value="">{t("coach.nutrition.allClients")}</option>
              {(roster ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {displayName(c.name)}
                </option>
              ))}
            </FieldSelect>
            <span className="ms-auto text-xs font-bold text-muted-foreground">
              {tp("coach.nutrition.countPlans", shown.length)}
            </span>
          </div>
          {isLoading && (
            <p className="p-6 text-sm text-muted-foreground">{t("coach.nutrition.loading")}</p>
          )}
          {isError && <EmptyState>{t("errors.generic")}</EmptyState>}
          {!isLoading && !isError && all.length === 0 && (
            <EmptyState>{t("coach.nutrition.noPlans")}</EmptyState>
          )}
          {!isLoading && all.length > 0 && shown.length === 0 && (
            <EmptyState
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setClientFilter("");
                  }}
                >
                  {t("common.clearFilters")}
                </Button>
              }
            >
              {t("coach.nutrition.noMatches")}
            </EmptyState>
          )}
          {shown.length > 0 && (
            <div className="plan-grid">
              {shown.map((p) => (
                <button
                  key={p.id}
                  className={`plan-card ${selected?.id === p.id ? "selected" : ""}`}
                  onClick={() => selectPlan(p.id)}
                >
                  <span className="avatar-sm">{initialsFromName(p.client?.full_name)}</span>
                  <span className="min-w-0 flex-1 text-start">
                    <b className="block truncate">{p.name}</b>
                    <small className="block truncate">
                      {t("coach.nutrition.assignedTo", { name: displayName(p.client?.full_name) })}
                    </small>
                    <small className="block">
                      {t("coach.nutrition.dayLine", {
                        dayType: dayTypeLabel(t, p.day_type),
                        kcal: p.target_calories,
                      })}
                    </small>
                  </span>
                  <span className={`status ${p.is_active ? "on-track" : "new"}`}>
                    {p.is_active ? t("coach.nutrition.active") : t("coach.nutrition.inactive")}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <>
              <div className="nutrition-head mt-8">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {t("coach.nutrition.selectedPlan")} ·{" "}
                    {t("coach.nutrition.assignedTo", { name: selectedClientName })}
                  </p>
                  <h2>{selected.name}</h2>
                  <p>
                    {t("coach.nutrition.dayLine", {
                      dayType: dayTypeLabel(t, selected.day_type),
                      kcal: selected.target_calories,
                    })}
                  </p>
                  {selected.notes && (
                    <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-muted-foreground">
                      {selected.notes}
                    </p>
                  )}
                </div>
                <div className="macro-strip">
                  {(
                    [
                      ["P", selected.target_protein_g, "coach.nutrition.protein"],
                      ["C", selected.target_carbs_g, "coach.nutrition.carbs"],
                      ["F", selected.target_fat_g, "coach.nutrition.fat"],
                    ] as const
                  ).map(([letter, grams, labelKey]) => (
                    <div key={letter}>
                      <span>{letter}</span>
                      <b>{grams}g</b>
                      <small>{t(labelKey)}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="plan-actions">
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={selected.is_active}
                    disabled={updatePlan.isPending}
                    onCheckedChange={(next) => toggleActive(selected, next)}
                  />
                  <span>
                    <b className="block">
                      {selected.is_active
                        ? t("coach.nutrition.active")
                        : t("coach.nutrition.inactive")}
                    </b>
                    <small className="text-muted-foreground">
                      {t("coach.nutrition.activeHint")}
                    </small>
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <PlanDialog
                    plan={selected}
                    trigger={
                      <Button variant="outline">
                        <Pencil />
                        {t("coach.nutrition.editPlan")}
                      </Button>
                    }
                  />
                  <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                    <Trash2 />
                    {t("coach.nutrition.deletePlan")}
                  </Button>
                </div>
              </div>
              <section className="mt-8">
                <SectionTitle
                  overline={t("coach.nutrition.dailySequence")}
                  title={t("coach.nutrition.mealStructure")}
                />
                <div className="meal-list">
                  {selected.meals.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">
                      {t("coach.nutrition.noMeals")}
                    </p>
                  )}
                  {selected.meals.map((m, i) => (
                    <article className="meal-row" key={m.id}>
                      <time>{m.meal_time?.slice(0, 5) ?? "—"}</time>
                      <span className="meal-number">{String(i + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <h3>{m.name}</h3>
                        <p>{m.foods_summary ?? t("coach.nutrition.noFoods")}</p>
                      </div>
                      <div className="meal-macros">
                        <b>{m.calories}</b>
                        <small>{t("common.kcalUpper")}</small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={t("coach.nutrition.deleteMeal")}
                        disabled={deleteMeal.isPending}
                        onClick={() => onDeleteMeal(m.id)}
                      >
                        <X size={16} />
                      </button>
                    </article>
                  ))}
                  <AddMealDialog plan={selected} />
                </div>
              </section>
              <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={t("coach.nutrition.deleteConfirmTitle", { name: selected.name })}
                description={t("coach.nutrition.deleteConfirmBody", { client: selectedClientName })}
                confirmLabel={t("coach.nutrition.deletePlan")}
                pending={deletePlan.isPending}
                onConfirm={onDeletePlan}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
