import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Reset your password — iCoach" }],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <>
          Remembered it? <Link to="/sign-in">Back to sign in</Link>
        </>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground">
          Check <b>{email}</b> for a link to reset your password. It can take a minute to arrive.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
            <Mail />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
