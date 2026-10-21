import { Archive, ArchiveRestore, ImagePlus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldSelect } from "./shared";
import { ChipMultiSelect } from "./form-controls";
import {
  useArchiveExercise,
  useCreateExercise,
  useDeleteExercise,
  useExerciseLibrary,
  useExercisesByIds,
  useExerciseUsage,
  useSaveExerciseForWorkoutOnly,
  useUpdateExercise,
  useUploadExerciseImage,
  type ExerciseInput,
} from "@/hooks/use-workouts";
import {
  BODY_REGIONS,
  DIFFICULTIES,
  EQUIPMENT,
  EXERCISE_TYPES,
  MUSCLES,
  isOneOf,
  type BodyRegionKey,
  type Equipment,
  type Muscle,
} from "@/lib/taxonomy";
import { isHttpUrl } from "@/lib/format";
import { exerciseDisplayName } from "@/lib/exercise-names-ar";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import type { ExerciseDifficulty, ExerciseRow } from "@/lib/database.types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Draft = {
  name: string;
  description: string;
  instructions: string;
  cues: string;
  common_mistakes: string;
  primary_muscles: Muscle[];
  secondary_muscles: Muscle[];
  equipment_list: Equipment[];
  difficulty: ExerciseDifficulty | "";
  exercise_type: string;
  body_region: BodyRegionKey | "";
  video_url: string;
  image_url: string;
  alternative_ids: string[];
};

function draftFrom(exercise: ExerciseRow | null | undefined, name = ""): Draft {
  return {
    name: exercise?.name ?? name,
    description: exercise?.description ?? "",
    instructions: exercise?.instructions ?? "",
    cues: exercise?.cues ?? "",
    common_mistakes: exercise?.common_mistakes ?? "",
    primary_muscles: (exercise?.primary_muscles ?? []).filter((m): m is Muscle =>
      isOneOf(MUSCLES, m),
    ),
    secondary_muscles: (exercise?.secondary_muscles ?? []).filter((m): m is Muscle =>
      isOneOf(MUSCLES, m),
    ),
    equipment_list: (exercise?.equipment_list ?? []).filter((e): e is Equipment =>
      isOneOf(EQUIPMENT, e),
    ),
    difficulty: exercise?.difficulty ?? "",
    exercise_type: exercise?.exercise_type ?? "",
    body_region: isOneOf(BODY_REGIONS, exercise?.body_region) ? exercise.body_region : "",
    video_url: exercise?.video_url ?? "",
    image_url: exercise?.image_url ?? "",
    alternative_ids: exercise?.alternative_ids ?? [],
  };
}

function toInput(d: Draft): ExerciseInput {
  const text = (v: string) => v.trim() || null;
  return {
    name: d.name.trim(),
    description: text(d.description),
    instructions: text(d.instructions),
    cues: text(d.cues),
    common_mistakes: text(d.common_mistakes),
    primary_muscles: d.primary_muscles,
    secondary_muscles: d.secondary_muscles.filter((m) => !d.primary_muscles.includes(m)),
    equipment_list: d.equipment_list,
    difficulty: d.difficulty || null,
    exercise_type: d.exercise_type || null,
    body_region: d.body_region || null,
    video_url: text(d.video_url),
    image_url: text(d.image_url),
    alternative_ids: d.alternative_ids,
  };
}

/**
 * Create or edit an exercise.
 * - mode "create": adds a library exercise (onSaved gets its id).
 * - mode "library": edits the library exercise; warns how many workouts use it; archive/delete.
 * - mode "workout": edits from inside a workout and asks whether the change applies to this
 *   workout only (a private copy) or to the library exercise everywhere.
 */
