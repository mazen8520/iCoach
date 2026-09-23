import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  PlaySquare,
  Salad,
  Settings,
  TrendingUp,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { dashboardPath } from "@/lib/account";
import { useNotifications } from "@/hooks/use-notifications";
import { initialsFromName } from "@/lib/format";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { NotificationRow } from "@/lib/database.types";

const coachNav = [
  ["/coach/dashboard", "nav.overview", LayoutDashboard],
  ["/coach/clients", "nav.clients", UsersRound],
  ["/coach/schedule", "nav.schedule", CalendarDays],
  ["/coach/workouts", "nav.workouts", Dumbbell],
  ["/coach/videos", "nav.videos", PlaySquare],
  ["/coach/nutrition", "nav.nutrition", Salad],
  ["/coach/messages", "nav.messages", MessageSquare],
  ["/coach/meetings", "nav.meetings", Video],
  ["/coach/progress", "nav.progress", TrendingUp],
  ["/coach/check-ins", "nav.checkIns", ClipboardCheck],
  ["/coach/settings", "nav.settings", Settings],
] as const satisfies readonly (readonly [string, TranslationKey, unknown])[];
const clientNav = [
  ["/client/dashboard", "nav.home", LayoutDashboard],
  ["/client/today", "nav.today", CheckCircle2],
  ["/client/week", "nav.week", CalendarDays],
  ["/client/workouts", "nav.train", Dumbbell],
  ["/client/nutrition", "nav.nutrition", Salad],
  ["/client/progress", "nav.progress", TrendingUp],
  ["/client/calendar", "nav.calendar", CalendarDays],
  ["/client/messages", "nav.coach", MessageSquare],
  ["/client/meetings", "nav.meetings", Video],
  ["/client/check-ins", "nav.checkIns", ClipboardCheck],
  ["/client/settings", "nav.settings", Settings],
] as const satisfies readonly (readonly [string, TranslationKey, unknown])[];

/** A notification rendered in the viewer's language from its structured metadata, falling back
 *  to the stored English title for rows created before metadata existed. */
function useNotificationTitle() {
  const { t } = useI18n();
  return (n: NotificationRow) => {
    const meta = n.metadata ?? {};
    const name = meta["actor_name"];
    switch (n.type) {
      case "message":
        return name !== undefined
          ? t("notif.message", { name: name || t("notif.someone") })
          : n.title;
      case "check_in":
        return name !== undefined
          ? t("notif.checkIn", { name: name || t("notif.aClient") })
          : n.title;
      case "workout_completed":
        return name !== undefined
          ? t("notif.workoutCompleted", {
              name: name || t("notif.aClient"),
              workout: meta["workout_title"] || t("notif.aWorkout"),
            })
          : n.title;
      case "meeting":
        return meta["meeting_title"]
          ? t("notif.meeting", { title: meta["meeting_title"] })
          : n.title;
      case "event":
        return meta["event_title"] ? t("notif.event", { title: meta["event_title"] }) : n.title;
      default:
        return n.title;
    }
  };
}

/** Wraps every coach/athlete page. Access is decided from the CURRENT Supabase session and that
 *  user's role as stored in the database — never from the route they came from or cached state —
 *  and nothing protected renders until that role is confirmed to match this area. */
