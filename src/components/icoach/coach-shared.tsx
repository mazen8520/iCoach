import { Check, Plus, Video } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldSelect, MeetingFields } from "./shared";
import { emptyMeetingDraft, useMeetingDraftInput, type MeetingDraft } from "@/lib/meeting-draft";
import { useCoachRoster } from "@/hooks/use-clients";
import { useAssignWorkout, useCoachWorkouts } from "@/hooks/use-workouts";
import { useScheduleMeeting } from "@/hooks/use-meetings";
import { useConnectZoom, useZoomStatus } from "@/hooks/use-zoom";
import { useReviewCheckIn } from "@/hooks/use-check-ins";
import { useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import { initialsFromName, isoDate } from "@/lib/format";
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
// Schedule a meeting (creates its Zoom meeting on the coach's account)
// ============================================================

/** Shown wherever a coach needs Zoom connected before they can schedule. */
export function ConnectZoomPrompt() {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: zoom } = useZoomStatus();
  const connect = useConnectZoom();
  return (
    <div className="space-y-2 rounded-md border border-border p-4">
      <b className="block text-sm">{t("zoom.connectFirstTitle")}</b>
      <p className="text-sm text-muted-foreground">{t("zoom.connectFirstBody")}</p>
      {zoom?.configured === false ? (
        <p className="text-sm text-destructive">{t("zoom.notConfigured")}</p>
      ) : (
        <Button
          variant="outline"
          disabled={connect.isPending}
          onClick={() =>
            connect.mutate(undefined, {
              onError: (err) => toast.error(errorText(err, i18n, "zoom.connectFailed")),
            })
          }
        >
          <Video />
          {connect.isPending ? t("zoom.connecting") : t("zoom.connect")}
        </Button>
      )}
    </div>
  );
}

export function ScheduleMeetingDialog({
  clientId,
  trigger,
}: {
  clientId?: string;
  trigger?: ReactNode;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickedClient, setPickedClient] = useState("");
  const [draft, setDraft] = useState<MeetingDraft>(emptyMeetingDraft);
  const { data: roster } = useCoachRoster();
  const { data: zoom, isLoading: zoomLoading } = useZoomStatus();
  const schedule = useScheduleMeeting();
  const toInput = useMeetingDraftInput();
  const targetClient = clientId ?? pickedClient;
  const connected = !!zoom?.connected;

  const reset = () => {
    setPickedClient("");
    setDraft(emptyMeetingDraft());
  };

  const onSubmit = async () => {
    if (!targetClient) {
      toast.error(t("validation.clientRequired"));
      return;
    }
    const input = toInput(draft);
    if (!input) return;
    try {
      await schedule.mutateAsync({ ...input, clientId: targetClient });
      toast.success(t("coach.meetings.scheduled"));
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.meetings.failed"));
      // A revoked connection has been removed server-side: show the connect prompt.
      queryClient.invalidateQueries({ queryKey: ["zoom-status"] });
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
        {zoomLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !connected ? (
          <ConnectZoomPrompt />
        ) : (
          <>
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
              <MeetingFields draft={draft} onChange={setDraft} idPrefix="meeting" />
              <p className="text-xs text-muted-foreground">
                {t("zoom.autoLink", { email: zoom?.email ?? "Zoom" })}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onSubmit} disabled={schedule.isPending}>
                {schedule.isPending ? t("coach.meetings.submitting") : t("coach.meetings.submit")}
              </Button>
            </DialogFooter>
          </>
        )}
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
