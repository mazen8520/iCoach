import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Video } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import { PageHead } from "./primitives";
import { ConfirmDialog, Field, FieldSelect } from "./shared";
import { useDisplayName } from "./coach-shared";
import { useCoachRoster } from "@/hooks/use-clients";
import {
  useCoachSchedule,
  useCreateScheduleEvent,
  useDeleteScheduleEvent,
  type ScheduleItem,
} from "@/hooks/use-schedule";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";
import {
  addDays,
  endOfMonth,
  isHttpUrl,
  isoDate,
  parseIsoDate,
  startOfMonth,
  startOfWeek,
} from "@/lib/format";
import type { ScheduleEventType } from "@/lib/database.types";

type View = "day" | "week" | "month";
const VIEWS: View[] = ["day", "week", "month"];
const EVENT_TYPES: ScheduleEventType[] = ["session", "check_in", "reminder", "call", "other"];

// The day/week time grid spans 06:00–22:00, with a label every two hours.
const GRID_START = 6 * 60;
const GRID_END = 22 * 60;
const GRID_SPAN = GRID_END - GRID_START;
const GRID_LABELS = Array.from({ length: 9 }, (_, i) => 6 + i * 2);

function minutesOf(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function rangeFor(view: View, anchor: Date) {
  if (view === "day") {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    return { from: day, to: day, days: [day] };
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    return { from, to: days[6]!, days };
  }
  // Month: whole weeks covering the month, so the grid always starts on Monday.
  const from = startOfWeek(startOfMonth(anchor));
  const last = endOfMonth(anchor);
  const to = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return { from, to, days };
}

/** Side-by-side lanes for overlapping entries within one day. */
function layoutLanes(items: ScheduleItem[]) {
  const laneEnds: number[] = [];
  const placed = items.map((item) => {
    const start = minutesOf(item.start);
    const end = start + Math.max(item.durationMinutes, 30);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { item, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

export function Schedule() {
  const { t, fmt } = useI18n();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { data, isLoading, isError } = useCoachSchedule(isoDate(range.from), isoDate(range.to));
  const items = data ?? [];
  const today = isoDate();

  const shift = (direction: 1 | -1) =>
    setAnchor((current) =>
      view === "day"
        ? addDays(current, direction)
        : view === "week"
          ? addDays(current, 7 * direction)
          : new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );

  const label =
    view === "day"
      ? fmt.date(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
        ? `${fmt.date(range.from, { month: "short", day: "numeric" })} – ${fmt.date(range.to, { month: "short", day: "numeric", year: "numeric" })}`
        : fmt.date(anchor, { month: "long", year: "numeric" });

  const itemsByDay = (date: Date) => items.filter((item) => item.date === isoDate(date));

  return (
    <>
      <PageHead
        eyebrow={fmt.date(anchor, { month: "long", year: "numeric" })}
        title={t("coach.schedule.title")}
        subtitle={t("coach.schedule.subtitle")}
        action={
          <EventDialog
            defaultDate={view === "day" ? isoDate(anchor) : undefined}
            onCreated={(date) => {
              // Bring the new event into view if it falls outside the visible range.
              if (date < isoDate(range.from) || date > isoDate(range.to)) {
                setAnchor(parseIsoDate(date));
              }
            }}
          />
        }
      />
      <div className="toolbar">
        <div className="segmented">
          {VIEWS.map((x) => (
            <button onClick={() => setView(x)} className={view === x ? "selected" : ""} key={x}>
              {t(`coach.schedule.view.${x}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="icon-button"
            onClick={() => shift(-1)}
            aria-label={t("coach.schedule.previous")}
          >
            <ChevronLeft size={16} />
          </button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>
            <CalendarDays />
            {t("common.today")}
          </Button>
          <button
            className="icon-button"
            onClick={() => shift(1)}
            aria-label={t("coach.schedule.next")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <b className="calendar-range-label">{label}</b>
      </div>
      {isError && <p className="mb-4 text-sm text-destructive">{t("coach.schedule.loadFailed")}</p>}

      {view === "month" ? (
        <div className="month-view">
          {range.days.slice(0, 7).map((d) => (
            <span className="month-view-label" key={`label-${isoDate(d)}`}>
              {fmt.weekday(d)}
            </span>
          ))}
          {range.days.map((day) => {
            const key = isoDate(day);
            const dayItems = itemsByDay(day);
            const outside = day.getMonth() !== anchor.getMonth();
            return (
              <div
                key={key}
                className={`month-cell ${outside ? "outside" : ""} ${key === today ? "today" : ""}`}
              >
                <button
                  className="month-cell-date"
                  onClick={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                >
                  {day.getDate()}
                </button>
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.key}
                    className={`month-chip ${item.kind}`}
                    onClick={() => setSelected(item)}
                  >
                    <span>{item.start}</span> <ItemTitle item={item} />
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <button
                    className="month-more"
                    onClick={() => {
                      setAnchor(day);
                      setView("day");
                    }}
                  >
                    {t("coach.schedule.moreCount", { count: dayItems.length - 3 })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="calendar-grid" style={{ ["--cal-days" as string]: range.days.length }}>
          <div className="calendar-times">
            <div className="calendar-head" />
            <div className="calendar-body">
              {GRID_LABELS.map((hour) => (
                <span
                  key={hour}
                  style={{ top: `${((hour * 60 - GRID_START) / GRID_SPAN) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          {range.days.map((date) => {
            const key = isoDate(date);
            const { placed, lanes } = layoutLanes(itemsByDay(date));
            return (
              <div className="calendar-day" key={key}>
                <div className="calendar-head">
                  <small>{fmt.weekday(date)}</small>
                  <b className={key === today ? "today" : ""}>{date.getDate()}</b>
                </div>
                <div className="calendar-body">
                  {placed.map(({ item, lane }) => {
                    const start = minutesOf(item.start);
                    const top = Math.min(96, Math.max(0, ((start - GRID_START) / GRID_SPAN) * 100));
                    const height = Math.max(
                      4,
                      Math.min(100 - top, (item.durationMinutes / GRID_SPAN) * 100),
                    );
                    const width = 90 / lanes;
                    return (
                      <button
                        key={item.key}
                        className={`cal-event ${item.kind}`}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          insetInlineStart: `${5 + lane * width}%`,
                          width: `${width}%`,
                        }}
                        onClick={() => setSelected(item)}
                      >
                        <small>
                          {item.kind === "event" && item.eventType
                            ? t(`eventType.${item.eventType}`)
                            : t(`scheduleKind.${item.kind}`)}{" "}
                          · {item.start}
                        </small>
                        <b>
                          <ItemTitle item={item} />
                        </b>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{t("coach.schedule.noEvents")}</p>
      )}
      <ScheduleItemDialog item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ItemTitle({ item }: { item: ScheduleItem }) {
  const { t } = useI18n();
  const title =
    item.title || (item.kind === "training" ? t("common.workout") : t("coach.event.untitled"));
  return <>{item.clientName ? `${item.clientName} · ${title}` : title}</>;
}

function ScheduleItemDialog({ item, onClose }: { item: ScheduleItem | null; onClose: () => void }) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const deleteEvent = useDeleteScheduleEvent();
  const [confirming, setConfirming] = useState(false);
  if (!item) return null;

  const onDelete = async () => {
    try {
      await deleteEvent.mutateAsync(item.id);
      toast.success(t("coach.event.deleted"));
      setConfirming(false);
      onClose();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.event.deleteFailed"));
    }
  };

  const kindLabel =
    item.kind === "event" && item.eventType
      ? t(`eventType.${item.eventType}`)
      : t(`scheduleKind.${item.kind}`);
  const title =
    item.title || (item.kind === "training" ? t("common.workout") : t("coach.event.untitled"));
  const rows: [string, ReactNode][] = [
    [
      t("coach.event.when"),
      `${fmt.date(parseIsoDate(item.date), { weekday: "long", month: "short", day: "numeric" })} · ${t("common.timeRange", { start: item.start, end: item.end })}`,
    ],
    [t("coach.event.type"), kindLabel],
  ];
  if (item.clientName) rows.push([t("coach.event.client"), item.clientName]);
  if (item.status) {
    rows.push([
      t("meeting.status"),
      t(
        `${item.kind === "meeting" ? "meetingStatus" : "assignment"}.${item.status}` as TranslationKey,
      ),
    ]);
  }

  return (
    <>
      <Dialog open={!confirming} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <dl className="detail-list">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {item.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
          )}
          <DialogFooter>
            {item.kind === "event" && (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <Trash2 />
                {t("coach.event.delete")}
              </Button>
            )}
            {item.clientId && (
              <Link to="/coach/clients/$id" params={{ id: item.clientId }}>
                <Button variant="outline" className="w-full">
                  {t("coach.event.openClient")}
                </Button>
              </Link>
            )}
            {item.kind === "meeting" &&
              (isHttpUrl(item.videoUrl) && item.status === "scheduled" ? (
                <a href={item.videoUrl} target="_blank" rel="noreferrer">
                  <Button className="w-full">
                    <Video />
                    {t("meeting.join")}
                  </Button>
                </a>
              ) : (
                <Link to="/coach/meetings">
                  <Button className="w-full">{t("coach.event.openMeetings")}</Button>
                </Link>
              ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("coach.event.deleteConfirmTitle")}
        description={t("coach.event.deleteConfirmBody", { title })}
        confirmLabel={t("coach.event.delete")}
        pending={deleteEvent.isPending}
        onConfirm={onDelete}
      />
    </>
  );
}

function nextFullHour() {
  const hour = Math.min(new Date().getHours() + 1, 22);
  return `${String(hour).padStart(2, "0")}:00`;
}

function plusOneHour(clock: string) {
  const minutes = Math.min(minutesOf(clock) + 60, 23 * 60 + 59);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "New event" modal: creates a real schedule_events row owned by this coach, optionally tied to
 *  one of their athletes (who then also sees it on their own calendar). */
export function EventDialog({
  clientId,
  defaultDate,
  onCreated,
  trigger,
}: {
  clientId?: string;
  defaultDate?: string | undefined;
  onCreated?: (date: string) => void;
  trigger?: ReactNode;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const displayName = useDisplayName();
  const { data: roster } = useCoachRoster();
  const createEvent = useCreateScheduleEvent();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate ?? isoDate());
  const [start, setStart] = useState(nextFullHour);
  const [end, setEnd] = useState(() => plusOneHour(nextFullHour()));
  const [type, setType] = useState<ScheduleEventType>("session");
  const [pickedClient, setPickedClient] = useState(clientId ?? "");
  const [description, setDescription] = useState("");

  const reset = () => {
    const startTime = nextFullHour();
    setTitle("");
    setDate(defaultDate ?? isoDate());
    setStart(startTime);
    setEnd(plusOneHour(startTime));
    setType("session");
    setPickedClient(clientId ?? "");
    setDescription("");
  };

  const onSubmit = async () => {
    if (!title.trim()) {
      toast.error(t("validation.titleRequired"));
      return;
    }
    if (!date) {
      toast.error(t("validation.dateRequired"));
      return;
    }
    const startsAt = new Date(`${date}T${start}`);
    const endsAt = new Date(`${date}T${end}`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      toast.error(t("validation.dateTimeRequired"));
      return;
    }
    if (endsAt <= startsAt) {
      toast.error(t("errors.endBeforeStart"));
      return;
    }
    try {
      await createEvent.mutateAsync({
        title: title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        event_type: type,
        client_id: pickedClient || null,
        description: description.trim() || null,
      });
      toast.success(t("coach.event.created"));
      onCreated?.(date);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorText(err, i18n, "coach.event.failed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            {t("coach.schedule.newEvent")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("coach.event.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("coach.event.fieldTitle")} htmlFor="event-title">
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("coach.event.titlePlaceholder")}
            />
          </Field>
          <Field label={t("coach.event.date")} htmlFor="event-date">
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("coach.event.start")} htmlFor="event-start">
              <Input
                id="event-start"
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (e.target.value && minutesOf(e.target.value) >= minutesOf(end)) {
                    setEnd(plusOneHour(e.target.value));
                  }
                }}
              />
            </Field>
            <Field label={t("coach.event.end")} htmlFor="event-end">
              <Input
                id="event-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("coach.event.type")} htmlFor="event-type">
              <FieldSelect
                id="event-type"
                value={type}
                onChange={(e) => setType(e.target.value as ScheduleEventType)}
              >
                {EVENT_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`eventType.${x}`)}
                  </option>
                ))}
              </FieldSelect>
            </Field>
            {!clientId && (
              <Field label={t("coach.event.client")} htmlFor="event-client">
                <FieldSelect
                  id="event-client"
                  value={pickedClient}
                  onChange={(e) => setPickedClient(e.target.value)}
                >
                  <option value="">{t("coach.event.noClient")}</option>
                  {(roster ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {displayName(c.name)}
                    </option>
                  ))}
                </FieldSelect>
              </Field>
            )}
          </div>
          <Field label={t("coach.event.description")} htmlFor="event-description">
            <Textarea
              id="event-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("coach.event.descriptionPlaceholder")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createEvent.isPending}>
            {createEvent.isPending ? t("common.saving") : t("coach.event.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
