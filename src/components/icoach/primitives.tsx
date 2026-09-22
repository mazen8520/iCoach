import { Check, ChevronRight, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export function PageHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head animate-enter">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
export function ProgressBar({ value, thin = false }: { value: number; thin?: boolean }) {
  return (
    <div className={thin ? "progress-track h-1" : "progress-track h-2"}>
      <span className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}
export function ProgressRing({
  value,
  size = 112,
  label = "COMPLETE",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const r = 42,
    c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle className="ring-track" cx="50" cy="50" r={r} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="text-center">
        <b className="font-display text-2xl">{value}%</b>
        <span className="block text-[8px] font-bold tracking-[.16em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
export function Metric({
  label,
  value,
  delta,
  accent = false,
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: boolean;
}) {
  return (
    <div className="metric">
      <p className="eyebrow">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <strong className={`font-display text-4xl ${accent ? "text-primary" : ""}`}>{value}</strong>
        {delta && (
          <span className="flex items-center gap-1 text-xs font-bold text-success">
            <TrendingUp size={13} />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
export function TaskRow({
  title,
  meta,
  done,
  onClick,
  icon,
}: {
  title: string;
  meta: string;
  done: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  return (
    <button onClick={onClick} className={`task-row group ${done ? "task-done" : ""}`}>
      <span className={`task-check ${done ? "checked" : ""}`}>
        {done ? <Check size={15} /> : icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <b className="block truncate text-sm">{title}</b>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </span>
      <ChevronRight
        size={17}
        className="text-muted-foreground transition-transform group-hover:translate-x-1"
      />
    </button>
  );
}
export function SectionTitle({
  overline,
  title,
  action,
}: {
  overline?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      {" "}
      <div>
        {overline && <p className="eyebrow">{overline}</p>}
        <h2 className="font-display text-xl font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
/** Shared "Change password" card for coach and client settings — the only password-change
 *  path in the app, including for athletes whose password was originally set by their coach. */
export function ChangePasswordCard() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Password updated.");
    setPassword("");
    setConfirm("");
  };

  return (
    <section className="settings-panel">
      <p className="eyebrow">Security</p>
      <h2>Change password</h2>
      <p className="text-sm text-muted-foreground">
        Set a new password for signing in — useful if your coach set your original one.
      </p>
      <div className="setting-row">
        <div className="w-full">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            className="mt-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      </div>
      <div className="setting-row">
        <div className="w-full">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            className="mt-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password"
          />
        </div>
      </div>
      <Button className="mt-6" onClick={onSubmit} disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </Button>
    </section>
  );
}
