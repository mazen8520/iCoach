import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/client/today")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.client.today"),
  component: () => <ClientPage page="today" />,
});
