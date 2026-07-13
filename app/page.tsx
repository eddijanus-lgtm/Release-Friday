import { ReleaseFeed } from "@/components/releases/release-feed";
import { mockReleases } from "@/lib/releases/mock-releases";
import { getUpcomingFriday } from "@/lib/releases/get-upcoming-friday";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

export default function Home() {
  const upcomingFriday = getUpcomingFriday();

  return (
    <main className="appShell">
      <header className="hero">
        <div>
          <p className="dateLabel">{dateFormatter.format(upcomingFriday)}</p>
          <h1>Release Friday</h1>
        </div>
        <p className="subtitle">
          Die wichtigsten Hip-Hop- und Rap-Releases aus Deutschland und den USA.
        </p>
      </header>

      <ReleaseFeed releases={mockReleases} />

      <nav className="bottomNav" aria-label="Hauptnavigation">
        <a className="active" href="#releases" aria-current="page">Releases</a>
        <a href="#favorites">Favoriten</a>
        <a href="#settings">Settings</a>
      </nav>
    </main>
  );
}
