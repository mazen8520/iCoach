import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { dashboardPath } from "@/lib/account";
import type { UserRole } from "@/lib/database.types";
import { pageMeta, useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

type Portal = "coach" | "athlete";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/sign-in")({
  // ?as=coach / ?as=athlete: the portal the visitor chose on the home page. It only changes the
  // copy — the role that's actually opened always comes from the account that signs in.
  validateSearch: (search: Record<string, unknown>): { as?: Portal } =>
    search["as"] === "coach" || search["as"] === "athlete" ? { as: search["as"] } : {},
  head: ({ match }) => pageMeta(match.context.lang, "meta.signIn"),
  component: SignIn,
});

function SignIn() {
  const { as: portal } = Route.useSearch();
  const i18n = useI18n();
  const { t } = i18n;
  const {
    user,
    profile,
    profileError,
    loading: authLoading,
    mustChangePassword,
    signIn,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const portalRole: UserRole | null =
    portal === "coach" ? "coach" : portal === "athlete" ? "client" : null;

  // Someone is already signed in on this device.
  const signedIn = !authLoading && !!user && !submitting;
  const roleMismatch = signedIn && !!profile && !!portalRole && profile.role !== portalRole;
  const showSignedInPanel = signedIn && !mustChangePassword && (profileError || roleMismatch);

  useEffect(() => {
    if (!signedIn) return;
    if (mustChangePassword) {
      navigate({ to: "/reset-password", replace: true });
      return;
    }
    // Same role as the chosen portal (or no portal chosen): go straight to their dashboard.
    // A different role is NOT let through — the page offers to sign out and switch instead.
    if (profile && !roleMismatch) navigate({ to: dashboardPath(profile.role), replace: true });
  }, [signedIn, mustChangePassword, profile, roleMismatch, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailPattern.test(email.trim())) {
      setError(t("validation.email"));
      return;
    }
    if (!password) {
      setError(t("validation.passwordRequired"));
      return;
    }
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    if (result.error || !result.role) {
      setError(errorText(result.error, i18n, "errors.generic"));
      setSubmitting(false);
      return;
    }
    if (result.mustChangePassword) {
      navigate({ to: "/reset-password", replace: true });
      return;
    }
    // The credentials decide the role: open the dashboard that belongs to this account.
    if (portalRole && result.role !== portalRole) {
      toast.info(
        t(result.role === "coach" ? "auth.roleRedirect.coach" : "auth.roleRedirect.client"),
      );
    }
    navigate({ to: dashboardPath(result.role), replace: true });
  };

  const switchAccount = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setPassword("");
  };

  if (showSignedInPanel) {
    const roleLabel = profile
      ? t(profile.role === "coach" ? "auth.role.coach" : "auth.role.client")
      : "";
    return (
      <AuthLayout
        align="center"
        eyebrow={t("auth.signedIn.eyebrow")}
        title={t("auth.signedIn.title")}
        subtitle={
          profile
            ? t("auth.signedIn.body", { name: profile.full_name || profile.email, role: roleLabel })
            : t("errors.profileMissing")
        }
      >
        {roleMismatch && (
          <p className="text-sm text-muted-foreground">
            {t(
              portalRole === "client"
                ? "auth.signedIn.switchToAthlete"
                : "auth.signedIn.switchToCoach",
            )}
          </p>
        )}
        <Button size="lg" className="mt-6 w-full" onClick={switchAccount} disabled={signingOut}>
          {signingOut ? t("common.signingOut") : t("auth.signedIn.signOutSwitch")}
          <LogOut />
        </Button>
        {profile && (
          <Button
            variant="outline"
            size="lg"
            className="mt-3 w-full"
            onClick={() => navigate({ to: dashboardPath(profile.role) })}
          >
            {t("auth.signedIn.continue")}
          </Button>
        )}
      </AuthLayout>
    );
  }

  const copy =
    portal === "athlete"
      ? {
          eyebrow: t("auth.athleteSignIn.eyebrow"),
          title: t("auth.athleteSignIn.title"),
          subtitle: t("auth.athleteSignIn.subtitle"),
        }
      : portal === "coach"
        ? {
            eyebrow: t("auth.coachSignIn.eyebrow"),
            title: t("auth.coachSignIn.title"),
            subtitle: t("auth.coachSignIn.subtitle"),
          }
        : {
            eyebrow: t("auth.signIn.eyebrow"),
            title: t("auth.signIn.title"),
            subtitle: t("auth.signIn.subtitle"),
          };

  return (
    <AuthLayout
      align="center"
      {...copy}
      footer={
        portal === "athlete" ? (
          <>
            {t("auth.footer.athleteNote")} {t("auth.footer.areYouCoach")}{" "}
            <Link to="/sign-in" search={{ as: "coach" }}>
              {t("auth.footer.coachSignIn")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.footer.newToICoach")}{" "}
            <Link to="/sign-up">{t("auth.footer.createAccount")}</Link>
            <span className="mt-2 block">
              {t("auth.footer.areYouAthlete")}{" "}
              <Link to="/sign-in" search={{ as: "athlete" }}>
                {t("auth.footer.athleteSignIn")}
              </Link>
            </span>
          </>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>
        <div className="auth-field">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs font-bold text-primary">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting}>
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
          <LogIn />
        </Button>
      </form>
    </AuthLayout>
  );
}
