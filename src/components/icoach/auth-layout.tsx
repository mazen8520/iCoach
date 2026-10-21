import { Link } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import athletePhoto from "@/assets/icoach-hero.jpg";
import neutralPhoto from "@/assets/icoach-hero-man.jpg";
import coachPhoto from "@/assets/workout-battle-rope.jpg";
import recoverPhoto from "@/assets/workout-runner.jpg";

/** Which photograph sets the scene: the athlete portal, the coach portal (and coach sign-up),
 *  the neutral sign-in, or the password pages. */
export type AuthScene = "athlete" | "coach" | "neutral" | "recover";

const PHOTOS: Record<AuthScene, string> = {
  athlete: athletePhoto,
  coach: coachPhoto,
  neutral: neutralPhoto,
  recover: recoverPhoto,
};

/** Staggers the card's rows in on arrival. */
const rise = (step: number) => ({ "--rise": step }) as CSSProperties;

const PULSE = "M0 22 H118 L130 22 L140 4 L154 40 L164 12 L172 22 H320";

/** Shared frame of every sign-in, sign-up and password page: one centred card over a slowly
 *  moving athletic photograph, with the brand's heartbeat running along the card's top edge.
 *  Identical on desktop, phone browsers and the iOS/Android apps. */
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  scene = "neutral",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  scene?: AuthScene;
}) {
  return (
    <main className="auth-shell" data-scene={scene}>
      <div className="auth-backdrop" aria-hidden="true">
        <img src={PHOTOS[scene]} width={1920} height={1280} alt="" className="auth-photo" />
        <div className="auth-shade" />
      </div>
      <header className="landing-nav">
        <Link to="/">
          <Brand />
        </Link>
        <LanguageSwitch />
      </header>
      <div className="auth-wrap">
        <div className="auth-card">
          <svg
            className="auth-pulse"
            viewBox="0 0 320 44"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="auth-pulse-track" d={PULSE} pathLength={100} />
            <path className="auth-pulse-beat" d={PULSE} pathLength={100} />
          </svg>
          <p className="eyebrow auth-rise" style={rise(0)}>
            {eyebrow}
          </p>
          <h1 className="auth-title auth-rise" style={rise(1)}>
            {title}
          </h1>
          <p className="auth-subtitle auth-rise" style={rise(2)}>
            {subtitle}
          </p>
          <div className="auth-body auth-rise" style={rise(3)}>
            {children}
          </div>
          {footer && (
            <div className="auth-footer auth-rise" style={rise(4)}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
