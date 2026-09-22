import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/nutrition")({
  head: () => ({
    meta: [
      { title: "Nutrition — iCoach Client" },
      {
        name: "description",
        content: "Nutrition in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Nutrition — iCoach Client" },
      {
        property: "og:description",
        content: "Nutrition in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="nutrition" />,
});
