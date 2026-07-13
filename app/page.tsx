const releases = [
  { artist: "Apache 207", title: "Beispielrelease", type: "Single", country: "DE" },
  { artist: "Central Cee", title: "Example Release", type: "Album", country: "US" },
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">KOMMENDER FREITAG</p>
        <h1>Release Friday</h1>
        <p className="subtitle">Die wichtigsten Hip-Hop- und Rap-Releases aus Deutschland und den USA.</p>
      </header>

      <nav className="filters" aria-label="Release-Filter">
        <button className="active">Alle</button>
        <button>Deutschland</button>
        <button>USA</button>
      </nav>

      <section className="releaseList" aria-label="Kommende Releases">
        {releases.map((release) => (
          <article className="releaseCard" key={`${release.artist}-${release.title}`}>
            <div className="cover" aria-hidden="true">RF</div>
            <div className="releaseInfo">
              <span>{release.country} · {release.type}</span>
              <h2>{release.title}</h2>
              <p>{release.artist}</p>
            </div>
            <button className="more" aria-label={`Details zu ${release.title}`}>›</button>
          </article>
        ))}
      </section>
    </main>
  );
}
