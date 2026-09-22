import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/progress")({
  head: () => ({
    meta: [
      { title: "Progress — iCoach Client" },
      {
        name: "description",
        content: "Progress in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Progress — iCoach Client" },
      {
        property: "og:description",
        content: "Progress in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="progress" />,
});
