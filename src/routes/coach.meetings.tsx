import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — iCoach Coach" },
      {
        name: "description",
        content: "Meetings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Meetings — iCoach Coach" },
      {
        property: "og:description",
        content: "Meetings in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="meetings" />,
});