export function ExerciseDialog({
  open,
  onOpenChange,
  mode,
  exercise,
  workoutExerciseId,
  initialName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "library" | "workout";
  exercise?: ExerciseRow | null | undefined;
  workoutExerciseId?: string | undefined;
  initialName?: string | undefined;
  onSaved?: ((exerciseId: string) => void) | undefined;
}) {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(exercise, initialName));
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [altSearch, setAltSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = `${exercise?.id ?? "new"}:${open}`;
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setDraft(draftFrom(exercise, initialName));
    setConfirmDelete(false);
    setAltSearch("");
  }

  const create = useCreateExercise();
  const update = useUpdateExercise();
  const workoutOnly = useSaveExerciseForWorkoutOnly();
  const archive = useArchiveExercise();
  const remove = useDeleteExercise();
  const upload = useUploadExerciseImage();
  const libraryId = exercise?.is_library ? exercise.id : exercise?.source_exercise_id;
  const { data: usage } = useExerciseUsage(mode === "create" ? null : libraryId);
  // Built-in library exercises are read-only: edits from a workout are only ever saved for that
  // workout (also when this is already a private copy of a built-in exercise).
  const { data: sourceRows } = useExercisesByIds(
    exercise && !exercise.is_library && exercise.source_exercise_id
      ? [exercise.source_exercise_id]
      : [],
  );
  const libraryLocked = !!exercise?.is_global || !!sourceRows?.[0]?.is_global;
  const { data: library } = useExerciseLibrary({ search: altSearch.trim() });
  const { data: chosenAlternatives } = useExercisesByIds(draft.alternative_ids);
  const pending = create.isPending || update.isPending || workoutOnly.isPending;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const validate = (): ExerciseInput | null => {
    if (!draft.name.trim()) {
      toast.error(t("validation.exerciseNameRequired"));
      return null;
    }
    if (draft.video_url.trim() && !isHttpUrl(draft.video_url.trim())) {
      toast.error(t("exercise.videoUrlInvalid"));
      return null;
    }
    return toInput(draft);
  };

  const done = (id: string, message: TranslationKey) => {
    toast.success(t(message));
    onSaved?.(id);
    onOpenChange(false);
  };

  const onCreate = async () => {
    const input = validate();
    if (!input) return;
    try {
      const created = await create.mutateAsync(input);
      done(created.id, "coach.workouts.exerciseAdded");
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.exerciseFailed"));
    }
  };

  const onUpdateLibrary = async () => {
    const input = validate();
    if (!input || !exercise || libraryLocked) return;
    try {
      // From inside a workout that already uses a private copy, "update library" writes the
      // original library exercise (and leaves this workout's copy as it is).
      const targetId = exercise.is_library
        ? exercise.id
        : (exercise.source_exercise_id ?? exercise.id);
      await update.mutateAsync({ id: targetId, patch: input });
      done(targetId, "exercise.libraryUpdated");
    } catch (err) {
      toast.error(errorText(err, i18n, "exercise.saveFailed"));
    }
  };

  const onWorkoutOnly = async () => {
    const input = validate();
    if (!input || !exercise || !workoutExerciseId) return;
    try {
      await workoutOnly.mutateAsync({ workoutExerciseId, source: exercise, patch: input });
      done(exercise.id, "exercise.workoutOnlySaved");
    } catch (err) {
      toast.error(errorText(err, i18n, "exercise.saveFailed"));
    }
  };

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("exercise.imageType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("exercise.imageSize"));
      return;
    }
    try {
      set("image_url", await upload.mutateAsync(file));
    } catch (err) {
      toast.error(errorText(err, i18n, "exercise.imageFailed"));
    }
  };

  const onArchive = async (archived: boolean) => {
    if (!exercise) return;
    try {
      await archive.mutateAsync({ id: exercise.id, archived });
      toast.success(t(archived ? "exercise.archived" : "exercise.restored"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "exercise.saveFailed"));
    }
  };

  const onDelete = async () => {
    if (!exercise) return;
    try {
      await remove.mutateAsync(exercise.id);
      toast.success(t("exercise.deleted"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "exercise.saveFailed"));
    }
  };

  const altOptions = useMemo(
    () => (library ?? []).filter((e) => e.id !== exercise?.id && e.id !== libraryId),
    [library, exercise?.id, libraryId],
  );
  const altNames = new Map(
    [...(chosenAlternatives ?? []), ...(library ?? [])].map((e) => [
      e.id,
      exerciseDisplayName(e.name, i18n.lang),
    ]),
  );
  const usageCount = usage ?? 0;
  const steps = draft.instructions.split("\n").filter((s) => s.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exercise-dialog max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("exercise.createTitle") : t("exercise.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "workout"
              ? t("exercise.workoutContext")
              : mode === "library" && usageCount > 0
                ? tp("exercise.usedIn", usageCount)
                : t("exercise.libraryContext")}
          </DialogDescription>
        </DialogHeader>

        <div className="exercise-form">
          <Field label={t("coach.workouts.exerciseName")} htmlFor="exd-name">
            <Input
              id="exd-name"
              value={draft.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("coach.workouts.exerciseNamePlaceholder")}
            />
          </Field>
          <Field label={t("exercise.description")} htmlFor="exd-description">
            <Textarea
              id="exd-description"
              rows={2}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("exercise.descriptionPlaceholder")}
            />
          </Field>
          <Field
            label={t("exercise.instructions")}
            htmlFor="exd-steps"
            hint={t("exercise.instructionsHint")}
          >
            <Textarea
              id="exd-steps"
              rows={4}
              value={draft.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder={t("exercise.instructionsPlaceholder")}
            />
          </Field>
          {steps.length > 1 && (
            <ol className="step-preview">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("exercise.cues")} htmlFor="exd-cues">
              <Textarea
                id="exd-cues"
                rows={3}
                value={draft.cues}
                onChange={(e) => set("cues", e.target.value)}
                placeholder={t("exercise.cuesPlaceholder")}
              />
            </Field>
            <Field label={t("exercise.mistakes")} htmlFor="exd-mistakes">
              <Textarea
                id="exd-mistakes"
                rows={3}
                value={draft.common_mistakes}
                onChange={(e) => set("common_mistakes", e.target.value)}
                placeholder={t("exercise.mistakesPlaceholder")}
              />
            </Field>
          </div>

          <FormBlock title={t("exercise.primaryMuscles")}>
            <ChipMultiSelect
              label={t("exercise.primaryMuscles")}
              options={MUSCLES}
              value={draft.primary_muscles}
              onChange={(v) => set("primary_muscles", v)}
              labelFor={(m) => t(`muscle.${m}`)}
            />
          </FormBlock>
          <FormBlock title={t("exercise.secondaryMuscles")}>
            <ChipMultiSelect
              label={t("exercise.secondaryMuscles")}
              options={MUSCLES.filter((m) => !draft.primary_muscles.includes(m))}
              value={draft.secondary_muscles}
              onChange={(v) => set("secondary_muscles", v)}
              labelFor={(m) => t(`muscle.${m}`)}
            />
          </FormBlock>
          <FormBlock title={t("exercise.equipment")}>
            <ChipMultiSelect
              label={t("exercise.equipment")}
              options={EQUIPMENT}
              value={draft.equipment_list}
              onChange={(v) => set("equipment_list", v)}
              labelFor={(e) => t(`equipment.${e}`)}
            />
          </FormBlock>
          <div className="grid gap-3 md:grid-cols-2">
            <FormBlock title={t("exercise.difficulty")}>
              <ChipMultiSelect
                single
                label={t("exercise.difficulty")}
                options={DIFFICULTIES}
                value={draft.difficulty ? [draft.difficulty] : []}
                onChange={(v) => set("difficulty", v[0] ?? "")}
                labelFor={(d) => t(`difficulty.${d}`)}
              />
            </FormBlock>
            <Field
              label={t("exercise.bodyRegion")}
              htmlFor="exd-region"
              hint={t("exercise.bodyRegionHint")}
            >
              <FieldSelect
                id="exd-region"
                value={draft.body_region}
                onChange={(e) => set("body_region", e.target.value as BodyRegionKey | "")}
              >
                <option value="">{t("exercise.bodyRegionAuto")}</option>
                {BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`bodyRegion.${r}`)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
            <Field label={t("exercise.type")} htmlFor="exd-type">
              <FieldSelect
                id="exd-type"
                value={draft.exercise_type}
                onChange={(e) => set("exercise_type", e.target.value)}
              >
                <option value="">{t("exercise.typeNone")}</option>
                {EXERCISE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`exerciseType.${type}`)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label={t("exercise.videoUrl")}
              htmlFor="exd-video"
              hint={t("exercise.videoHint")}
            >
              <Input
                id="exd-video"
                type="url"
                dir="ltr"
                value={draft.video_url}
                onChange={(e) => set("video_url", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </Field>
            <FormBlock title={t("exercise.image")}>
              <div className="image-field">
                {draft.image_url ? (
                  <>
                    <img src={draft.image_url} alt="" width={96} height={64} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set("image_url", "")}
                    >
                      <X />
                      {t("exercise.removeImage")}
                    </Button>
                  </>
                ) : (
                  <label className="upload-drop">
                    <ImagePlus aria-hidden="true" />
                    <span>
                      {upload.isPending ? t("exercise.uploading") : t("exercise.uploadImage")}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={upload.isPending}
                      onChange={(e) => onImage(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            </FormBlock>
          </div>

          <FormBlock title={t("exercise.alternatives")}>
            {draft.alternative_ids.length > 0 && (
              <div className="chip-group mb-2">
                {draft.alternative_ids.map((id) => (
                  <span key={id} className="chip selected static">
                    {altNames.get(id) ?? t("common.exercise")}
                    <button
                      type="button"
                      aria-label={t("exercise.removeAlternative")}
                      onClick={() =>
                        set(
                          "alternative_ids",
                          draft.alternative_ids.filter((x) => x !== id),
                        )
                      }
                    >
                      <X />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="search-wrap compact">
              <Search />
              <Input
                aria-label={t("exercise.findAlternative")}
                placeholder={t("exercise.findAlternative")}
                value={altSearch}
                onChange={(e) => setAltSearch(e.target.value)}
              />
            </div>
            <div className="alt-options">
              {altOptions
                .filter((e) => !draft.alternative_ids.includes(e.id))
                .slice(0, 8)
                .map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className="chip"
                    onClick={() => set("alternative_ids", [...draft.alternative_ids, e.id])}
                  >
                    + {exerciseDisplayName(e.name, i18n.lang)}
                  </button>
                ))}
            </div>
          </FormBlock>
        </div>

        {mode === "library" && exercise && (
          <div className="danger-zone">
            {exercise.archived_at ? (
              <Button
                variant="outline"
                onClick={() => onArchive(false)}
                disabled={archive.isPending}
              >
                <ArchiveRestore />
                {t("exercise.restore")}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => onArchive(true)}
                disabled={archive.isPending}
              >
                <Archive />
                {t("exercise.archive")}
              </Button>
            )}
            {usageCount === 0 ? (
              confirmDelete ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {t("exercise.deleteConfirm")}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    disabled={remove.isPending}
                  >
                    {t("common.delete")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    {t("common.cancel")}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                  {t("common.delete")}
                </Button>
              )
            ) : (
              <small className="text-muted-foreground">{t("exercise.deleteBlocked")}</small>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {mode === "create" && (
            <Button onClick={onCreate} disabled={pending}>
              {pending ? t("coach.workouts.adding") : t("coach.workouts.addToLibrary")}
            </Button>
          )}
          {mode === "library" && (
            <Button onClick={onUpdateLibrary} disabled={pending}>
              {pending ? t("common.saving") : t("exercise.saveLibrary")}
            </Button>
          )}
          {mode === "workout" && (
            <div className="scope-choice">
              <p>{t("exercise.scopeQuestion")}</p>
              <div>
                <Button onClick={onWorkoutOnly} disabled={pending}>
                  {t("exercise.applyWorkoutOnly")}
                </Button>
                {!libraryLocked && (
                  <Button variant="outline" onClick={onUpdateLibrary} disabled={pending}>
                    {t("exercise.applyLibrary")}
                  </Button>
                )}
              </div>
              <small>
                {libraryLocked
                  ? t("library.lockedHint")
                  : usageCount > 1
                    ? tp("exercise.libraryAffects", usageCount)
                    : t("exercise.libraryAffectsOne")}
              </small>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="form-block">
      <span className="form-block-title">{title}</span>
      {children}
    </div>
  );
}
