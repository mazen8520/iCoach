import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/check-ins")({
  head: () => ({
    meta: [
      { title: "Check Ins — iCoach Client" },
      {
        name: "description",
        content: "Check Ins in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Check Ins — iCoach Client" },
      {
        property: "og:description",
        content: "Check Ins in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="check-ins" />,
});
