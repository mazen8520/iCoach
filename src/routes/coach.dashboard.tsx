import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — iCoach Coach" },
      {
        name: "description",
        content: "Dashboard in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Dashboard — iCoach Coach" },
      {
        property: "og:description",
        content: "Dashboard in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="dashboard" />,
});
