import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/settings")({
  head: () => ({
    meta: [
      { title: "Settings — iCoach Client" },
      {
        name: "description",
        content: "Settings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Settings — iCoach Client" },
      {
        property: "og:description",
        content: "Settings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="settings" />,
});
