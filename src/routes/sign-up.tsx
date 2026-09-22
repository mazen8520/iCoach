import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [{ title: "Create your coach account — iCoach" }],
  }),
  component: SignUp,
});

function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate({ to: "/coach/dashboard" });
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your coach account"
      subtitle="Athletes don't sign up here — once you're in, you add them from your roster and they sign in with the credentials you give them."
      footer={
        <>
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <div className="auth-field">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jordan Miles"
          />
        </div>
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
        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
          <UserRound />
        </Button>
      </form>
    </AuthLayout>
  );
}
