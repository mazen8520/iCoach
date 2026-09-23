import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/check-ins")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.checkIns"),
  component: () => <CoachPage page="check-ins" />,
});
