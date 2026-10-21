import { Reorder, useDragControls } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  CopyPlus,
  GripVertical,
  Link2,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import battle from "@/assets/workout-battle-rope.jpg";
import { EmptyState, PageHead } from "./primitives";
import { ConfirmDialog, Field, FieldSelect } from "./shared";
import { AssignWorkoutDialog } from "./coach-shared";
import { DumbbellLoader } from "./gym-visuals";
import { NumberStepper, RestPicker } from "./form-controls";
import { ExerciseDialog } from "./exercise-dialog";
import {
  useAddExercisesToWorkout,
  useCoachWorkouts,
  useCreateWorkout,
  useDeleteWorkout,
  useExerciseLibrary,
  useRemoveWorkoutExercise,
  useReorderWorkoutExercises,
  useUpdateWorkout,
  useUpdateWorkoutExercise,
  type BuilderWorkoutExercise,
  type CoachWorkout,
} from "@/hooks/use-workouts";
import {
  DEFAULT_REST_SECONDS,
  MAX_SETS,
  MIN_SETS,
  SET_TYPES,
  blankSet,
  startingPrescription,
  copySetToAll,
  duplicateSet,
  formatRest,
  moveItem,
  plannedSets,
  resizeSets,
  type DistanceUnit,
  type LoadMode,
  type LoadSpec,
  type PlannedSet,
  type RepsMode,
  type RepsSpec,
  type SetType,
} from "@/lib/workout-sets";
import {
  BODY_REGIONS,
  DIFFICULTIES,
  EQUIPMENT,
  EXERCISE_TYPES,
  MUSCLES,
  REGION_GROUPS,
  exerciseGroup,
  exerciseRegion,
  isOneOf,
  type BodyRegionKey,
} from "@/lib/taxonomy";
import { exerciseDisplayName } from "@/lib/exercise-names-ar";
import { useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import type { ExerciseRow } from "@/lib/database.types";

const REPS_MODES: RepsMode[] = ["fixed", "range", "amrap", "failure", "none"];
const LOAD_MODES: LoadMode[] = ["kg", "lbs", "pct_1rm", "bodyweight", "none"];
const DISTANCE_UNITS: DistanceUnit[] = ["m", "km", "mi"];

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ============================================================
// New workout
// ============================================================

function NewWorkoutDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const createWorkout = useCreateWorkout();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [rest, setRest] = useState<number | null>(DEFAULT_REST_SECONDS);

  const reset = () => {
    setTitle("");
    setDuration("");
    setDescription("");
    setRest(DEFAULT_REST_SECONDS);
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error(t("validation.workoutNameRequired"));
      return;
    }
    if (duration && !(Number(duration) > 0 && Number(duration) <= 600)) {
      toast.error(t("validation.number"));
      return;
    }
    try {
      const created = await createWorkout.mutateAsync({
        title: title.trim(),
        default_rest_seconds: rest ?? DEFAULT_REST_SECONDS,
        ...(duration ? { duration_minutes: Math.round(Number(duration)) } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success(t("coach.workouts.created"));
      onCreated(created.id);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.createFailed"));
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
        <Button>
          <Plus />
          {t("coach.workouts.newWorkout")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("coach.workouts.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("coach.workouts.name")} htmlFor="workout-name">
              <Input
                id="workout-name"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("coach.workouts.namePlaceholder")}
              />
            </Field>
            <Field label={t("coach.workouts.duration")} htmlFor="workout-duration">
              <Input
                id="workout-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
              />
            </Field>
            <Field label={t("coach.workouts.description")} htmlFor="workout-description">
              <Textarea
                id="workout-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("coach.workouts.descriptionPlaceholder")}
              />
            </Field>
            <RestPicker label={t("builder.defaultRest")} value={rest} onChange={setRest} />
            <p className="text-xs text-muted-foreground">{t("builder.defaultRestHint")}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createWorkout.isPending}>
              {createWorkout.isPending ? t("coach.workouts.creating") : t("coach.workouts.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Library panel: search + filters, add to workout, edit / archive
// ============================================================

type AddableExercise = Pick<
  ExerciseRow,
  | "id"
  | "default_sets"
  | "default_reps"
  | "default_rest_seconds"
  | "default_duration_seconds"
  | "equipment_list"
>;

type RegionTab = BodyRegionKey | "all" | "uncategorized";

function LibraryPanel({
  onAdd,
  adding,
}: {
  /** Adds the exercises to the selected workout; resolves true on success. */
  onAdd: (exercises: AddableExercise[]) => Promise<boolean>;
  adding: boolean;
}) {
  const { t, tp, lang } = useI18n();
  const xn = (name: string) => exerciseDisplayName(name, lang);
  const [region, setRegion] = useState<RegionTab>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const arabicSearch = /[؀-ۿ]/.test(search);
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [archived, setArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: library, isLoading } = useExerciseLibrary({
    // Arabic searches match the translated library names on this side instead of the database.
    search: arabicSearch ? "" : search.trim(),
    muscle,
    equipment,
    type,
    difficulty,
    archived,
  });
  const activeFilters = [muscle, type, difficulty].filter(Boolean).length;

  // Group the (already filtered) exercises: body region -> muscle group.
  const needle = search.trim();
  const items = (library ?? [])
    .filter((ex) => !arabicSearch || xn(ex.name).includes(needle))
    .sort((a, b) => xn(a.name).localeCompare(xn(b.name), lang))
    .map((ex) => ({ ex, region: exerciseRegion(ex) }));
  const regionsWithItems = new Set(items.map((i) => i.region ?? "uncategorized"));
  const tabs: RegionTab[] = [
    "all",
    ...BODY_REGIONS,
    ...(regionsWithItems.has("uncategorized") ? (["uncategorized"] as const) : []),
  ];
  const visibleRegions: (BodyRegionKey | "uncategorized")[] =
    region === "all" ? [...BODY_REGIONS, "uncategorized"] : [region];
  const narrowed = search.trim() !== "" || !!equipment || activeFilters > 0 || region !== "all";
  const byId = new Map(items.map((i) => [i.ex.id, i.ex]));
  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const addSelected = async () => {
    const exercises = selected.map((id) => byId.get(id)).filter((e): e is ExerciseRow => !!e);
    if (exercises.length && (await onAdd(exercises))) setSelected([]);
  };

  const sectionsFor = (r: BodyRegionKey | "uncategorized") => {
    const inRegion = items.filter((i) => (i.region ?? "uncategorized") === r).map((i) => i.ex);
    if (r === "uncategorized" || REGION_GROUPS[r].length === 0) {
      return inRegion.length ? [{ key: "all", exercises: inRegion }] : [];
    }
    return [...REGION_GROUPS[r], "other"]
      .map((g) => ({ key: g, exercises: inRegion.filter((ex) => exerciseGroup(ex, r) === g) }))
      .filter((s) => s.exercises.length > 0);
  };

  const groupLabel = (g: string) =>
    g === "adductors"
      ? t("library.group.adductors")
      : g === "other"
        ? t("library.group.other")
        : isOneOf(MUSCLES, g)
          ? t(`muscle.${g}`)
          : g;
  const regionLabel = (r: RegionTab) =>
    r === "all"
      ? t("library.allRegions")
      : r === "uncategorized"
        ? t("library.uncategorized")
        : t(`bodyRegion.${r}`);

  const row = (ex: ExerciseRow) => {
    const checked = selected.includes(ex.id);
    const equipmentText = ex.equipment_list
      .filter((e) => isOneOf(EQUIPMENT, e))
      .slice(0, 2)
      .map((e) => t(`equipment.${e as (typeof EQUIPMENT)[number]}`))
      .join(", ");
    return (
      <div className={`exercise-option ${checked ? "checked" : ""}`} key={ex.id}>
        <label className="exercise-option-main">
          <input
            type="checkbox"
            className="library-check"
            checked={checked}
            onChange={() => toggle(ex.id)}
            aria-label={t("library.select", { name: xn(ex.name) })}
          />
          <span className="min-w-0 flex-1">
            <b className="block truncate">{xn(ex.name)}</b>
            <small className="block truncate">
              {!ex.is_global && <span className="library-own">{t("library.yours")} · </span>}
              {equipmentText}
            </small>
          </span>
        </label>
        {!ex.is_global && (
          <button
            type="button"
            className="icon-button"
            aria-label={t("exercise.editNamed", { name: ex.name })}
            onClick={() => setEditing(ex)}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="builder-library">
      <div className="search-wrap">
        <Search />
        <Input
          aria-label={t("coach.workouts.searchExercises")}
          placeholder={t("coach.workouts.searchExercises")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <FieldSelect
        className="mt-2"
        aria-label={t("builder.filterEquipment")}
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
      >
        <option value="">{t("builder.anyEquipment")}</option>
        {EQUIPMENT.map((m) => (
          <option key={m} value={m}>
            {t(`equipment.${m}`)}
          </option>
        ))}
      </FieldSelect>
      <div className="library-tools">
        <button
          type="button"
          className={`chip ${showFilters || activeFilters ? "selected" : ""}`}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal aria-hidden="true" />
          {t("builder.filters")}
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </button>
        <button
          type="button"
          className={`chip ${archived ? "selected" : ""}`}
          aria-pressed={archived}
          onClick={() => setArchived((v) => !v)}
        >
          {t("builder.archived")}
        </button>
      </div>
      {showFilters && (
        <div className="library-filters">
          <FieldSelect
            aria-label={t("builder.filterMuscle")}
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            <option value="">{t("builder.anyMuscle")}</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {t(`muscle.${m}`)}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            aria-label={t("builder.filterType")}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">{t("builder.anyType")}</option>
            {EXERCISE_TYPES.map((m) => (
              <option key={m} value={m}>
                {t(`exerciseType.${m}`)}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            aria-label={t("builder.filterDifficulty")}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">{t("builder.anyDifficulty")}</option>
            {DIFFICULTIES.map((m) => (
              <option key={m} value={m}>
                {t(`difficulty.${m}`)}
              </option>
            ))}
          </FieldSelect>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMuscle("");
                setType("");
                setDifficulty("");
              }}
            >
              {t("common.clearFilters")}
            </Button>
          )}
        </div>
      )}
      <p className="eyebrow mt-5">
        {archived ? t("builder.archivedExercises") : t("coach.workouts.exerciseLibrary")}
      </p>
      {isLoading && <DumbbellLoader compact />}
      {!isLoading && (library ?? []).length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          {archived ? t("builder.noArchived") : t("builder.noExercises")}
        </p>
      )}
      {archived &&
        (library ?? []).map((ex) => (
          <div className="exercise-option" key={ex.id}>
            <button
              type="button"
              className="exercise-option-main"
              onClick={() => setEditing(ex)}
              aria-label={t("exercise.editNamed", { name: ex.name })}
            >
              <span className="exercise-option-icon" aria-hidden="true">
                <Pencil size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{ex.name}</b>
              </span>
            </button>
          </div>
        ))}
      {!archived && (
        <>
          <div
            className="chip-group library-regions"
            role="tablist"
            aria-label={t("library.regions")}
          >
            {tabs.map((r) => (
              <button
                type="button"
                role="tab"
                key={r}
                aria-selected={region === r}
                className={`chip ${region === r ? "selected" : ""}`}
                onClick={() => setRegion(r)}
              >
                {regionLabel(r)}
              </button>
            ))}
          </div>
          {visibleRegions.map((r) => {
            const sections = sectionsFor(r);
            if (sections.length === 0) return null;
            const count = sections.reduce((n, s) => n + s.exercises.length, 0);
            // "All": one collapsible block per region with group headings inside.
            if (region === "all") {
              return (
                <details className="library-section" key={`${r}-${narrowed}`} open={narrowed}>
                  <summary>
                    {regionLabel(r)}
                    <span className="library-count">{count}</span>
                  </summary>
                  {sections.map((s) => (
                    <div key={s.key}>
                      {s.key !== "all" && (
                        <p className="library-group-title">{groupLabel(s.key)}</p>
                      )}
                      {s.exercises.map(row)}
                    </div>
                  ))}
                </details>
              );
            }
            // One region: a collapsible block per muscle group.
            return sections.map((s) => (
              <details className="library-section" key={`${r}-${s.key}`} open>
                <summary>
                  {s.key === "all" ? regionLabel(r) : groupLabel(s.key)}
                  <span className="library-count">{s.exercises.length}</span>
                </summary>
                {s.exercises.map(row)}
              </details>
            ));
          })}
        </>
      )}
      {!archived && selected.length > 0 && (
        <div className="library-add-bar" role="region" aria-label={t("library.selection")}>
          <Button className="flex-1" onClick={addSelected} disabled={adding}>
            <Plus />
            {tp("library.addSelected", selected.length)}
          </Button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("library.clear")}
            title={t("library.clear")}
            onClick={() => setSelected([])}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <button type="button" className="exercise-option new" onClick={() => setCreating(true)}>
        <span className="exercise-option-icon" aria-hidden="true">
          <Plus size={16} />
        </span>
        <b>{t("coach.workouts.newExercise")}</b>
      </button>
      <ExerciseDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="library"
        exercise={editing}
      />
      <ExerciseDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        initialName={search.trim()}
        onSaved={(id) =>
          void onAdd([
            {
              id,
              default_sets: null,
              default_reps: null,
              default_rest_seconds: null,
              default_duration_seconds: null,
              equipment_list: [],
            },
          ])
        }
      />
    </aside>
  );
}

// ============================================================
// One set row
// ============================================================

function SetRow({
  set,
  index,
  total,
  exerciseRest,
  onChange,
  onDuplicate,
  onCopyToAll,
  onRemove,
  onMove,
}: {
  set: PlannedSet;
  index: number;
  total: number;
  exerciseRest: number | null;
  onChange: (next: PlannedSet) => void;
  onDuplicate: () => void;
  onCopyToAll: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const { t } = useI18n();
  const controls = useDragControls();
  const [open, setOpen] = useState(
    () =>
      !!(
        set.tempo ||
        set.rpe != null ||
        set.rir != null ||
        set.duration_seconds ||
        set.distance ||
        set.notes
      ),
  );
  const patch = (p: Partial<PlannedSet>) => onChange({ ...set, ...p });

  const setReps = (mode: RepsMode) => {
    const current = set.reps;
    const base =
      current.mode === "fixed" ? current.value : current.mode === "range" ? current.max : 10;
    const next: RepsSpec =
      mode === "fixed"
        ? { mode, value: base }
        : mode === "range"
          ? { mode, min: Math.max(1, base - 2), max: base }
          : { mode };
    patch({ reps: next });
  };
  const setLoad = (mode: LoadMode) => {
    const value = "value" in set.load && set.load.value != null ? set.load.value : 0;
    const next: LoadSpec =
      mode === "none" ? { mode } : mode === "bodyweight" ? { mode, value: null } : { mode, value };
    patch({ load: next });
  };

  return (
    <Reorder.Item
      value={set.id}
      dragListener={false}
      dragControls={controls}
      className={`set-row type-${set.type}`}
      as="li"
    >
      <div className="set-main">
        <button
          type="button"
          className="drag-handle"
          aria-label={t("builder.dragSet")}
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical />
        </button>
        <span className="set-index" aria-label={t("builder.setN", { n: index + 1 })}>
          {set.type === "warmup" ? "W" : index + 1}
        </span>
        <FieldSelect
          aria-label={t("builder.setType")}
          className="set-type"
          value={set.type}
          onChange={(e) => patch({ type: e.target.value as SetType })}
        >
          {SET_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`setType.${type}`)}
            </option>
          ))}
        </FieldSelect>
        <div className="set-field reps">
          <FieldSelect
            aria-label={t("builder.repsMode")}
            value={set.reps.mode}
            onChange={(e) => setReps(e.target.value as RepsMode)}
          >
            {REPS_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`repsMode.${m}`)}
              </option>
            ))}
          </FieldSelect>
          {set.reps.mode === "fixed" && (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              aria-label={t("builder.reps")}
              value={set.reps.value}
              onChange={(e) =>
                patch({ reps: { mode: "fixed", value: Math.max(1, num(e.target.value) ?? 1) } })
              }
            />
          )}
          {set.reps.mode === "range" && (
            <span className="range-inputs" dir="ltr">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label={t("builder.repsMin")}
                value={set.reps.min}
                onChange={(e) =>
                  set.reps.mode === "range" &&
                  patch({ reps: { ...set.reps, min: Math.max(1, num(e.target.value) ?? 1) } })
                }
              />
              <span aria-hidden="true">–</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label={t("builder.repsMax")}
                value={set.reps.max}
                onChange={(e) =>
                  set.reps.mode === "range" &&
                  patch({ reps: { ...set.reps, max: Math.max(1, num(e.target.value) ?? 1) } })
                }
              />
            </span>
          )}
        </div>
        <div className="set-field load">
          <FieldSelect
            aria-label={t("builder.loadMode")}
            value={set.load.mode}
            onChange={(e) => setLoad(e.target.value as LoadMode)}
          >
            {LOAD_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`loadMode.${m}`)}
              </option>
            ))}
          </FieldSelect>
          {set.load.mode !== "none" && (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={set.load.mode === "pct_1rm" ? 1 : 0.5}
              aria-label={
                set.load.mode === "bodyweight" ? t("builder.addedLoad") : t("builder.load")
              }
              placeholder={set.load.mode === "bodyweight" ? "+kg" : ""}
              value={set.load.value ?? ""}
              onChange={(e) => {
                const value = num(e.target.value);
                if (set.load.mode === "bodyweight") patch({ load: { mode: "bodyweight", value } });
                else if (set.load.mode !== "none")
                  patch({ load: { mode: set.load.mode, value: value ?? 0 } });
              }}
            />
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`set-rest ${set.rest_seconds != null ? "custom" : ""}`}
              aria-label={t("builder.restAfterSet", { n: index + 1 })}
            >
              <Timer aria-hidden="true" />
              <span dir="ltr">{formatRest(set.rest_seconds ?? exerciseRest)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(92vw,22rem)]" align="end">
            <RestPicker
              label={t("builder.restAfterSet", { n: index + 1 })}
              value={set.rest_seconds ?? null}
              inheritLabel={t("builder.useExerciseRest")}
              onChange={(v) => patch({ rest_seconds: v })}
            />
          </PopoverContent>
        </Popover>
        <div className="set-actions">
          <button
            type="button"
            className="icon-button"
            aria-expanded={open}
            aria-label={t("builder.setDetails")}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={open ? "rotate-180" : ""} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("builder.duplicateSet")}
            title={t("builder.duplicateSet")}
            disabled={total >= MAX_SETS}
            onClick={onDuplicate}
          >
            <CopyPlus />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("builder.copyToAll")}
            title={t("builder.copyToAll")}
            disabled={total < 2}
            onClick={onCopyToAll}
          >
            <Copy />
          </button>
          <button
            type="button"
            className="icon-button sr-only-focusable"
            aria-label={t("builder.moveSetUp")}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp />
          </button>
          <button
            type="button"
            className="icon-button sr-only-focusable"
            aria-label={t("builder.moveSetDown")}
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("builder.removeSet")}
            title={t("builder.removeSet")}
            disabled={total <= MIN_SETS}
            onClick={onRemove}
          >
            <X />
          </button>
        </div>
      </div>
      {open && (
        <div className="set-details">
          <label>
            <span>{t("builder.tempo")}</span>
            <Input
              dir="ltr"
              maxLength={11}
              placeholder="3-1-1-0"
              value={set.tempo ?? ""}
              onChange={(e) => patch({ tempo: e.target.value.replace(/[^\dxX-]/g, "") || null })}
            />
          </label>
          <label>
            <span>{t("builder.rpe")}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              max={10}
              step={0.5}
              value={set.rpe ?? ""}
              onChange={(e) => {
                const v = num(e.target.value);
                patch({ rpe: v == null ? null : Math.min(10, Math.max(1, v)) });
              }}
            />
          </label>
          <label>
            <span>{t("builder.rir")}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              value={set.rir ?? ""}
              onChange={(e) => {
                const v = num(e.target.value);
                patch({ rir: v == null ? null : Math.min(10, Math.max(0, Math.round(v))) });
              }}
            />
          </label>
          <label>
            <span>{t("builder.durationSec")}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={7200}
              placeholder="60"
              value={set.duration_seconds ?? ""}
              onChange={(e) => {
                const v = num(e.target.value);
                patch({
                  duration_seconds: v == null ? null : Math.min(7200, Math.max(0, Math.round(v))),
                });
              }}
            />
          </label>
          <label className="distance">
            <span>{t("builder.distance")}</span>
            <span className="flex gap-1">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={set.distance?.value ?? ""}
                onChange={(e) => {
                  const v = num(e.target.value);
                  patch({
                    distance:
                      v == null ? null : { value: Math.max(0, v), unit: set.distance?.unit ?? "m" },
                  });
                }}
              />
              <FieldSelect
                aria-label={t("builder.distanceUnit")}
                value={set.distance?.unit ?? "m"}
                onChange={(e) =>
                  patch({
                    distance: {
                      value: set.distance?.value ?? 0,
                      unit: e.target.value as DistanceUnit,
                    },
                  })
                }
              >
                {DISTANCE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t(`distanceUnit.${u}`)}
                  </option>
                ))}
              </FieldSelect>
            </span>
          </label>
          <label className="notes">
            <span>{t("builder.setNotes")}</span>
            <Input
              maxLength={200}
              value={set.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value || null })}
            />
          </label>
        </div>
      )}
    </Reorder.Item>
  );
}

