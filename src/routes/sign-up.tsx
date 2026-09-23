import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, dashboardPath } from "@/lib/account";
import { pageMeta, useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/sign-up")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.signUp"),
  component: SignUp,
});

function SignUp() {
  const i18n = useI18n();
  const { t } = i18n;
  const { user, profile, loading: authLoading, mustChangePassword, signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Already signed in — don't show a registration form over an active session.
  useEffect(() => {
    if (authLoading || !user) return;
    if (mustChangePassword) {
      navigate({ to: "/reset-password", replace: true });
      return;
    }
    if (profile) navigate({ to: dashboardPath(profile.role), replace: true });
  }, [authLoading, user, profile, mustChangePassword, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError(t("validation.yourName"));
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setError(t("validation.email"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("validation.passwordLength", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setLoading(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (result.error) {
      setError(errorText(result.error, i18n, "errors.generic"));
      return;
    }
    if (result.needsConfirmation) {
      setNeedsConfirmation(true);
      return;
    }
    navigate({ to: "/coach/dashboard", replace: true });
  };

  return (
    <AuthLayout
      eyebrow={t("auth.signUp.eyebrow")}
      title={t("auth.signUp.title")}
      subtitle={t("auth.signUp.subtitle")}
      footer={
        <>
          {t("auth.signUp.haveAccount")}{" "}
          <Link to="/sign-in" search={{ as: "coach" }}>
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      {needsConfirmation ? (
        <p className="text-sm text-foreground" role="status">
          {t("auth.signUp.checkEmail")}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <Label htmlFor="fullName">{t("auth.fullName")}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("auth.fullNamePlaceholder")}
            />
          </div>
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
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
            {loading ? t("auth.signUp.submitting") : t("auth.signUp.submit")}
            <UserRound />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
