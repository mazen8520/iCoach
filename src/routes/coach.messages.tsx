import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/coach/messages")({
  // ?c= opens a specific conversation (e.g. "Message" on an athlete profile).
  validateSearch: (search: Record<string, unknown>): { c?: string } =>
    typeof search["c"] === "string" ? { c: search["c"] } : {},
  head: ({ match }) => pageMeta(match.context.lang, "meta.coach.messages"),
  component: () => <CoachPage page="messages" />,
});
