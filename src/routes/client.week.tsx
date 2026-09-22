import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/week")({
  head: () => ({
    meta: [
      { title: "Week — iCoach Client" },
      { name: "description", content: "Week in the iCoach premium fitness coaching experience." },
      { property: "og:title", content: "Week — iCoach Client" },
      {
        property: "og:description",
        content: "Week in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="week" />,
});
