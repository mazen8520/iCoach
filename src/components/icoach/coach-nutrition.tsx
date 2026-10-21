import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  CopyPlus,
  Eraser,
  Lock,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, PageHead, SectionTitle } from "./primitives";
import { ConfirmDialog, Field, FieldSelect } from "./shared";
import { useDisplayName } from "./coach-shared";
import { DumbbellLoader } from "./gym-visuals";
import { useCoachRoster } from "@/hooks/use-clients";
import {
  DAY_TYPES,
  mealsForDay,
  useAddMeal,
  useClearDay,
  useCoachNutritionPlans,
  useCopyDay,
  useCopyPlan,
  useCreateNutritionPlan,
  useDeleteMeal,
  useDeleteNutritionPlan,
  useNutritionTemplates,
  useReorderMeals,
  useSetDayMarker,
  useUpdateMeal,
  useUpdateNutritionPlan,
  type CoachMeal,
  type CoachPlan,
  type DayType,
  type FoodItemInput,
  type Macros,
} from "@/hooks/use-nutrition";
import { DAY_MARKERS, FOOD_UNITS, MEAL_PRESETS } from "@/lib/taxonomy";
import { WEEK_ORDER } from "@/lib/week";
import { useFoodLine, useWeekdayName } from "./nutrition-text";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import { initialsFromName } from "@/lib/format";
import type { DayMarker, FoodAlternative, FoodUnit } from "@/lib/database.types";

function dayTypeLabel(t: (key: TranslationKey) => string, dayType: string) {
  return DAY_TYPES.includes(dayType as DayType) ? t(`dayType.${dayType as DayType}`) : dayType;
}

