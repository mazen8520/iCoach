import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/client/check-ins")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.client.checkIns"),
  component: () => <ClientPage page="check-ins" />,
});
