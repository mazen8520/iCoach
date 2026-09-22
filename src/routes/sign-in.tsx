import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/icoach/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [{ title: "Sign in — iCoach" }],
  }),
  component: SignIn,
});

function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user!.id)
      .single();
    navigate({ to: profile?.role === "coach" ? "/coach/dashboard" : "/client/dashboard" });
  };

  return (
    <AuthLayout
      align="center"
      eyebrow="Welcome back"
      title="Sign in to iCoach"
      subtitle="Pick up exactly where you left off."
      footer={
        <>
          New to iCoach? <Link to="/sign-up">Create an account</Link>
        </>
      }
    >
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
        <div className="auth-field">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-bold text-primary">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          <LogIn />
        </Button>
      </form>
    </AuthLayout>
  );
}
