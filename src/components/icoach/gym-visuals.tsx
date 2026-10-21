// Small gym-themed illustrations used across both portals: the loading dumbbell, empty-state
// equipment, the dashboard header pulse and the completion celebration. Pure SVG + CSS
// (transform/opacity keyframes in styles.css under "Gym visuals"), all switched off by
// prefers-reduced-motion, so the portals don't pay for an animation library.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

export function DumbbellGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={`dumbbell-glyph ${className}`} aria-hidden="true">
      <rect className="glyph-bar" x="15" y="14" width="34" height="4" rx="2" />
      <rect className="glyph-cap" x="2" y="12" width="4" height="8" rx="1" />
      <rect className="glyph-plate" x="6" y="5" width="6" height="22" rx="1.5" />
      <rect className="glyph-plate-inner" x="12" y="9" width="4" height="14" rx="1" />
      <rect className="glyph-plate-inner" x="48" y="9" width="4" height="14" rx="1" />
      <rect className="glyph-plate" x="52" y="5" width="6" height="22" rx="1.5" />
      <rect className="glyph-cap" x="58" y="12" width="4" height="8" rx="1" />
    </svg>
  );
}

export function KettlebellGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 52" className={`kettlebell-glyph ${className}`} aria-hidden="true">
      <path className="glyph-handle" d="M14 18 C14 6, 34 6, 34 18" />
      <path
        className="glyph-plate"
        d="M24 14 C36 14, 44 22, 44 33 C44 42, 38 48, 24 48 C10 48, 4 42, 4 33 C4 22, 12 14, 24 14 Z"
      />
      <rect className="glyph-mark" x="18" y="30" width="12" height="4" rx="2" />
    </svg>
  );
}

export function PlateGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`plate-glyph ${className}`} aria-hidden="true">
      <circle className="glyph-plate" cx="24" cy="24" r="22" />
      <circle className="glyph-ring" cx="24" cy="24" r="15" />
      <circle className="glyph-hole" cx="24" cy="24" r="4.5" />
      <rect className="glyph-mark" x="21" y="5" width="6" height="4" rx="1" />
    </svg>
  );
}

/** Replaces the generic spinner / "Loading..." line: a dumbbell being lifted. */
export function DumbbellLoader({
  label,
  compact = false,
}: {
  label?: string | undefined;
  compact?: boolean | undefined;
}) {
  const { t } = useI18n();
  return (
    <div className={`gym-loader ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <span className="gym-loader-lift">
        <DumbbellGlyph />
      </span>
      <span className="gym-loader-floor" aria-hidden="true" />
      <span className="gym-loader-label">{label ?? t("common.loading")}</span>
    </div>
  );
}

export type EmptyIcon = "dumbbell" | "kettlebell" | "plate";

/** The equipment shown above an empty state's message. */
export function EmptyIllustration({ icon = "dumbbell" }: { icon?: EmptyIcon | undefined }) {
  return (
    <span className={`empty-illustration ${icon}`} aria-hidden="true">
      {icon === "kettlebell" ? (
        <KettlebellGlyph />
      ) : icon === "plate" ? (
        <PlateGlyph />
      ) : (
        <DumbbellGlyph />
      )}
    </span>
  );
}

/** A small heartbeat line with a spinning plate, for dashboard headers. */
export function HeaderPulse() {
  return (
    <div className="header-pulse" aria-hidden="true">
      <PlateGlyph className="header-pulse-plate" />
      <svg viewBox="0 0 160 40" className="header-pulse-line">
        <path
          className="pulse-track"
          d="M0 22 H44 L52 22 L58 8 L66 34 L72 16 L78 22 H112 L118 22 L122 14 L126 28 L130 22 H160"
        />
        <path
          className="pulse-trace"
          d="M0 22 H44 L52 22 L58 8 L66 34 L72 16 L78 22 H112 L118 22 L122 14 L126 28 L130 22 H160"
        />
      </svg>
    </div>
  );
}

const SHARDS = Array.from({ length: 18 }, (_, i) => ({
  angle: (360 / 18) * i + (i % 2 ? 7 : -5),
  distance: 110 + ((i * 37) % 70),
  delay: (i % 5) * 28,
  tone: i % 3 === 0 ? "light" : "red",
}));

/**
 * Completion moment (workout finished, day complete, goal reached). Announces itself to screen
 * readers, dismisses on click or after a few seconds, and drops the burst under reduced motion.
 */
export function Celebration({
  open,
  title,
  body,
  onClose,
  icon,
}: {
  open: boolean;
  title: string;
  body?: string;
  onClose: () => void;
  icon?: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => closeRef.current(), 3200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="celebrate" role="status" aria-live="assertive" onClick={onClose}>
      <div className="celebrate-burst" aria-hidden="true">
        {SHARDS.map((s, i) => (
          <span
            key={i}
            className={s.tone}
            style={
              {
                "--angle": `${s.angle}deg`,
                "--distance": `${s.distance}px`,
                "--delay": `${s.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="celebrate-card">
        <span className="celebrate-mark" aria-hidden="true">
          {icon ?? (
            <svg viewBox="0 0 52 52">
              <circle className="celebrate-ring" cx="26" cy="26" r="23" />
              <path className="celebrate-check" d="M15 27 L23 35 L38 18" />
            </svg>
          )}
        </span>
        <b>{title}</b>
        {body && <p>{body}</p>}
      </div>
    </div>,
    document.body,
  );
}
