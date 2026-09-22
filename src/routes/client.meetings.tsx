import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — iCoach Client" },
      {
        name: "description",
        content: "Meetings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Meetings — iCoach Client" },
      {
        property: "og:description",
        content: "Meetings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="meetings" />,
});
