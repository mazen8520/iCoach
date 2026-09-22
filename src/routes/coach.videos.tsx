import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/videos")({
  head: () => ({
    meta: [
      { title: "Videos — iCoach Coach" },
      { name: "description", content: "Videos in the iCoach premium fitness coaching experience." },
      { property: "og:title", content: "Videos — iCoach Coach" },
      {
        property: "og:description",
        content: "Videos in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="videos" />,
});
