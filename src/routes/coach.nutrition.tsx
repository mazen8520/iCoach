import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/nutrition")({
  // ?client= pre-filters by athlete, ?plan= opens a specific plan (links from athlete profiles),
  // ?view=templates opens the template library.
  validateSearch: (
    search: Record<string, unknown>,
  ): { client?: string; plan?: string; view?: "templates" } => ({
    ...(typeof search["client"] === "string" ? { client: search["client"] } : {}),
    ...(typeof search["plan"] === "string" ? { plan: search["plan"] } : {}),
    ...(search["view"] === "templates" ? { view: "templates" as const } : {}),
  }),
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.nutrition"),
  component: () => <CoachPage page="nutrition" />,
});
