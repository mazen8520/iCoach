import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/nutrition")({
  // ?client= pre-filters by athlete, ?plan= opens a specific plan (links from athlete profiles).
  validateSearch: (search: Record<string, unknown>): { client?: string; plan?: string } => ({
    ...(typeof search["client"] === "string" ? { client: search["client"] } : {}),
    ...(typeof search["plan"] === "string" ? { plan: search["plan"] } : {}),
  }),
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.nutrition"),
  component: () => <CoachPage page="nutrition" />,
});
