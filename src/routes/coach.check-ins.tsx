import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/check-ins")({
  head: () => ({
    meta: [
      { title: "Check Ins — iCoach Coach" },
      {
        name: "description",
        content: "Check Ins in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Check Ins — iCoach Coach" },
      {
        property: "og:description",
        content: "Check Ins in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="check-ins" />,
});