// ============================================================
// One exercise in the sequence (autosaves)
// ============================================================

type ExerciseDraft = {
  sets: PlannedSet[];
  rest_seconds: number | null;
  rest_after_seconds: number | null;
  superset_with_next: boolean;
  notes: string;
};

function draftFromRow(row: BuilderWorkoutExercise): ExerciseDraft {
  return {
    sets: plannedSets(row).map((s) =>
      s.id.startsWith("legacy-") ? { ...s, id: blankSet().id } : s,
    ),
    rest_seconds: row.rest_seconds,
    rest_after_seconds: row.rest_after_seconds,
    superset_with_next: row.superset_with_next,
    notes: row.notes ?? "",
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

function ExerciseCard({
  row,
  index,
  total,
  isLast,
  onMove,
  onDragEnd,
}: {
  row: BuilderWorkoutExercise;
  index: number;
  total: number;
  isLast: boolean;
  onMove: (to: number) => void;
  onDragEnd: () => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const controls = useDragControls();
  const update = useUpdateWorkoutExercise();
  const remove = useRemoveWorkoutExercise();
  const [draft, setDraft] = useState<ExerciseDraft>(() => draftFromRow(row));
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const version = useRef(0);
  const savedVersion = useRef(0);

  // Take server data only when there are no local edits waiting to be saved.
  useEffect(() => {
    if (version.current === savedVersion.current) setDraft(draftFromRow(row));
  }, [row]);

  const change = (patch: Partial<ExerciseDraft>) => {
    version.current += 1;
    setDraft((d) => ({ ...d, ...patch }));
  };

  useEffect(() => {
    if (version.current === savedVersion.current) return;
    const saving = version.current;
    const id = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await update.mutateAsync({
          id: row.id,
          patch: {
            set_plan: draft.sets,
            rest_seconds: draft.rest_seconds,
            rest_after_seconds: draft.rest_after_seconds,
            superset_with_next: draft.superset_with_next,
            notes: draft.notes.trim() || null,
          },
        });
        savedVersion.current = Math.max(savedVersion.current, saving);
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        toast.error(errorText(err, i18n, "coach.workouts.saveFailed"));
      }
    }, 650);
    return () => window.clearTimeout(id);
    // Saves the latest draft after edits settle; `update` is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const exercise = row.exercises;
  const setIds = draft.sets.map((s) => s.id);
  const updateSet = (i: number, next: PlannedSet) =>
    change({ sets: draft.sets.map((s, j) => (j === i ? next : s)) });

  return (
    <Reorder.Item
      value={row.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className={`builder-exercise ${draft.superset_with_next && !isLast ? "linked" : ""}`}
      as="article"
    >
      <header className="builder-exercise-head">
        <button
          type="button"
          className="drag-handle"
          aria-label={t("builder.dragExercise")}
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical />
        </button>
        <b className="index">{String(index + 1).padStart(2, "0")}</b>
        <div className="min-w-0 flex-1">
          <h4 className="truncate">
            {exerciseDisplayName(exercise?.name, i18n.lang) || t("common.exercise")}
          </h4>
          <small>
            {t("builder.summary", {
              sets: draft.sets.length,
              rest: formatRest(draft.rest_seconds),
            })}
            {exercise && !exercise.is_library && (
              <span className="custom-badge">{t("builder.customCopy")}</span>
            )}
          </small>
        </div>
        <span className={`save-state ${saveState}`} aria-live="polite">
          {saveState === "saving"
            ? t("common.saving")
            : saveState === "saved"
              ? t("builder.saved")
              : saveState === "error"
                ? t("builder.saveError")
                : ""}
        </span>
        <div className="builder-exercise-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={t("builder.moveUp")}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("builder.moveDown")}
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("exercise.editNamed", {
              name: exerciseDisplayName(exercise?.name, i18n.lang),
            })}
            disabled={!exercise}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("coach.workouts.removeExercise")}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(row.id, {
                onError: (err) => toast.error(errorText(err, i18n, "coach.workouts.saveFailed")),
              })
            }
          >
            <Trash2 />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-expanded={expanded}
            aria-label={expanded ? t("builder.collapse") : t("builder.expand")}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={expanded ? "rotate-180" : ""} />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="builder-exercise-body">
          <div className="set-toolbar">
            <span className="set-toolbar-label">{t("builder.sets")}</span>
            <NumberStepper
              value={draft.sets.length}
              min={MIN_SETS}
              max={MAX_SETS}
              label={t("builder.setCount")}
              decrementLabel={t("builder.removeSet")}
              incrementLabel={t("builder.addSet")}
              onChange={(n) => change({ sets: resizeSets(draft.sets, n) })}
            />
          </div>
          <div className="set-head" aria-hidden="true">
            <span />
            <span>#</span>
            <span>{t("builder.setType")}</span>
            <span>{t("builder.reps")}</span>
            <span>{t("builder.load")}</span>
            <span>{t("builder.rest")}</span>
            <span />
          </div>
          <Reorder.Group
            axis="y"
            values={setIds}
            onReorder={(ids: string[]) =>
              change({
                sets: ids
                  .map((id) => draft.sets.find((s) => s.id === id))
                  .filter((s): s is PlannedSet => !!s),
              })
            }
            className="set-list"
            as="ol"
          >
            {draft.sets.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                index={i}
                total={draft.sets.length}
                exerciseRest={draft.rest_seconds}
                onChange={(next) => updateSet(i, next)}
                onDuplicate={() => change({ sets: duplicateSet(draft.sets, i) })}
                onCopyToAll={() => {
                  change({ sets: copySetToAll(draft.sets, i) });
                  toast.success(t("builder.copiedToAll", { n: i + 1 }));
                }}
                onRemove={() => change({ sets: draft.sets.filter((_, j) => j !== i) })}
                onMove={(to) => change({ sets: moveItem(draft.sets, i, to) })}
              />
            ))}
          </Reorder.Group>

          <div className="rest-grid">
            <RestPicker
              label={t("builder.restBetweenSets")}
              value={draft.rest_seconds}
              onChange={(v) => change({ rest_seconds: v ?? 0 })}
            />
            {!isLast && (
              <RestPicker
                label={t("builder.restAfterExercise")}
                value={draft.rest_after_seconds}
                inheritLabel={t("builder.sameAsSets")}
                onChange={(v) => change({ rest_after_seconds: v })}
              />
            )}
          </div>
          {!isLast && (
            <label className="superset-toggle">
              <Switch
                checked={draft.superset_with_next}
                onCheckedChange={(v) => change({ superset_with_next: v })}
              />
              <span>
                <b>
                  <Link2 aria-hidden="true" />
                  {t("builder.superset")}
                </b>
                <small>{t("builder.supersetHint")}</small>
              </span>
            </label>
          )}
          <label className="exercise-notes">
            <span>{t("builder.exerciseNotes")}</span>
            <Textarea
              rows={2}
              maxLength={500}
              value={draft.notes}
              onChange={(e) => change({ notes: e.target.value })}
              placeholder={t("builder.exerciseNotesPlaceholder")}
            />
          </label>
        </div>
      )}
      {exercise && (
        <ExerciseDialog
          open={editing}
          onOpenChange={setEditing}
          mode="workout"
          exercise={exercise}
          workoutExerciseId={row.id}
        />
      )}
    </Reorder.Item>
  );
}