export function AppShell({ role, children }: { role: "coach" | "client"; children: ReactNode }) {
  const { t, fmt } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const nav = role === "coach" ? coachNav : clientNav;
  const [notices, setNotices] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const mobile = nav.slice(0, 4);
  const more = nav.slice(4);
  const { user, profile, profileError, loading, mustChangePassword, signOut } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const notificationTitle = useNotificationTitle();

  const handleSignOut = async () => {
    setSigningOut(true);
    setMoreOpen(false);
    setNotices(false);
    await signOut();
    // Replace the history entry so "back" can't return to this account's dashboard.
    navigate({ to: "/sign-in", replace: true });
  };

  if (signingOut) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        {t("common.signingOut")}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        {t("shell.loading")}
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate to="/sign-in" search={{ as: role === "coach" ? "coach" : "athlete" }} replace />
    );
  }
  if (mustChangePassword) return <Navigate to="/reset-password" replace />;
  if (profileError || !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">{t("shell.profileErrorTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("shell.profileErrorBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>{t("common.tryAgain")}</Button>
            <Button variant="outline" onClick={handleSignOut}>
              {t("common.signOut")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (profile.role !== role) return <Navigate to={dashboardPath(profile.role)} replace />;

  const initials = initialsFromName(profile.full_name);
  const displayName = profile.full_name || t("common.yourAccount");
  const roleLabel = t(role === "coach" ? "shell.coachWorkspace" : "shell.athleteMode");
  const unreadMessages = notifications.filter((n) => n.type === "message" && !n.read_at).length;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 border-e border-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-20 items-center px-6">
          <Link to="/">
            <Brand />
          </Link>
        </div>
        <div className="px-5 pb-5">
          <div className="role-pill">
            <span className="status-dot" />
            {roleLabel}
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map(([to, labelKey, Icon]) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${path.startsWith(to) ? "nav-active" : ""}`}
            >
              <Icon size={18} />
              <span>{t(labelKey)}</span>
              {labelKey === "nav.messages" && unreadMessages > 0 && (
                <b className="nav-count">{unreadMessages}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 p-2 text-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="avatar-sm">{initials}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-foreground">{displayName}</b>
              <span className="flex items-center gap-1">
                <LogOut size={12} /> {t("common.signOut")}
              </span>
            </span>
          </button>
        </div>
      </aside>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:start-60 lg:px-8">
        <div className="lg:hidden">
          <Link to="/">
            <Brand />
          </Link>
        </div>
        <div className="hidden text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground lg:block">
          {t(role === "coach" ? "shell.coachTagline" : "shell.athleteTagline")}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <button
            className="icon-button relative"
            aria-label={t("shell.notifications")}
            onClick={() => setNotices(!notices)}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
          {/* On phones the avatar opens the sheet with the account + Sign out. */}
          <button
            type="button"
            className="avatar-sm lg:pointer-events-none"
            title={displayName}
            aria-label={t("shell.account")}
            onClick={() => setMoreOpen(true)}
          >
            {initials}
          </button>
        </div>
      </header>
      {notices && (
        <div className="fixed end-4 top-20 z-50 w-[min(390px,calc(100vw-2rem))] panel-elevated animate-slide-in">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="eyebrow">{t("shell.liveFeed")}</p>
              <h3 className="text-base font-bold">{t("shell.notifications")}</h3>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button className="text-xs font-bold text-primary" onClick={() => markAllRead()}>
                  {t("shell.markAllRead")}
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => setNotices(false)}
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t("shell.noNotifications")}
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read_at && markRead(n.id)}
                className="flex w-full gap-3 p-4 text-start"
              >
                <span className={!n.read_at ? "activity-icon active" : "activity-icon"}>
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{notificationTitle(n)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmt.timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <main className="min-h-screen min-w-0 overflow-x-clip pt-16 lg:ps-60">
        <div key={path} className="page-wrap page-transition">
          {children}
        </div>
      </main>
      {moreOpen && (
        <div className="mobile-more lg:hidden" role="dialog" aria-label={t("shell.moreNavigation")}>
          <button
            className="mobile-more-backdrop"
            onClick={() => setMoreOpen(false)}
            aria-label={t("shell.closeNavigation")}
          />
          <div className="mobile-more-panel">
            <div className="mobile-more-head">
              <div>
                <p className="eyebrow">{t("shell.navigation")}</p>
                <b>{t("shell.more")}</b>
              </div>
              <button
                className="icon-button"
                onClick={() => setMoreOpen(false)}
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            </div>
            <nav className="mobile-more-grid">
              {more.map(([to, labelKey, Icon]) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={path.startsWith(to) ? "active" : ""}
                >
                  <Icon size={20} />
                  <span>{t(labelKey)}</span>
                </Link>
              ))}
            </nav>
            <div className="mobile-more-account">
              <span className="avatar-sm">{initials}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{displayName}</b>
                <small>{roleLabel}</small>
              </span>
              <button type="button" className="mobile-signout" onClick={handleSignOut}>
                <LogOut size={17} />
                <span>{t("common.signOut")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        {mobile.map(([to, labelKey, Icon]) => (
          <Link
            key={to}
            to={to}
            className={`mobile-nav ${path.startsWith(to) ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon size={19} />
            <span>{t(labelKey)}</span>
          </Link>
        ))}
        <button
          className={`mobile-nav ${moreOpen || more.some(([to]) => path.startsWith(to)) ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-label={t("shell.moreNavigation")}
        >
          <MoreHorizontal size={19} />
          <span>{t("shell.more")}</span>
        </button>
      </nav>
    </div>
  );
}
