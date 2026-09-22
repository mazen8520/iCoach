import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — iCoach Client" },
      {
        name: "description",
        content: "Dashboard in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Dashboard — iCoach Client" },
      {
        property: "og:description",
        content: "Dashboard in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="dashboard" />,
});