// ============================================================
// Page
// ============================================================

function WorkoutSettings({ selected }: { selected: CoachWorkout | null }) {
  const i18n = useI18n();
  const { t } = i18n;
  const updateWorkout = useUpdateWorkout();
  const updateExercise = useUpdateWorkoutExercise();
  const deleteWorkout = useDeleteWorkout();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState<number | null>(DEFAULT_REST_SECONDS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setTitle(selected?.title ?? "");
    setDuration(selected?.duration_minutes ? String(selected.duration_minutes) : "");
    setNotes(selected?.notes ?? "");
    setRest(selected?.default_rest_seconds ?? DEFAULT_REST_SECONDS);
    // Only reset the form when switching which workout is selected, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const assignmentCount = selected?.workout_assignments?.[0]?.count ?? 0;

  const onSave = async () => {
    if (!selected) return;
    if (!title.trim()) {
      toast.error(t("validation.workoutNameRequired"));
      return;
    }
    try {
      await updateWorkout.mutateAsync({
        id: selected.id,
        title: title.trim(),
        duration_minutes: duration ? Math.round(Number(duration)) : null,
        notes,
        default_rest_seconds: rest ?? DEFAULT_REST_SECONDS,
      });
      toast.success(t("coach.workouts.saved"));
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.saveFailed"));
    }
  };

  const applyRestToAll = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await Promise.all(
        selected.workout_exercises.map((e) =>
          updateExercise.mutateAsync({ id: e.id, patch: { rest_seconds: rest ?? 0 } }),
        ),
      );
      toast.success(t("builder.restApplied"));
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.saveFailed"));
    } finally {
      setApplying(false);
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    try {
      await deleteWorkout.mutateAsync(selected.id);
      toast.success(t("coach.workouts.deleted"));
      setConfirmDelete(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.deleteFailed"));
    }
  };

  return (
    <aside className="builder-settings">
      <p className="eyebrow">{t("coach.workouts.settings")}</p>
      <label>
        <span>{t("coach.workouts.workoutTitle")}</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!selected} />
      </label>
      <label>
        <span>{t("coach.workouts.duration")}</span>
        <Input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          disabled={!selected}
        />
      </label>
      <div className="settings-rest">
        <RestPicker label={t("builder.defaultRest")} value={rest} onChange={setRest} />
        <small>{t("builder.defaultRestHint")}</small>
        {selected && selected.workout_exercises.length > 0 && (
          <Button variant="ghost" size="sm" onClick={applyRestToAll} disabled={applying}>
            {t("builder.applyRestToAll")}
          </Button>
        )}
      </div>
      <label>
        <span>{t("coach.workouts.coachNotes")}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!selected} />
      </label>
      <Button
        className="mt-3 w-full"
        variant="outline"
        onClick={onSave}
        disabled={!selected || updateWorkout.isPending}
      >
        {updateWorkout.isPending ? t("common.saving") : t("coach.workouts.saveChanges")}
      </Button>
      {selected && <AssignWorkoutDialog workoutId={selected.id} />}
      {selected && (
        <Button
          className="mt-3 w-full text-destructive hover:text-destructive"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          {t("coach.workouts.deleteWorkout")}
        </Button>
      )}
      {selected && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("coach.workouts.deleteConfirmTitle", { title: selected.title })}
          description={
            <>
              <span className="block">{t("coach.workouts.deleteConfirmBody")}</span>
              {assignmentCount > 0 && (
                <span className="block">
                  {i18n.tp("coach.workouts.deleteConfirmAssignments", assignmentCount)}
                </span>
              )}
            </>
          }
          confirmLabel={t("coach.workouts.deleteWorkout")}
          pending={deleteWorkout.isPending}
          onConfirm={onDelete}
        />
      )}
    </aside>
  );
}

