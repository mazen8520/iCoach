import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";

export const Route = createFileRoute("/coach/clients")({
  head: () => ({
    meta: [
      { title: "Clients — iCoach Coach" },
      {
        name: "description",
        content: "Clients in the iCoach premium fitness coaching experience.",
      },
      { property: "og:title", content: "Clients — iCoach Coach" },
      {
        property: "og:description",
        content: "Clients in the iCoach premium fitness coaching experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CoachPage page="clients" />,
});
