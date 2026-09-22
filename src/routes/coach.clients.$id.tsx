import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
export const Route = createFileRoute("/coach/clients/$id")({
  head: () => ({
    meta: [
      { title: "Athlete Profile — iCoach Coach" },
      {
        name: "description",
        content: "Athlete performance, plans and coaching activity in iCoach.",
      },
      { property: "og:title", content: "Athlete Profile — iCoach Coach" },
      {
        property: "og:description",
        content: "Athlete performance, plans and coaching activity in iCoach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});
function Profile() {
  const { id } = Route.useParams();
  return <CoachPage page="clients" clientId={id} />;
}
