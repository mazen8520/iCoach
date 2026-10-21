import { createFileRoute, redirect } from "@tanstack/react-router";
import { Landing } from "@/components/icoach/landing";
import { pageMeta } from "@/lib/i18n";
import { isNativeApp } from "@/lib/native";

export const Route = createFileRoute("/")({
  // The marketing page is the website's front door; inside the mobile app "home" is /app.
  beforeLoad: () => {
    if (isNativeApp()) throw redirect({ to: "/app", replace: true });
  },
  head: ({ match }) => pageMeta(match.context.lang, "meta.home", "meta.homeDescription"),
  component: Landing,
});
