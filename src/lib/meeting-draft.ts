import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { dateTimeLocal } from "@/lib/format";
import type { MeetingRow } from "@/lib/database.types";
import type { MeetingFormInput } from "@/hooks/use-meetings";

export const MEETING_DURATIONS = [15, 30, 40, 45, 60, 90];

/** Form state of the schedule / edit meeting fields. */
export type MeetingDraft = { title: string; datetime: string; duration: string; notes: string };

export function emptyMeetingDraft(): MeetingDraft {
  return { title: "", datetime: "", duration: "30", notes: "" };
}

export function meetingDraftFrom(meeting: MeetingRow): MeetingDraft {
  return {
    title: meeting.title,
    datetime: dateTimeLocal(meeting.scheduled_at),
    duration: String(meeting.duration_minutes),
    notes: meeting.notes ?? "",
  };
}

/** Validates the draft (toasting the first problem) and converts it for the server. */
export function useMeetingDraftInput() {
  const { t } = useI18n();
  return (draft: MeetingDraft): MeetingFormInput | null => {
    if (!draft.title.trim()) {
      toast.error(t("validation.titleRequired"));
      return null;
    }
    const when = draft.datetime ? new Date(draft.datetime) : null;
    if (!when || Number.isNaN(when.getTime())) {
      toast.error(t("validation.dateTimeRequired"));
      return null;
    }
    return {
      title: draft.title.trim(),
      scheduledAt: when.toISOString(),
      durationMinutes: Number(draft.duration),
      notes: draft.notes.trim() || null,
    };
  };
}

/** A Zoom meeting the host has started and not yet ended. */
export function isMeetingLive(
  meeting: Pick<MeetingRow, "status" | "zoom_started_at" | "zoom_ended_at">,
) {
  return meeting.status === "scheduled" && !!meeting.zoom_started_at && !meeting.zoom_ended_at;
}
