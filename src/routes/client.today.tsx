import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/today")({
  head: () => ({
    meta: [
      { title: "Today — iCoach Client" },
      { name: "description", content: "Today in the iCoach premium fitness coaching experience." },
      { property: "og:title", content: "Today — iCoach Client" },
      {
        property: "og:description",
        content: "Today in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="today" />,
});
