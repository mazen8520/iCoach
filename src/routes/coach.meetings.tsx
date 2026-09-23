import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/meetings")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.meetings"),
  component: () => <CoachPage page="meetings" />,
});