export function Workouts() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const { data: workouts, isLoading } = useCoachWorkouts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const addExercises = useAddExercisesToWorkout();
  const reorder = useReorderWorkoutExercises();

  const selected = workouts?.find((w) => w.id === selectedId) ?? workouts?.[0] ?? null;
  const serverRows = useMemo(
    () => [...(selected?.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index),
    [selected?.workout_exercises],
  );
  const [order, setOrder] = useState<string[]>([]);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setOrder(serverRows.map((r) => r.id));
  }, [serverRows]);
  const rows = order
    .map((id) => serverRows.find((r) => r.id === id))
    .filter((r): r is BuilderWorkoutExercise => !!r);

  const persistOrder = (ids: string[]) => {
    dragging.current = false;
    const current = serverRows.map((r) => r.id).join();
    if (ids.join() === current) return;
    reorder.mutate(ids, {
      onError: (err) => toast.error(errorText(err, i18n, "coach.workouts.saveFailed")),
    });
  };

  // Each exercise starts from its library defaults (or 3 × 8–12 with the workout's default rest);
  // the prescription is copied into this workout, so editing it never changes the library.
  const onAddExercises = async (exercises: AddableExercise[]) => {
    if (!selected) {
      toast.error(t("coach.workouts.createFirst"));
      return false;
    }
    const workoutRest = selected.default_rest_seconds ?? DEFAULT_REST_SECONDS;
    try {
      await addExercises.mutateAsync(
        exercises.map((ex, i) => ({
          workout_id: selected.id,
          exercise_id: ex.id,
          order_index: rows.length + i,
          ...startingPrescription(ex, workoutRest),
        })),
      );
      if (exercises.length > 1) toast.success(tp("library.added", exercises.length));
      return true;
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.addExerciseFailed"));
      return false;
    }
  };

  return (
    <>
      <PageHead
        eyebrow={t("coach.workouts.eyebrow")}
        title={t("coach.workouts.title")}
        subtitle={t("coach.workouts.subtitle")}
        action={<NewWorkoutDialog onCreated={setSelectedId} />}
      />
      {!isLoading && (workouts ?? []).length > 1 && (
        <div className="toolbar">
          <div className="segmented scroll" role="tablist" aria-label={t("builder.workouts")}>
            {(workouts ?? []).map((w) => (
              <button
                key={w.id}
                role="tab"
                aria-selected={selected?.id === w.id}
                className={selected?.id === w.id ? "selected" : ""}
                onClick={() => setSelectedId(w.id)}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="builder">
        <LibraryPanel onAdd={onAddExercises} adding={addExercises.isPending} />
        <section className="builder-canvas">
          {isLoading ? (
            <DumbbellLoader />
          ) : !selected ? (
            <EmptyState icon="dumbbell">{t("coach.workouts.emptyCanvas")}</EmptyState>
          ) : (
            <>
              <div className="workout-cover">
                <img
                  src={battle}
                  width={1600}
                  height={912}
                  loading="lazy"
                  alt={t("coach.workouts.coverAlt")}
                />
                <div>
                  <p className="eyebrow">
                    {selected.duration_minutes
                      ? tp("common.minutes", selected.duration_minutes)
                      : t("coach.workouts.untimed")}
                    {" · "}
                    {t("builder.defaultRestShort", {
                      rest: formatRest(selected.default_rest_seconds),
                    })}
                  </p>
                  <h2>{selected.title}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                <span className="play-button" aria-hidden="true">
                  <Play fill="currentColor" />
                </span>
              </div>
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{t("coach.workouts.trainingSequence")}</h3>
                  <span className="text-xs font-bold text-muted-foreground">
                    {tp("coach.workouts.exerciseCount", rows.length)}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t("coach.workouts.addFromLibrary")}
                  </p>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={order}
                    onReorder={(ids: string[]) => {
                      dragging.current = true;
                      setOrder(ids);
                    }}
                    className="builder-sequence"
                    as="div"
                  >
                    {rows.map((row, i) => (
                      <ExerciseCard
                        key={row.id}
                        row={row}
                        index={i}
                        total={rows.length}
                        isLast={i === rows.length - 1}
                        onDragEnd={() => persistOrder(order)}
                        onMove={(to) => {
                          const next = moveItem(order, i, to);
                          setOrder(next);
                          persistOrder(next);
                        }}
                      />
                    ))}
                  </Reorder.Group>
                )}
              </div>
            </>
          )}
        </section>
        <WorkoutSettings selected={selected} />
      </div>
    </>
  );
}
