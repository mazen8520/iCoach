import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/messages")({
  head: () => ({
    meta: [
      { title: "Messages — iCoach Coach" },
      {
        name: "description",
        content: "Messages in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Messages — iCoach Coach" },
      {
        property: "og:description",
        content: "Messages in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="messages" />,
});
