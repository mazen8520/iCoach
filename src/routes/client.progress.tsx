import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";
import { pageMeta } from "@/lib/i18n";

export const Route = createFileRoute("/client/progress")({
  head: ({ match }) => pageMeta(match.context.lang, "meta.client.progress"),
  component: () => <ClientPage page="progress" />,
});
