import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/icoach/landing";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.home", "meta.homeDescription"),
  component: Landing,
});
