import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — iCoach Coach" },
      {
        name: "description",
        content: "Schedule in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Schedule — iCoach Coach" },
      {
        property: "og:description",
        content: "Schedule in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="schedule" />,
});
