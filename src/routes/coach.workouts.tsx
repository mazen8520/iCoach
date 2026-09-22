import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/workouts")({
  head: () => ({
    meta: [
      { title: "Workouts — iCoach Coach" },
      {
        name: "description",
        content: "Workouts in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Workouts — iCoach Coach" },
      {
        property: "og:description",
        content: "Workouts in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="workouts" />,
});
