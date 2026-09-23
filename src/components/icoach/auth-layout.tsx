import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./language-switch";
import hero from "@/assets/icoach-hero-man.jpg";

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  align = "end",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Horizontal position of the card within the hero. Defaults to "end" (the split-screen look
   *  of coach sign-up); the sign-in, recovery and password pages use "center". */
  align?: "end" | "center";
}) {
  return (
    <main className={`auth-shell ${align === "center" ? "auth-shell-center" : ""}`}>
      <img src={hero} width={1920} height={1280} alt="" className="auth-shell-image" />
      <div className="auth-shell-shade" />
      <header className="landing-nav">
        <Link to="/">
          <Brand />
        </Link>
        <LanguageSwitch />
      </header>
      <div className="auth-wrap">
        <div className="panel-elevated auth-card animate-enter">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
    </main>
  );
}
