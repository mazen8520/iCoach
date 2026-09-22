import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/messages")({
  head: () => ({
    meta: [
      { title: "Messages — iCoach Client" },
      {
        name: "description",
        content: "Messages in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Messages — iCoach Client" },
      {
        property: "og:description",
        content: "Messages in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="messages" />,
});
