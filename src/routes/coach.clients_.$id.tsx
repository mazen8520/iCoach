import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/icoach/coach-pages";
import { PROFILE_TABS, type ProfileTab } from "@/components/icoach/coach-client-profile";
import { pageMeta } from "@/lib/i18n";

// "clients_" keeps this page OUT of the /coach/clients route's layout (that page renders the roster
// and has no <Outlet />), while the URL stays /coach/clients/<id>.
export const Route = createFileRoute("/coach/clients_/$id")({
  // ?tab= selects a section of the athlete page so it survives refresh and back/forward.
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } =>
    PROFILE_TABS.includes(search["tab"] as ProfileTab) ? { tab: search["tab"] as ProfileTab } : {},
  head: ({ match }) =>
    pageMeta(match.context.lang, "meta.coach.clientProfile", "meta.coach.clientProfileDescription"),
  component: Profile,
});
function Profile() {
  const { id } = Route.useParams();
  return <CoachPage page="clients" clientId={id} />;
}