function toNumber(value: string) {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// ============================================================
// Create / edit plan (athlete plan or template)
// ============================================================

export function PlanDialog({
  plan,
  clientId,
  template = false,
  trigger,
  onSaved,
}: {
  plan?: CoachPlan | undefined;
  /** Pre-selected athlete (e.g. from their profile or the client filter). */
  clientId?: string | undefined;
  /** Create a template instead of an athlete plan. */
  template?: boolean | undefined;
  trigger?: ReactNode;
  onSaved?: ((planId: string) => void) | undefined;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const { data: roster } = useCoachRoster();
  const { data: templates } = useNutritionTemplates();
  const createPlan = useCreateNutritionPlan();
  const updatePlan = useUpdateNutritionPlan();
  const copyPlan = useCopyPlan();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [fromTemplate, setFromTemplate] = useState("");
  const [name, setName] = useState("");
  const [dayType, setDayType] = useState<DayType>("any");
  const [notes, setNotes] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [active, setActive] = useState(true);
  const isTemplate = plan ? plan.is_template : template;
  const pending = createPlan.isPending || updatePlan.isPending || copyPlan.isPending;

  const load = () => {
    setClient(plan?.client_id ?? clientId ?? "");
    setFromTemplate("");
    setName(plan?.name ?? "");
    setDayType(DAY_TYPES.includes(plan?.day_type as DayType) ? (plan!.day_type as DayType) : "any");
    setNotes(plan?.notes ?? "");
    setCalories(plan ? String(plan.targets?.target_calories ?? 0) : "2100");
    setProtein(plan ? String(plan.targets?.target_protein_g ?? 0) : "160");
    setCarbs(plan ? String(plan.targets?.target_carbs_g ?? 0) : "240");
    setFat(plan ? String(plan.targets?.target_fat_g ?? 0) : "65");
    setActive(plan?.is_active ?? true);
  };

  const onSubmit = async () => {
    if (!isTemplate && !client) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    if (!fromTemplate && !name.trim()) {
      toast.error(t("validation.planNameRequired"));
      return;
    }
    try {
      if (!plan && fromTemplate) {
        const id = await copyPlan.mutateAsync({
          sourceId: fromTemplate,
          clientId: client,
          name: name.trim() || null,
          asTemplate: false,
        });
        toast.success(t("nutrition.templateAssigned"));
        onSaved?.(id);
        setOpen(false);
        return;
      }
      const numbers = [calories, protein, carbs, fat].map(toNumber);
      if (numbers.some((m) => m === null)) {
        toast.error(t("validation.number"));
        return;
      }
      const [cal, p, c, f] = numbers as number[];
      const targets = {
        target_calories: cal!,
        target_protein_g: p!,
        target_carbs_g: c!,
        target_fat_g: f!,
      };
      const input = {
        client_id: isTemplate ? null : client,
        name: name.trim(),
        day_type: dayType,
        notes: notes.trim() || null,
        is_active: isTemplate ? false : active,
      };
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, ...input, targets });
        toast.success(t("coach.nutrition.saved"));
        onSaved?.(plan.id);
      } else {
        const created = await createPlan.mutateAsync({
          ...input,
          is_template: isTemplate,
          targets,
        });
        toast.success(t(isTemplate ? "nutrition.templateCreated" : "coach.nutrition.created"));
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
            {template ? t("nutrition.newTemplate") : t("coach.nutrition.createPlan")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plan
              ? isTemplate
                ? t("nutrition.editTemplateTitle")
                : t("coach.nutrition.editPlanTitle")
              : isTemplate
                ? t("nutrition.newTemplateTitle")
                : t("coach.nutrition.newPlanTitle")}
          </DialogTitle>
          <DialogDescription>{t("nutrition.weekExplainer")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!isTemplate && (
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
          )}
          {!plan && !isTemplate && (templates ?? []).length > 0 && (
            <Field
              label={t("nutrition.startFrom")}
              htmlFor="plan-template"
              hint={fromTemplate ? t("nutrition.startFromHint") : undefined}
            >
              <FieldSelect
                id="plan-template"
                value={fromTemplate}
                onChange={(e) => setFromTemplate(e.target.value)}
              >
                <option value="">{t("nutrition.blankWeek")}</option>
                {(templates ?? []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          )}
          <Field label={t("coach.nutrition.planName")} htmlFor="plan-name">
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                fromTemplate
                  ? t("nutrition.keepTemplateName")
                  : t("coach.nutrition.planNamePlaceholder")
              }
            />
          </Field>
          {!fromTemplate && (
            <>
              <Field
                label={t("nutrition.appliesOn")}
                htmlFor="plan-day-type"
                hint={t("nutrition.appliesOnHint")}
              >
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
              <p className="coach-only-note">
                <Lock aria-hidden="true" />
                {t("nutrition.coachOnlyNumbers")}
              </p>
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
              {!isTemplate && (
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t("coach.nutrition.activeLabel")}</span>
                  <Switch checked={active} onCheckedChange={setActive} />
                </label>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending}>
            {pending
              ? t("common.saving")
              : plan
                ? t("coach.nutrition.saveChanges")
                : fromTemplate
                  ? t("nutrition.assignTemplate")
                  : isTemplate
                    ? t("nutrition.createTemplate")
                    : t("coach.nutrition.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Copy whole plan (to an athlete, or as a template)
// ============================================================

function CopyPlanDialog({
  plan,
  asTemplate,
  onDone,
}: {
  plan: CoachPlan;
  asTemplate: boolean;
  onDone: (id: string) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const { data: roster } = useCoachRoster();
  const copyPlan = useCopyPlan();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [name, setName] = useState("");

  const onSubmit = async () => {
    if (!asTemplate && !client) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    try {
      const id = await copyPlan.mutateAsync({
        sourceId: plan.id,
        clientId: asTemplate ? null : client,
        name: name.trim() || null,
        asTemplate,
      });
      toast.success(
        t(
          asTemplate
            ? "nutrition.savedAsTemplate"
            : plan.is_template
              ? "nutrition.templateAssigned"
              : "nutrition.weekCopied",
        ),
      );
      setOpen(false);
      onDone(id);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.updateFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setClient("");
          setName(asTemplate ? plan.name : "");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          {asTemplate ? <BookmarkPlus /> : <Send />}
          {asTemplate
            ? t("nutrition.saveAsTemplate")
            : plan.is_template
              ? t("nutrition.assignTemplate")
              : t("nutrition.copyWeek")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {asTemplate
              ? t("nutrition.saveAsTemplate")
              : plan.is_template
                ? t("nutrition.assignTemplate")
                : t("nutrition.copyWeek")}
          </DialogTitle>
          <DialogDescription>
            {asTemplate ? t("nutrition.saveAsTemplateBody") : t("nutrition.copyWeekBody")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!asTemplate && (
            <Field label={t("coach.nutrition.client")} htmlFor="copy-client">
              <FieldSelect
                id="copy-client"
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
          )}
          <Field label={t("coach.nutrition.planName")} htmlFor="copy-name">
            <Input
              id="copy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={plan.name}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={copyPlan.isPending}>
            {copyPlan.isPending ? t("common.saving") : t("nutrition.copyConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Meal editor: name, time, food items with "or" swaps, coach-only macros
// ============================================================

type ItemDraft = {
  key: string;
  name: string;
  quantity: string;
  unit: FoodUnit | "";
  notes: string;
  alternatives: { key: string; name: string; quantity: string; unit: FoodUnit | "" }[];
};

let draftKey = 0;
const nextKey = () => `k${++draftKey}`;

function emptyItem(): ItemDraft {
  return { key: nextKey(), name: "", quantity: "", unit: "g", notes: "", alternatives: [] };
}

function MealDialog({
  open,
  onOpenChange,
  planId,
  weekday,
  orderIndex,
  meal,
  presetName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  weekday: number;
  orderIndex: number;
  meal?: CoachMeal | null | undefined;
  presetName?: string | undefined;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const addMeal = useAddMeal();
  const updateMeal = useUpdateMeal();
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const pending = addMeal.isPending || updateMeal.isPending;

  useEffect(() => {
    if (!open) return;
    setName(meal?.name ?? presetName ?? "");
    setTime(meal?.meal_time?.slice(0, 5) ?? "");
    setItems(
      meal?.meal_items.length
        ? meal.meal_items.map((i) => ({
            key: nextKey(),
            name: i.name,
            quantity: i.quantity != null ? String(i.quantity) : "",
            unit: i.unit ?? "",
            notes: i.notes ?? "",
            alternatives: (i.alternatives ?? []).map((a) => ({
              key: nextKey(),
              name: a.name,
              quantity: a.quantity != null ? String(a.quantity) : "",
              unit: a.unit ?? "",
            })),
          }))
        : meal?.foods_summary
          ? [{ ...emptyItem(), name: meal.foods_summary, unit: "" }]
          : [emptyItem()],
    );
    const m = meal?.meal_macros;
    setKcal(m ? String(m.calories) : "");
    setProtein(m ? String(m.protein_g) : "");
    setCarbs(m ? String(m.carbs_g) : "");
    setFat(m ? String(m.fat_g) : "");
  }, [open, meal, presetName]);

  const patchItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("validation.mealNameRequired"));
      return;
    }
    const macroValues = [kcal, protein, carbs, fat].map((v) => (v.trim() === "" ? 0 : toNumber(v)));
    if (macroValues.some((v) => v === null)) {
      toast.error(t("validation.number"));
      return;
    }
    const cleanItems: FoodItemInput[] = [];
    for (const item of items) {
      if (!item.name.trim()) continue;
      const quantity = item.quantity.trim() === "" ? null : Number(item.quantity);
      if (quantity != null && !(Number.isFinite(quantity) && quantity >= 0)) {
        toast.error(t("validation.number"));
        return;
      }
      const alternatives: FoodAlternative[] = item.alternatives
        .filter((a) => a.name.trim())
        .map((a) => ({
          name: a.name.trim(),
          quantity: a.quantity.trim() === "" ? null : Math.max(0, Number(a.quantity) || 0),
          unit: a.unit || null,
        }));
      cleanItems.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit || null,
        notes: item.notes.trim() || null,
        alternatives,
      });
    }
    const [cal, p, c, f] = macroValues as number[];
    const macros: Macros = { calories: cal!, protein_g: p!, carbs_g: c!, fat_g: f! };
    const input = { name: name.trim(), meal_time: time || null, items: cleanItems, macros };
    try {
      if (meal) await updateMeal.mutateAsync({ id: meal.id, meal: input });
      else await addMeal.mutateAsync({ planId, weekday, orderIndex, meal: input });
      toast.success(t(meal ? "nutrition.mealSaved" : "coach.nutrition.mealAdded"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.mealFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="meal-dialog max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {meal ? t("nutrition.editMeal") : t("coach.nutrition.addMealTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="chip-group" role="group" aria-label={t("nutrition.mealPresets")}>
            {MEAL_PRESETS.map((preset) => {
              const label = t(`mealPreset.${preset}`);
              const on = name === label;
              return (
                <button
                  type="button"
                  key={preset}
                  className={`chip ${on ? "selected" : ""}`}
                  aria-pressed={on}
                  onClick={() => setName(label)}
                >
                  {on && <Check aria-hidden="true" />}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <Field label={t("coach.nutrition.mealName")} htmlFor="meal-name">
              <Input
                id="meal-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("coach.nutrition.mealNamePlaceholder")}
              />
            </Field>
            <Field label={t("nutrition.timeOptional")} htmlFor="meal-time">
              <Input
                id="meal-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>

          <div className="food-items">
            <span className="form-block-title">{t("nutrition.foodItems")}</span>
            {items.map((item, index) => (
              <div className="food-item" key={item.key}>
                <div className="food-item-main">
                  <Input
                    aria-label={t("nutrition.foodName")}
                    placeholder={t("nutrition.foodNamePlaceholder")}
                    value={item.name}
                    maxLength={120}
                    onChange={(e) => patchItem(item.key, { name: e.target.value })}
                  />
                  <Input
                    aria-label={t("nutrition.quantity")}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={item.quantity}
                    onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
                  />
                  <FieldSelect
                    aria-label={t("nutrition.unit")}
                    value={item.unit}
                    onChange={(e) => patchItem(item.key, { unit: e.target.value as FoodUnit | "" })}
                  >
                    <option value="">—</option>
                    {FOOD_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {t(`foodUnit.${u}`)}
                      </option>
                    ))}
                  </FieldSelect>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("nutrition.removeFood")}
                    onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                  >
                    <X />
                  </button>
                </div>
                <Input
                  aria-label={t("nutrition.prepNotes")}
                  placeholder={t("nutrition.prepNotesPlaceholder")}
                  value={item.notes}
                  maxLength={200}
                  onChange={(e) => patchItem(item.key, { notes: e.target.value })}
                />
                {item.alternatives.map((alt) => (
                  <div className="food-alt" key={alt.key}>
                    <span className="or-tag">{t("nutrition.or")}</span>
                    <Input
                      aria-label={t("nutrition.alternativeName")}
                      placeholder={t("nutrition.alternativePlaceholder")}
                      value={alt.name}
                      onChange={(e) =>
                        patchItem(item.key, {
                          alternatives: item.alternatives.map((a) =>
                            a.key === alt.key ? { ...a, name: e.target.value } : a,
                          ),
                        })
                      }
                    />
                    <Input
                      aria-label={t("nutrition.quantity")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={alt.quantity}
                      onChange={(e) =>
                        patchItem(item.key, {
                          alternatives: item.alternatives.map((a) =>
                            a.key === alt.key ? { ...a, quantity: e.target.value } : a,
                          ),
                        })
                      }
                    />
                    <FieldSelect
                      aria-label={t("nutrition.unit")}
                      value={alt.unit}
                      onChange={(e) =>
                        patchItem(item.key, {
                          alternatives: item.alternatives.map((a) =>
                            a.key === alt.key ? { ...a, unit: e.target.value as FoodUnit | "" } : a,
                          ),
                        })
                      }
                    >
                      <option value="">—</option>
                      {FOOD_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {t(`foodUnit.${u}`)}
                        </option>
                      ))}
                    </FieldSelect>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("nutrition.removeAlternative")}
                      onClick={() =>
                        patchItem(item.key, {
                          alternatives: item.alternatives.filter((a) => a.key !== alt.key),
                        })
                      }
                    >
                      <X />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    patchItem(item.key, {
                      alternatives: [
                        ...item.alternatives,
                        { key: nextKey(), name: "", quantity: "", unit: item.unit },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden="true" />
                  {t("nutrition.addAlternative", { n: index + 1 })}
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((l) => [...l, emptyItem()])}
            >
              <Plus />
              {t("nutrition.addFood")}
            </Button>
          </div>

          <div className="coach-macros">
            <p className="coach-only-note">
              <Lock aria-hidden="true" />
              {t("nutrition.coachOnlyNumbers")}
            </p>
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
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? t("common.saving") : meal ? t("common.save") : t("coach.nutrition.addMeal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Day tools: copy to days, clear, day marker
// ============================================================

function CopyDayPopover({ plan, weekday }: { plan: CoachPlan; weekday: number }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dayName = useWeekdayName();
  const copyDay = useCopyDay();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<number[]>([]);
  const others = WEEK_ORDER.filter((d) => d !== weekday);
  const all = targets.length === others.length;

  const onCopy = async (days: number[]) => {
    if (days.length === 0) return;
    try {
      await copyDay.mutateAsync({ planId: plan.id, fromDay: weekday, toDays: days });
      toast.success(
        days.length === others.length
          ? t("nutrition.sameEveryDayDone", { day: dayName(weekday) })
          : i18n.tp("nutrition.copiedToDays", days.length),
      );
      setOpen(false);
      setTargets([]);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.updateFailed"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CopyPlus />
          {t("nutrition.copyDay")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,20rem)]" align="end">
        <p className="mb-2 text-sm font-bold">
          {t("nutrition.copyDayTo", { day: dayName(weekday) })}
        </p>
        <div className="chip-group" role="group" aria-label={t("nutrition.copyDayTargets")}>
          {others.map((d) => {
            const on = targets.includes(d);
            return (
              <button
                type="button"
                key={d}
                className={`chip ${on ? "selected" : ""}`}
                aria-pressed={on}
                onClick={() => setTargets((v) => (on ? v.filter((x) => x !== d) : [...v, d]))}
              >
                {on && <Check aria-hidden="true" />}
                {dayName(d, "short")}
              </button>
            );
          })}
          <button
            type="button"
            className={`chip ${all ? "selected" : ""}`}
            aria-pressed={all}
            onClick={() => setTargets(all ? [] : [...others])}
          >
            {all && <Check aria-hidden="true" />}
            {t("nutrition.allDays")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("nutrition.copyReplaces")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onCopy(targets)}
            disabled={!targets.length || copyDay.isPending}
          >
            {t("nutrition.copyConfirm")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCopy([...others])}
            disabled={copyDay.isPending}
          >
            {t("nutrition.sameEveryDay")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WeekPlanner({ plan }: { plan: CoachPlan }) {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const dayName = useWeekdayName();
  const foodLine = useFoodLine();
  const todayWeekday = new Date().getDay();
  const [weekday, setWeekday] = useState<number>(todayWeekday);
  const [editing, setEditing] = useState<CoachMeal | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const setMarker = useSetDayMarker();
  const clearDay = useClearDay();
  const deleteMeal = useDeleteMeal();
  const reorder = useReorderMeals();
  const meals = mealsForDay(plan, weekday);
  const marker = plan.day_types?.[String(weekday)] ?? null;
  const dayKcal = meals.reduce((sum, m) => sum + (m.meal_macros?.calories ?? 0), 0);

  const onMarker = (next: DayMarker | null) =>
    setMarker.mutate(
      { plan, weekday, marker: next },
      { onError: (err) => toast.error(errorText(err, i18n, "coach.nutrition.updateFailed")) },
    );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= meals.length) return;
    const ids = meals.map((m) => m.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    reorder.mutate(ids, {
      onError: (err) => toast.error(errorText(err, i18n, "coach.nutrition.updateFailed")),
    });
  };

  const onClear = async () => {
    try {
      await clearDay.mutateAsync({ planId: plan.id, weekday });
      toast.success(t("nutrition.dayCleared", { day: dayName(weekday) }));
      setConfirmClear(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.updateFailed"));
    }
  };

  return (
    <section className="week-planner mt-8">
      <SectionTitle overline={t("nutrition.weekOverline")} title={t("nutrition.weekTitle")} />
      <div className="week-tabs" role="tablist" aria-label={t("nutrition.weekTitle")}>
        {WEEK_ORDER.map((d) => {
          const count = mealsForDay(plan, d).length;
          const dm = plan.day_types?.[String(d)];
          return (
            <button
              key={d}
              role="tab"
              aria-selected={weekday === d}
              className={`${weekday === d ? "selected" : ""} ${d === todayWeekday ? "today" : ""}`}
              onClick={() => setWeekday(d)}
            >
              <small>{dayName(d, "short")}</small>
              <b>{count}</b>
              <span className={`day-marker ${dm ?? "none"}`}>
                {dm ? t(`dayMarker.${dm}`) : "·"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="day-panel" role="tabpanel">
        <div className="day-panel-head">
          <div>
            <h3>{dayName(weekday)}</h3>
            <p>
              {tp("nutrition.mealCount", meals.length)}
              {dayKcal > 0 && (
                <span className="coach-only-inline">
                  <Lock aria-hidden="true" /> {dayKcal} {t("common.kcal")}
                </span>
              )}
            </p>
          </div>
          <div className="chip-group" role="group" aria-label={t("nutrition.dayMarker")}>
            {DAY_MARKERS.map((m) => (
              <button
                type="button"
                key={m}
                className={`chip ${marker === m ? "selected" : ""}`}
                aria-pressed={marker === m}
                disabled={setMarker.isPending}
                onClick={() => onMarker(marker === m ? null : m)}
              >
                {marker === m && <Check aria-hidden="true" />}
                {t(`dayMarker.${m}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyDayPopover plan={plan} weekday={weekday} />
            <Button
              variant="outline"
              size="sm"
              disabled={meals.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              <Eraser />
              {t("nutrition.clearDay")}
            </Button>
          </div>
        </div>

        <div className="meal-list">
          {meals.length === 0 && (
            <EmptyState icon="plate">
              {t("nutrition.emptyDay", { day: dayName(weekday) })}
            </EmptyState>
          )}
          {meals.map((m, i) => (
            <article className="meal-row planner" key={m.id}>
              <time>{m.meal_time?.slice(0, 5) ?? "—"}</time>
              <div className="min-w-0 flex-1">
                <h4>{m.name}</h4>
                {m.meal_items.length > 0 ? (
                  <ul className="food-lines">
                    {m.meal_items.map((item) => (
                      <li key={item.id}>
                        <span>{foodLine(item)}</span>
                        {item.alternatives.length > 0 && (
                          <span className="food-or">
                            {item.alternatives
                              .map((a) => `${t("nutrition.or")} ${foodLine(a)}`)
                              .join(" · ")}
                          </span>
                        )}
                        {item.notes && <small>{item.notes}</small>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{m.foods_summary ?? t("coach.nutrition.noFoods")}</p>
                )}
              </div>
              {m.meal_macros && m.meal_macros.calories > 0 && (
                <div className="meal-macros coach" title={t("nutrition.coachOnlyNumbers")}>
                  <b>{m.meal_macros.calories}</b>
                  <small>{t("common.kcalUpper")}</small>
                </div>
              )}
              <div className="meal-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("nutrition.moveMealUp")}
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("nutrition.moveMealDown")}
                  disabled={i === meals.length - 1 || reorder.isPending}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("nutrition.editMeal")}
                  onClick={() => setEditing(m)}
                >
                  <Pencil />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("coach.nutrition.deleteMeal")}
                  disabled={deleteMeal.isPending}
                  onClick={() =>
                    deleteMeal.mutate(m.id, {
                      onSuccess: () => toast.success(t("coach.nutrition.mealDeleted")),
                      onError: (err) =>
                        toast.error(errorText(err, i18n, "coach.nutrition.updateFailed")),
                    })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="add-meal-bar">
          <span>{t("nutrition.quickAdd")}</span>
          <div className="chip-group">
            {MEAL_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className="chip"
                onClick={() => setAdding(t(`mealPreset.${preset}`))}
              >
                <Plus aria-hidden="true" />
                {t(`mealPreset.${preset}`)}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setAdding("")}>
              <Plus aria-hidden="true" />
              {t("nutrition.customMeal")}
            </button>
          </div>
        </div>
      </div>

      <MealDialog
        open={!!editing || adding !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(null);
          }
        }}
        planId={plan.id}
        weekday={weekday}
        orderIndex={meals.length}
        meal={editing}
        presetName={adding ?? undefined}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t("nutrition.clearDayTitle", { day: dayName(weekday) })}
        description={t("nutrition.clearDayBody")}
        confirmLabel={t("nutrition.clearDay")}
        pending={clearDay.isPending}
        onConfirm={onClear}
      />
    </section>
  );
}

// ============================================================
// Page
// ============================================================

export function Nutrition() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const displayName = useDisplayName();
  const search = useSearch({ strict: false }) as { client?: string; plan?: string; view?: string };
  const navigate = useNavigate();
  const { data: roster, isLoading: rosterLoading } = useCoachRoster();
  const { data: plans, isLoading, isError } = useCoachNutritionPlans();
  const { data: templates, isLoading: templatesLoading } = useNutritionTemplates();
  const updatePlan = useUpdateNutritionPlan();
  const deletePlan = useDeleteNutritionPlan();
  const [view, setView] = useState<"plans" | "templates">(
    search.view === "templates" ? "templates" : "plans",
  );
  const [clientFilter, setClientFilter] = useState(search.client ?? "");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(search.plan ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (search.plan) setSelectedId(search.plan);
    if (search.client) setClientFilter(search.client);
  }, [search.plan, search.client]);

  const source = view === "templates" ? (templates ?? []) : (plans ?? []);
  const needle = query.trim().toLowerCase();
  const shown = source.filter(
    (p) =>
      (view === "templates" || !clientFilter || p.client_id === clientFilter) &&
      (!needle ||
        p.name.toLowerCase().includes(needle) ||
        (p.client?.full_name ?? "").toLowerCase().includes(needle)),
  );
  const selected = shown.find((p) => p.id === selectedId) ?? shown[0] ?? null;
  const selectedClientName = displayName(selected?.client?.full_name);
  const loading = view === "templates" ? templatesLoading : isLoading;

  const selectPlan = (id: string, nextView = view) => {
    setView(nextView);
    setSelectedId(id);
    navigate({
      to: "/coach/nutrition",
      search: (prev) => {
        const { view: _view, ...rest } = prev as { client?: string; view?: "templates" };
        return nextView === "templates"
          ? { ...rest, plan: id, view: "templates" as const }
          : { ...rest, plan: id };
      },
      replace: true,
    });
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
      toast.success(
        t(selected.is_template ? "nutrition.templateDeleted" : "coach.nutrition.deleted"),
      );
      setConfirmDelete(false);
      setSelectedId(null);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.nutrition.deleteFailed"));
    }
  };

  const noClients = !rosterLoading && (roster ?? []).length === 0;

  return (
    <>
      <PageHead
        eyebrow={t("coach.nutrition.eyebrow")}
        title={t("coach.nutrition.title")}
        subtitle={t("nutrition.pageSubtitle")}
        action={
          view === "templates" ? (
            <PlanDialog template onSaved={(id) => selectPlan(id, "templates")} />
          ) : noClients ? undefined : (
            <PlanDialog
              clientId={clientFilter || undefined}
              onSaved={(id) => selectPlan(id, "plans")}
            />
          )
        }
      />
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label={t("nutrition.viewLabel")}>
          {(["plans", "templates"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? "selected" : ""}
              onClick={() => {
                setView(v);
                setSelectedId(null);
              }}
            >
              {t(v === "plans" ? "nutrition.athletePlans" : "nutrition.templates")}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <Search />
          <Input
            aria-label={t("coach.nutrition.searchPlans")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("coach.nutrition.searchPlans")}
          />
        </div>
        {view === "plans" && (
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
        )}
        <span className="ms-auto text-xs font-bold text-muted-foreground">
          {tp("coach.nutrition.countPlans", shown.length)}
        </span>
      </div>

      {view === "plans" && noClients && (
        <EmptyState icon="plate">{t("coach.nutrition.noClients")}</EmptyState>
      )}
      {loading && <DumbbellLoader label={t("coach.nutrition.loading")} />}
      {isError && <EmptyState>{t("errors.generic")}</EmptyState>}
      {!loading && !isError && source.length === 0 && !(view === "plans" && noClients) && (
        <EmptyState icon="plate">
          {view === "templates" ? t("nutrition.noTemplates") : t("coach.nutrition.noPlans")}
        </EmptyState>
      )}
      {!loading && source.length > 0 && shown.length === 0 && (
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
              aria-pressed={selected?.id === p.id}
              onClick={() => selectPlan(p.id)}
            >
              <span className="avatar-sm">
                {p.is_template ? <BookmarkPlus size={14} /> : initialsFromName(p.client?.full_name)}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <b className="block truncate">{p.name}</b>
                <small className="block truncate">
                  {p.is_template
                    ? t("nutrition.template")
                    : t("coach.nutrition.assignedTo", { name: displayName(p.client?.full_name) })}
                </small>
                <small className="block">
                  {t("coach.nutrition.dayLine", {
                    dayType: dayTypeLabel(t, p.day_type),
                    kcal: p.targets?.target_calories ?? 0,
                  })}
                </small>
              </span>
              {!p.is_template && (
                <span className={`status ${p.is_active ? "on-track" : "new"}`}>
                  {p.is_active ? t("coach.nutrition.active") : t("coach.nutrition.inactive")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <>
          <div className="nutrition-head mt-8">
            <div className="min-w-0">
              <p className="eyebrow">
                {selected.is_template
                  ? t("nutrition.template")
                  : `${t("coach.nutrition.selectedPlan")} · ${t("coach.nutrition.assignedTo", { name: selectedClientName })}`}
              </p>
              <h2>{selected.name}</h2>
              <p>
                {t("coach.nutrition.dayLine", {
                  dayType: dayTypeLabel(t, selected.day_type),
                  kcal: selected.targets?.target_calories ?? 0,
                })}
              </p>
              {selected.notes && (
                <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-muted-foreground">
                  {selected.notes}
                </p>
              )}
            </div>
            <div className="macro-strip" title={t("nutrition.coachOnlyNumbers")}>
              {(
                [
                  ["P", selected.targets?.target_protein_g ?? 0, "coach.nutrition.protein"],
                  ["C", selected.targets?.target_carbs_g ?? 0, "coach.nutrition.carbs"],
                  ["F", selected.targets?.target_fat_g ?? 0, "coach.nutrition.fat"],
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
            {!selected.is_template ? (
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
                  <small className="text-muted-foreground">{t("coach.nutrition.activeHint")}</small>
                </span>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nutrition.templateHint")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <PlanDialog
                plan={selected}
                trigger={
                  <Button variant="outline">
                    <Pencil />
                    {selected.is_template
                      ? t("nutrition.editTemplate")
                      : t("coach.nutrition.editPlan")}
                  </Button>
                }
              />
              <CopyPlanDialog
                plan={selected}
                asTemplate={false}
                onDone={(id) => selectPlan(id, "plans")}
              />
              {!selected.is_template && (
                <CopyPlanDialog
                  plan={selected}
                  asTemplate
                  onDone={(id) => selectPlan(id, "templates")}
                />
              )}
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                {selected.is_template
                  ? t("nutrition.deleteTemplate")
                  : t("coach.nutrition.deletePlan")}
              </Button>
            </div>
          </div>
          <WeekPlanner key={selected.id} plan={selected} />
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("coach.nutrition.deleteConfirmTitle", { name: selected.name })}
            description={
              selected.is_template
                ? t("nutrition.deleteTemplateBody")
                : t("coach.nutrition.deleteConfirmBody", { client: selectedClientName })
            }
            confirmLabel={
              selected.is_template ? t("nutrition.deleteTemplate") : t("coach.nutrition.deletePlan")
            }
            pending={deletePlan.isPending}
            onConfirm={onDeletePlan}
          />
        </>
      )}
    </>
  );
}
