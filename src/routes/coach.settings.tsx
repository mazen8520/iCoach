import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export type CoachSettingsSearch = {
  tab?: "profile" | "notifications" | "reports" | "integrations";
  /** Result of the Zoom connect flow, set by /api/zoom/callback. */
  zoom?: "connected" | "denied" | "expired" | "error" | "install";
};

const TABS = ["profile", "notifications", "reports", "integrations"];
const ZOOM_RESULTS = ["connected", "denied", "expired", "error", "install"];

export const Route = createFileRoute("/coach/settings")({
  validateSearch: (search: Record<string, unknown>): CoachSettingsSearch => ({
    ...(TABS.includes(search["tab"] as string)
      ? { tab: search["tab"] as NonNullable<CoachSettingsSearch["tab"]> }
      : {}),
    ...(ZOOM_RESULTS.includes(search["zoom"] as string)
      ? { zoom: search["zoom"] as NonNullable<CoachSettingsSearch["zoom"]> }
      : {}),
  }),
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.settings"),
  component: () => <CoachPage page="settings" />,
});
