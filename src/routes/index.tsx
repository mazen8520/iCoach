import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Dumbbell, MoveRight, Play, Zap } from "lucide-react";
import { Brand } from "@/components/icoach/brand";
import { Button } from "@/components/ui/button";
import hero from "@/assets/icoach-hero-man.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iCoach — Train Smarter. Perform Stronger." },
      { name: "description", content: "Premium online coaching built for serious performance." },
      { property: "og:title", content: "iCoach — Train Smarter. Perform Stronger." },
      {
        property: "og:description",
        content: "Premium online coaching built for serious performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});
function Landing() {
  return (
    <main className="landing">
      <img
        src={hero}
        width={1920}
        height={1280}
        alt="Athlete performing a barbell squat"
        className="landing-image"
      />
      <div className="landing-shade" />
      <header className="landing-nav">
        <Brand />
        <span className="hidden text-xs font-bold uppercase tracking-[.18em] text-muted-foreground md:block">
          Built for the work
        </span>
        <Link to="/client/dashboard">
          <Button variant="outline" size="sm">
            Enter iCoach <ArrowUpRight />
          </Button>
        </Link>
      </header>
      <section className="landing-copy">
        <p className="eyebrow animate-enter">PERFORMANCE COACHING · REDEFINED</p>
        <h1>
          Train. Track.
          <br />
          <em>Transform.</em>
        </h1>
        <p className="landing-description">
          One focused system for every workout, meal, check-in and coaching moment that moves you
          forward.
        </p>
        <div className="landing-actions">
          <Link to="/client/dashboard">
            <Button size="lg">
              I’m an athlete <MoveRight />
            </Button>
          </Link>
          <Link to="/coach/dashboard">
            <Button variant="outline" size="lg">
              I’m a coach <ChevronRight />
            </Button>
          </Link>
        </div>
        <div className="landing-proof">
          <div>
            <Zap />
            <b>87%</b>
            <span>avg. completion</span>
          </div>
          <div>
            <Dumbbell />
            <b>24</b>
            <span>active athletes</span>
          </div>
          <div>
            <Play />
            <b>164</b>
            <span>training sessions</span>
          </div>
        </div>
      </section>
      <div className="landing-scroll">
        <span />
        SCROLL TO MOVE
      </div>
    </main>
  );
}
