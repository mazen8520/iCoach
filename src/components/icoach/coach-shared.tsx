import { Check, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldSelect } from "./shared";
import { useCoachRoster } from "@/hooks/use-clients";
import { useAssignWorkout, useCoachWorkouts } from "@/hooks/use-workouts";
import { useScheduleMeeting } from "@/hooks/use-meetings";
import { useReviewCheckIn } from "@/hooks/use-check-ins";
import { useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import { initialsFromName, isHttpUrl, isoDate } from "@/lib/format";
import type { CheckInRow, WorkoutStatus } from "@/lib/database.types";

/** Display name for an athlete whose profile may not have a name yet. */
export function useDisplayName() {
  const { t } = useI18n();
  return (name: string | null | undefined) => name?.trim() || t("common.unnamedAthlete");
}

/** "missed" is derived: still scheduled but the day has passed. */
export function assignmentState(status: WorkoutStatus, date: string) {
  return status === "scheduled" && date < isoDate() ? "missed" : status;
}

// ============================================================
// Assign a workout to an athlete
// ============================================================

export function AssignWorkoutDialog({
  workoutId,
  clientId,
  trigger,
}: {
  /** Fixed workout (Workout studio) — otherwise the coach picks one. */
  workoutId?: string;
  /** Fixed athlete (athlete profile) — otherwise the coach picks one. */
  clientId?: string;
  trigger?: ReactNode;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const [open, setOpen] = useState(false);
  const [pickedClient, setPickedClient] = useState("");
  const [pickedWorkout, setPickedWorkout] = useState("");
  const [date, setDate] = useState(isoDate());
  const [time, setTime] = useState("");
  const { data: roster } = useCoachRoster();
  const { data: workouts } = useCoachWorkouts();
  const assign = useAssignWorkout();

  const targetClient = clientId ?? pickedClient;
  const targetWorkout = workoutId ?? pickedWorkout;

  const onSubmit = async () => {
    if (!targetClient) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    if (!targetWorkout) {
      toast.error(t("validation.workoutRequired"));
      return;
    }
    if (!date) {
      toast.error(t("validation.dateRequired"));
      return;
    }
    try {
      await assign.mutateAsync({
        workout_id: targetWorkout,
        client_id: targetClient,
        scheduled_date: date,
        ...(time ? { scheduled_time: time } : {}),
      });
      toast.success(t("coach.workouts.assigned"));
      setOpen(false);
      setTime("");
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.workouts.assignFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="mt-3 w-full">
            <Check />
            {t("coach.workouts.saveAssign")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("coach.workouts.assignTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!clientId && (
            <Field label={t("coach.workouts.client")} htmlFor="assign-client">
              <FieldSelect
                id="assign-client"
                value={pickedClient}
                onChange={(e) => setPickedClient(e.target.value)}
              >
                <option value="">{t("coach.workouts.selectClient")}</option>
                {(roster ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c.name)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          )}
          {!workoutId && (
            <Field label={t("coach.workouts.workout")} htmlFor="assign-workout">
              {(workouts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("coach.workouts.noWorkouts")}</p>
              ) : (
                <FieldSelect
                  id="assign-workout"
                  value={pickedWorkout}
                  onChange={(e) => setPickedWorkout(e.target.value)}
                >
                  <option value="">{t("coach.workouts.selectWorkout")}</option>
                  {(workouts ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </FieldSelect>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("coach.workouts.date")} htmlFor="assign-date">
              <Input
                id="assign-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label={t("coach.workouts.time")} htmlFor="assign-time">
              <Input
                id="assign-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={assign.isPending}>
            {assign.isPending ? t("coach.workouts.assigning") : t("coach.workouts.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Schedule a meeting (with its Zoom link)
// ============================================================

const DURATIONS = [15, 30, 45, 60, 90];

export function ScheduleMeetingDialog({
  clientId,
  trigger,
}: {
  clientId?: string;
  trigger?: ReactNode;
}) {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const displayName = useDisplayName();
  const [open, setOpen] = useState(false);
  const [pickedClient, setPickedClient] = useState("");
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState("30");
  const [zoomLink, setZoomLink] = useState("");
  const [notes, setNotes] = useState("");
  const { data: roster } = useCoachRoster();
  const schedule = useScheduleMeeting();
  const targetClient = clientId ?? pickedClient;

  const reset = () => {
    setPickedClient("");
    setTitle("");
    setDatetime("");
    setDuration("30");
    setZoomLink("");
    setNotes("");
  };

  const onSubmit = async () => {
    if (!targetClient) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("validation.titleRequired"));
      return;
    }
    if (!datetime) {
      toast.error(t("validation.dateTimeRequired"));
      return;
    }
    const link = zoomLink.trim();
    if (link && !isHttpUrl(link)) {
      toast.error(t("validation.zoomLink"));
      return;
    }
    try {
      await schedule.mutateAsync({
        client_id: targetClient,
        title: title.trim(),
        scheduled_at: new Date(datetime).toISOString(),
        duration_minutes: Number(duration),
        video_url: link || null,
        notes: notes.trim() || null,
      });
      toast.success(t("coach.meetings.scheduled"));
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.meetings.failed"));
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
        {trigger ?? (
          <Button>
            <Plus />
            {t("coach.meetings.schedule")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("coach.meetings.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!clientId && (
            <Field label={t("coach.meetings.client")} htmlFor="meeting-client">
              <FieldSelect
                id="meeting-client"
                value={pickedClient}
                onChange={(e) => setPickedClient(e.target.value)}
              >
                <option value="">{t("coach.meetings.selectClient")}</option>
                {(roster ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c.name)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          )}
          <Field label={t("coach.meetings.meetingTitle")} htmlFor="meeting-title">
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("coach.meetings.titlePlaceholder")}
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <Field label={t("coach.meetings.dateTime")} htmlFor="meeting-time">
              <Input
                id="meeting-time"
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
              />
            </Field>
            <Field label={t("coach.meetings.duration")} htmlFor="meeting-duration">
              <FieldSelect
                id="meeting-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {tp("common.minutes", d)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
          </div>
          <Field
            label={t("coach.meetings.zoomLink")}
            htmlFor="meeting-zoom"
            hint={t("coach.meetings.zoomHint")}
          >
            <Input
              id="meeting-zoom"
              type="url"
              dir="ltr"
              inputMode="url"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder={t("coach.meetings.zoomPlaceholder")}
            />
          </Field>
          <Field label={t("coach.meetings.notes")} htmlFor="meeting-notes">
            <Textarea
              id="meeting-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("coach.meetings.notesPlaceholder")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={schedule.isPending}>
            {schedule.isPending ? t("coach.meetings.submitting") : t("coach.meetings.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Check-in card (Check-ins page + athlete profile)
// ============================================================

export function CheckInCard({
  checkIn,
  athleteName,
  showAthlete = true,
}: {
  checkIn: CheckInRow;
  athleteName: string;
  showAthlete?: boolean;
}) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const reviewCheckIn = useReviewCheckIn();
  const [feedback, setFeedback] = useState("");

  const submitFeedback = async () => {
    try {
      await reviewCheckIn.mutateAsync({ id: checkIn.id, feedback: feedback.trim() });
      toast.success(t("coach.checkins.feedbackSent"));
      setFeedback("");
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.checkins.feedbackFailed"));
    }
  };

  return (
    <article className="checkin-card">
      <header>
        {showAthlete && <span className="avatar-md">{initialsFromName(athleteName)}</span>}
        <div>
          <b>
            {showAthlete
              ? athleteName
              : t("coach.checkins.weekOf", {
                  date: fmt.date(`${checkIn.week_start_date}T00:00:00`, {
                    month: "short",
                    day: "numeric",
                  }),
                })}
          </b>
          <p>{fmt.timeAgo(checkIn.submitted_at)}</p>
        </div>
        <span className={checkIn.status === "pending" ? "status attention" : "status on-track"}>
          {checkIn.status === "pending" ? t("coach.checkins.review") : t("coach.checkins.reviewed")}
        </span>
      </header>
      <div className="signal-grid">
        <div>
          <small>{t("signal.energy")}</small>
          <b>{checkIn.energy ?? "—"}</b>
        </div>
        <div>
          <small>{t("signal.sleep")}</small>
          <b>
            {checkIn.sleep_hours != null
              ? t("signal.sleepHours", { value: checkIn.sleep_hours })
              : checkIn.sleep_quality
                ? t(`sleep.${checkIn.sleep_quality}`)
                : "—"}
          </b>
        </div>
        <div>
          <small>{checkIn.weight_kg != null ? t("signal.weight") : t("signal.mood")}</small>
          <b>
            {checkIn.weight_kg != null
              ? t("common.kgValue", { value: checkIn.weight_kg })
              : (checkIn.mood ?? "—")}
          </b>
        </div>
      </div>
      {checkIn.training_feedback && (
        <p className="checkin-note">&ldquo;{checkIn.training_feedback}&rdquo;</p>
      )}
      {checkIn.status === "pending" ? (
        <div className="mt-2 space-y-2">
          <Input
            placeholder={t("coach.checkins.feedbackPlaceholder")}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={submitFeedback}
            disabled={reviewCheckIn.isPending}
          >
            {t("coach.checkins.sendFeedback")}
          </Button>
        </div>
      ) : (
        checkIn.coach_feedback && (
          <p className="text-sm text-muted-foreground">
            {t("coach.checkins.yourReply", { text: checkIn.coach_feedback })}
          </p>
        )
      )}
    </article>
  );
}
