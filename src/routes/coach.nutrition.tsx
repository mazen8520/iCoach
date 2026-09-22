import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/nutrition")({
  head: () => ({
    meta: [
      { title: "Nutrition — iCoach Coach" },
      {
        name: "description",
        content: "Nutrition in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Nutrition — iCoach Coach" },
      {
        property: "og:description",
        content: "Nutrition in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="nutrition" />,
});
