import { PrototypeClient } from "@/app/prototype-client";
import { realReleases, releaseDataMetadata } from "@/lib/releases/real-releases.generated";

export default function Home() {
  if (!realReleases.length) {
    const friday = new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(new Date(`${releaseDataMetadata.targetDate}T12:00:00Z`));

    return (
      <main className="prototypePage">
        <div className="prototypePhone">
          <section className="screenContent homeScreen">
            <header className="screenHeader">
              <p className="eyebrow">ECHTE DATEN · WIRD AKTUALISIERT</p>
              <h1>Noch nichts bestätigt</h1>
              <p className="screenSubtitle">
                Für {friday} wurden in den verbundenen Quellen noch keine bestätigten Hip-Hop- oder Rap-Releases gefunden.
              </p>
            </header>
          </section>
        </div>
      </main>
    );
  }

  return <PrototypeClient releases={realReleases} />;
}
