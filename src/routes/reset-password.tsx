import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { DEFAULT_ATHLETE_PASSWORD, MIN_PASSWORD_LENGTH, dashboardPath } from "@/lib/account";
import { pageMeta, useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

export const Route = createFileRoute("/reset-password")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.resetPassword"),
  component: ResetPassword,
});

/** Two ways in: an emailed recovery link (Supabase restores a recovery session from the URL), or
 *  a coach-created athlete's forced first-login change away from the temporary password. */
function ResetPassword() {
  const i18n = useI18n();
  const { t } = i18n;
  const {
    user,
    profile,
    loading: authLoading,
    mustChangePassword,
    updatePassword,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("validation.passwordLength", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("validation.passwordMismatch"));
      return;
    }
    if (mustChangePassword && password === DEFAULT_ATHLETE_PASSWORD) {
      setError(t("errors.passwordSameAsTemporary"));
      return;
    }
    setLoading(true);
    const wasForced = mustChangePassword;
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setError(errorText(error, i18n, "errors.generic"));
      return;
    }
    if (wasForced && profile) {
      // Already signed in with the new password — straight into their own portal.
      toast.success(t("auth.reset.forcedDone"));
      navigate({ to: dashboardPath(profile.role), replace: true });
    } else {
      toast.success(t("auth.reset.done"));
      await signOut();
      navigate({ to: "/sign-in", replace: true });
    }
  };

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/sign-in", replace: true });
  };

  const invalidLink = !authLoading && !user;

  return (
    <AuthLayout
      align="center"
      eyebrow={t(mustChangePassword ? "auth.reset.forcedEyebrow" : "auth.reset.eyebrow")}
      title={t("auth.reset.title")}
      subtitle={t(mustChangePassword ? "auth.reset.forcedSubtitle" : "auth.reset.subtitle")}
      footer={
        user ? (
          <>
            {t("auth.reset.notYou")}{" "}
            <button type="button" className="font-bold text-primary" onClick={onSignOut}>
              {t("common.signOut")}
            </button>
          </>
        ) : undefined
      }
    >
      {invalidLink ? (
        <div role="alert">
          <p className="text-sm text-foreground">{t("auth.reset.invalidLink")}</p>
          <Link to="/forgot-password">
            <Button size="lg" className="mt-6 w-full">
              {t("auth.reset.requestNew")}
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
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
          <div className="auth-field">
            <Label htmlFor="confirm">{t("auth.reset.confirm")}</Label>
            <Input
              id="confirm"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("auth.reset.confirmPlaceholder")}
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading || authLoading}>
            {loading ? t("auth.reset.submitting") : t("auth.reset.submit")}
            <KeyRound />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
