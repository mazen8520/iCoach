import { Link, Navigate, useRouterState } from "@tanstack/react-router";
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
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/use-notifications";
import { initialsFromName, timeAgo } from "@/lib/format";

const coachNav = [
  ["/coach/dashboard", "Overview", LayoutDashboard],
  ["/coach/clients", "Clients", UsersRound],
  ["/coach/schedule", "Schedule", CalendarDays],
  ["/coach/workouts", "Workouts", Dumbbell],
  ["/coach/videos", "Videos", PlaySquare],
  ["/coach/nutrition", "Nutrition", Salad],
  ["/coach/messages", "Messages", MessageSquare],
  ["/coach/meetings", "Meetings", Video],
  ["/coach/progress", "Progress", TrendingUp],
  ["/coach/check-ins", "Check-ins", ClipboardCheck],
  ["/coach/settings", "Settings", Settings],
] as const;
const clientNav = [
  ["/client/dashboard", "Home", LayoutDashboard],
  ["/client/today", "Today", CheckCircle2],
  ["/client/week", "Week", CalendarDays],
  ["/client/workouts", "Train", Dumbbell],
  ["/client/nutrition", "Nutrition", Salad],
  ["/client/progress", "Progress", TrendingUp],
  ["/client/calendar", "Calendar", CalendarDays],
  ["/client/messages", "Coach", MessageSquare],
  ["/client/meetings", "Meetings", Video],
  ["/client/check-ins", "Check-ins", ClipboardCheck],
  ["/client/settings", "Settings", Settings],
] as const;

export function AppShell({ role, children }: { role: "coach" | "client"; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "coach" ? coachNav : clientNav;
  const [notices, setNotices] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const mobile = role === "coach" ? coachNav.slice(0, 4) : clientNav.slice(0, 4);
  const more = nav.slice(4);
  const { user, profile, loading, signOut } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading iCoach...
      </div>
    );
  }
  if (!user) return <Navigate to="/sign-in" />;
  if (profile && profile.role !== role) {
    return <Navigate to={profile.role === "coach" ? "/coach/dashboard" : "/client/dashboard"} />;
  }

  const initials = initialsFromName(profile?.full_name);
  const unreadMessages = notifications.filter((n) => n.type === "message" && !n.read_at).length;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-20 items-center px-6">
          <Link to="/">
            <Brand />
          </Link>
        </div>
        <div className="px-5 pb-5">
          <div className="role-pill">
            <span className="status-dot" />
            {role === "coach" ? "Coach workspace" : "Athlete mode"}
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map(([to, label, Icon]) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${path.startsWith(to) ? "nav-active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Messages" && unreadMessages > 0 && (
                <b className="nav-count">{unreadMessages}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 p-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="avatar-sm">{initials}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-foreground">
                {profile?.full_name || "Your account"}
              </b>
              <span className="flex items-center gap-1">
                <LogOut size={12} /> Sign out
              </span>
            </span>
          </button>
        </div>
      </aside>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:left-60 lg:px-8">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="hidden text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground lg:block">
          {role === "coach" ? "Performance command" : "Your performance plan"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="icon-button relative"
            aria-label="Notifications"
            onClick={() => setNotices(!notices)}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
          <span className="avatar-sm">{initials}</span>
        </div>
      </header>
      {notices && (
        <div className="fixed right-4 top-20 z-50 w-[min(390px,calc(100vw-2rem))] panel-elevated animate-slide-in">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="eyebrow">Live feed</p>
              <h3 className="text-base font-bold">Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button className="text-xs font-bold text-primary" onClick={() => markAllRead()}>
                  Mark all read
                </button>
              )}
              <button className="icon-button" onClick={() => setNotices(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing yet. You're all caught up.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read_at && markRead(n.id)}
                className="flex w-full gap-3 p-4 text-left"
              >
                <span className={!n.read_at ? "activity-icon active" : "activity-icon"}>
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <main className="min-h-screen min-w-0 overflow-x-clip pt-16 lg:pl-60">
        <div key={path} className="page-wrap page-transition">
          {children}
        </div>
      </main>
      {moreOpen && (
        <div className="mobile-more lg:hidden" role="dialog" aria-label="More navigation">
          <button
            className="mobile-more-backdrop"
            onClick={() => setMoreOpen(false)}
            aria-label="Close navigation"
          />
          <div className="mobile-more-panel">
            <div className="mobile-more-head">
              <div>
                <p className="eyebrow">Navigation</p>
                <b>More</b>
              </div>
              <button className="icon-button" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <nav className="mobile-more-grid">
              {more.map(([to, label, Icon]) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={path.startsWith(to) ? "active" : ""}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        {mobile.map(([to, label, Icon]) => (
          <Link
            key={to}
            to={to}
            className={`mobile-nav ${path.startsWith(to) ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          className={`mobile-nav ${moreOpen || more.some(([to]) => path.startsWith(to)) ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-label="More navigation"
        >
          <MoreHorizontal size={19} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
