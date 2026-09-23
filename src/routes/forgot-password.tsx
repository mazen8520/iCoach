import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { pageMeta, useI18n } from "@/lib/i18n";
import { errorText } from "@/lib/i18n/errors";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/forgot-password")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.forgotPassword"),
  component: ForgotPassword,
});

function ForgotPassword() {
  const i18n = useI18n();
  const { t } = i18n;
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailPattern.test(email.trim())) {
      setError(t("validation.email"));
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      setError(errorText(error, i18n, "errors.generic"));
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      align="center"
      eyebrow={t("auth.forgot.eyebrow")}
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={
        <>
          {t("auth.forgot.remembered")} <Link to="/sign-in">{t("auth.forgot.backToSignIn")}</Link>
        </>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground" role="status">
          {t("auth.forgot.sent", { email: email.trim() })}
        </p>
      ) : (
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
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
            {loading ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
            <Mail />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
