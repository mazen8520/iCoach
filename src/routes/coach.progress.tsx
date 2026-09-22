import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/progress")({
  head: () => ({
    meta: [
      { title: "Progress — iCoach Coach" },
      {
        name: "description",
        content: "Progress in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Progress — iCoach Coach" },
      {
        property: "og:description",
        content: "Progress in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="progress" />,
});
