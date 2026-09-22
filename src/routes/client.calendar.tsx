import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — iCoach Client" },
      {
        name: "description",
        content: "Calendar in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Calendar — iCoach Client" },
      {
        property: "og:description",
        content: "Calendar in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="calendar" />,
});
