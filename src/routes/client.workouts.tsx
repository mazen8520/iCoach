import { createFileRoute } from "@tanstack/react-router";
import { ClientPage } from "@/components/icoach/client-pages";

export const Route = createFileRoute("/client/workouts")({
  head: () => ({
    meta: [
      { title: "Workouts — iCoach Client" },
      {
        name: "description",
        content: "Workouts in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Workouts — iCoach Client" },
      {
        property: "og:description",
        content: "Workouts in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientPage page="workouts" />,
});
