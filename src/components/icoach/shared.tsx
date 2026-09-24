import { Copy, ExternalLink, Video } from "lucide-react";
import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import { isHttpUrl } from "@/lib/format";
import type { MeetingRow } from "@/lib/database.types";
import {
  useCancelMeeting,
  useEditMeeting,
  useStartMeeting,
  useUpdateMeeting,
} from "@/hooks/use-meetings";
import {
  MEETING_DURATIONS,
  emptyMeetingDraft,
  isMeetingLive,
  meetingDraftFrom,
  useMeetingDraftInput,
  type MeetingDraft,
} from "@/lib/meeting-draft";

/** Native <select> styled like the app's inputs (used across dialogs and toolbars). */
export function FieldSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm ${className}`}
      {...props}
    />
  );
}

/** Label + control stack used by every form dialog. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============================================================
// In-app video player
// ============================================================

/** YouTube/Vimeo links play through their embeddable player; anything else (Supabase Storage
 *  uploads) plays in a native <video> element with the browser's full control set. */
function embedUrlFor(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}?autoplay=1&rel=0`;
    }
    if (host.endsWith("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ?? parsed.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type PlayableVideo = { title: string; url: string; subtitle?: string };

export function VideoPlayerDialog({
  video,
  onClose,
}: {
  video: PlayableVideo | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [video?.url]);
  const safeUrl = video && isHttpUrl(video.url) ? video.url : null;
  const embed = safeUrl ? embedUrlFor(safeUrl) : null;

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="video-dialog gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="px-5 py-4 pe-12">
          <DialogTitle className="truncate">{video?.title}</DialogTitle>
          {video?.subtitle && (
            <p className="text-xs font-bold uppercase text-muted-foreground">{video.subtitle}</p>
          )}
        </DialogHeader>
        <div className="video-stage">
          {!safeUrl || failed ? (
            <div className="video-stage-message">
              <p>{t("video.playerError")}</p>
              {safeUrl && (
                <a href={safeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> {t("video.openFile")}
                </a>
              )}
            </div>
          ) : embed ? (
            <iframe
              src={embed}
              title={video?.title ?? ""}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              key={safeUrl}
              src={safeUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              controlsList="nodownload"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Confirmation dialog
// ============================================================

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the dialog before the async delete finishes. */}
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (pendingLabel ?? t("common.deleting")) : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// Meeting form fields (schedule + edit)
// ============================================================

export function MeetingFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: MeetingDraft;
  onChange: (draft: MeetingDraft) => void;
  idPrefix: string;
}) {
  const { t, tp } = useI18n();
  const set = (patch: Partial<MeetingDraft>) => onChange({ ...draft, ...patch });
  const current = Number(draft.duration);
  const durations = MEETING_DURATIONS.includes(current)
    ? MEETING_DURATIONS
    : [...MEETING_DURATIONS, current].sort((a, b) => a - b);
  return (
    <>
      <Field label={t("coach.meetings.meetingTitle")} htmlFor={`${idPrefix}-title`}>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          maxLength={200}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t("coach.meetings.titlePlaceholder")}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <Field label={t("coach.meetings.dateTime")} htmlFor={`${idPrefix}-time`}>
          <Input
            id={`${idPrefix}-time`}
            type="datetime-local"
            value={draft.datetime}
            onChange={(e) => set({ datetime: e.target.value })}
          />
        </Field>
        <Field label={t("coach.meetings.duration")} htmlFor={`${idPrefix}-duration`}>
          <FieldSelect
            id={`${idPrefix}-duration`}
            value={draft.duration}
            onChange={(e) => set({ duration: e.target.value })}
          >
            {durations.map((d) => (
              <option key={d} value={d}>
                {tp("common.minutes", d)}
              </option>
            ))}
          </FieldSelect>
        </Field>
      </div>
      <Field label={t("coach.meetings.notes")} htmlFor={`${idPrefix}-notes`}>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={3}
          maxLength={2000}
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder={t("coach.meetings.notesPlaceholder")}
        />
      </Field>
    </>
  );
}

// ============================================================
// Start a Zoom meeting as host (coach)
// ============================================================

export function StartMeetingButton({
  meetingId,
  iconOnly = false,
  className,
}: {
  meetingId: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const start = useStartMeeting();
  const onClick = () =>
    start.mutate(meetingId, {
      onError: (err) => toast.error(errorText(err, i18n, "meeting.startFailed")),
    });
  if (iconOnly) {
    return (
      <button
        type="button"
        className={className ?? "icon-button"}
        onClick={onClick}
        disabled={start.isPending}
        aria-label={t("meeting.start")}
        title={t("meeting.start")}
      >
        <Video size={16} />
      </button>
    );
  }
  return (
    <Button className={className} onClick={onClick} disabled={start.isPending}>
      <Video />
      {start.isPending ? t("meeting.starting") : t("meeting.start")}
    </Button>
  );
}

// ============================================================
// Meeting details (coach: start/edit/cancel; athlete: join)
// ============================================================

export function MeetingDetailsDialog({
  meeting,
  otherName,
  canEdit,
  onClose,
}: {
  meeting: MeetingRow | null;
  otherName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const updateMeeting = useUpdateMeeting();
  const editMeeting = useEditMeeting();
  const cancelMeeting = useCancelMeeting();
  const toInput = useMeetingDraftInput();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-cancel">("view");
  const [draft, setDraft] = useState<MeetingDraft>(emptyMeetingDraft);
  const [editingLink, setEditingLink] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    setMode("view");
    setEditingLink(false);
    setLink(meeting?.video_url ?? "");
  }, [meeting?.id, meeting?.video_url]);

  if (!meeting) return null;
  const zoomLink = isHttpUrl(meeting.video_url) ? meeting.video_url : null;
  const onZoom = !!meeting.zoom_meeting_id;
  const scheduled = meeting.status === "scheduled";

  const markCompleted = async () => {
    try {
      await updateMeeting.mutateAsync({ id: meeting.id, status: "completed" });
      toast.success(t("meeting.updated"));
      onClose();
    } catch (err) {
      toast.error(errorText(err, i18n, "meeting.updateFailed"));
    }
  };

  // Hand-typed links, for meetings created before Zoom was connected.
  const saveLink = async () => {
    const value = link.trim();
    if (value && !isHttpUrl(value)) {
      toast.error(t("validation.zoomLink"));
      return;
    }
    try {
      await updateMeeting.mutateAsync({ id: meeting.id, video_url: value || null });
      toast.success(t("meeting.linkSaved"));
      setEditingLink(false);
    } catch (err) {
      toast.error(errorText(err, i18n, "meeting.updateFailed"));
    }
  };

  const saveEdit = async () => {
    const input = toInput(draft);
    if (!input) return;
    try {
      await editMeeting.mutateAsync({ ...input, meetingId: meeting.id });
      toast.success(t("meeting.rescheduled"));
      setMode("view");
    } catch (err) {
      toast.error(errorText(err, i18n, "meeting.updateFailed"));
    }
  };

  const confirmCancel = async () => {
    try {
      const { zoomSynced } = await cancelMeeting.mutateAsync(meeting.id);
      if (zoomSynced) toast.success(t("meeting.cancelled"));
      else toast.warning(t("meeting.cancelledNotSynced"));
      onClose();
    } catch (err) {
      setMode("view");
      toast.error(errorText(err, i18n, "meeting.updateFailed"));
    }
  };

  const copyLink = async () => {
    if (!zoomLink) return;
    try {
      await navigator.clipboard.writeText(zoomLink);
      toast.success(t("meeting.linkCopied"));
    } catch {
      toast.error(t("coach.addClient.copyFailed"));
    }
  };

  const rows: [string, ReactNode][] = [
    [t("meeting.with"), otherName],
    [
      t("meeting.when"),
      `${fmt.date(meeting.scheduled_at, { weekday: "long", month: "short", day: "numeric" })} · ${fmt.clock(meeting.scheduled_at)}`,
    ],
    [t("meeting.duration"), i18n.tp("common.minutes", meeting.duration_minutes)],
    [
      t("meeting.status"),
      isMeetingLive(meeting) ? t("meeting.live") : t(`meetingStatus.${meeting.status}`),
    ],
  ];
  if (meeting.zoom_passcode && scheduled) {
    rows.push([t("meeting.passcode"), <span dir="ltr">{meeting.zoom_passcode}</span>]);
  }

  return (
    <>
      <Dialog open={mode !== "confirm-cancel"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? t("meeting.edit") : meeting.title}</DialogTitle>
          </DialogHeader>
          {mode === "edit" ? (
            <>
              <div className="space-y-3">
                <MeetingFields draft={draft} onChange={setDraft} idPrefix="edit-meeting" />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setMode("view")}
                  disabled={editMeeting.isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={saveEdit} disabled={editMeeting.isPending}>
                  {editMeeting.isPending ? t("common.saving") : t("meeting.saveChanges")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <dl className="detail-list">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-2">
                <p className="eyebrow">{t("meeting.zoomLink")}</p>
                {editingLink ? (
                  <div className="flex gap-2">
                    <Input
                      dir="ltr"
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder={t("coach.meetings.zoomPlaceholder")}
                    />
                    <Button onClick={saveLink} disabled={updateMeeting.isPending}>
                      {t("meeting.saveLink")}
                    </Button>
                  </div>
                ) : zoomLink ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={zoomLink}
                      target="_blank"
                      rel="noreferrer"
                      className="zoom-link"
                      dir="ltr"
                      title={zoomLink}
                    >
                      {zoomLink}
                    </a>
                    <Button variant="outline" size="sm" onClick={copyLink}>
                      <Copy /> {t("meeting.copyLink")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {canEdit ? t("meeting.noZoomLink") : t("meeting.linkPending")}
                  </p>
                )}
                {canEdit && onZoom && scheduled && (
                  <p className="text-xs text-muted-foreground">{t("meeting.hostedOnZoom")}</p>
                )}
                {canEdit && !onZoom && scheduled && !editingLink && (
                  <button
                    type="button"
                    className="text-xs font-bold text-primary"
                    onClick={() => setEditingLink(true)}
                  >
                    {t("meeting.editLink")}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <p className="eyebrow">{t("meeting.notes")}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {meeting.notes || t("meeting.noNotes")}
                </p>
              </div>
              <DialogFooter>
                {canEdit && scheduled && (
                  <>
                    <Button variant="outline" onClick={() => setMode("confirm-cancel")}>
                      {t("meeting.cancelMeeting")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft(meetingDraftFrom(meeting));
                        setMode("edit");
                      }}
                    >
                      {t("meeting.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={updateMeeting.isPending}
                      onClick={markCompleted}
                    >
                      {t("meeting.markCompleted")}
                    </Button>
                  </>
                )}
                {scheduled &&
                  (canEdit && onZoom ? (
                    <StartMeetingButton meetingId={meeting.id} className="w-full" />
                  ) : zoomLink ? (
                    <a href={zoomLink} target="_blank" rel="noreferrer">
                      <Button className="w-full">
                        <Video /> {t("meeting.join")}
                      </Button>
                    </a>
                  ) : null)}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={mode === "confirm-cancel"}
        onOpenChange={(open) => !open && setMode("view")}
        title={t("meeting.cancelConfirmTitle")}
        description={t("meeting.cancelConfirmBody", { title: meeting.title })}
        confirmLabel={t("meeting.cancelMeeting")}
        pendingLabel={t("common.saving")}
        cancelLabel={t("meeting.keep")}
        pending={cancelMeeting.isPending}
        onConfirm={confirmCancel}
      />
    </>
  );
}
