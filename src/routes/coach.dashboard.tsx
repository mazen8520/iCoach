import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/dashboard")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.dashboard"),
  component: () => <CoachPage page="dashboard" />,
});
