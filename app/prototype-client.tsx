"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MusicRelease, ReleaseCountry, ReleaseDataMetadata } from "@/types/release";

type Tab = "releases" | "search" | "saved" | "profile";
type CountryFilter = "ALL" | ReleaseCountry;
type SavedFilter = "upcoming" | "live" | "all";

type PrototypeClientProps = {
  releases: MusicRelease[];
  metadata?: ReleaseDataMetadata;
};

type IconName = "home" | "search" | "star" | "profile" | "back" | "chevron" | "external";

const countryLabels: Record<ReleaseCountry, string> = {
  DE: "Deutschland",
  US: "USA",
};

const kindLabels: Record<MusicRelease["kind"], string> = {
  album: "ALBUM",
  ep: "EP",
  mixtape: "MIXTAPE",
  single: "SINGLE",
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") return <svg {...common}><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "star") return <svg {...common}><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z"/></svg>;
  if (name === "profile") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.2 3.4-6.3 7.5-6.3s6.7 2.1 7.5 6.3"/></svg>;
  if (name === "back") return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
  if (name === "external") return <svg {...common}><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>;
  return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
}

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function isReleaseLive(release: MusicRelease, now = new Date()) {
  return now.getTime() >= parseLocalDate(release.releaseDate).getTime();
}

function formatReleaseDate(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parseLocalDate(dateString));
}

function formatGeneratedAt(value?: string) {
  if (!value) return "Noch kein Datenlauf";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Datenstand unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pluralizeReleases(count: number) {
  return count === 1 ? "1 Release" : `${count} Releases`;
}

function getHomeCopy(releases: MusicRelease[], now: Date) {
  const targetDate = releases[0]?.releaseDate;
  if (!targetDate) {
    return {
      eyebrow: "RELEASE RADAR",
      title: "Noch leer",
      subtitle: "Für den kommenden Freitag sind noch keine bestätigten Releases eingetragen.",
    };
  }

  const target = parseLocalDate(targetDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(now);

  if (days <= 0) {
    return {
      eyebrow: `JETZT VERFÜGBAR · ${time}`,
      title: "Release Friday",
      subtitle: releases.length === 1 ? "1 Release ist jetzt verfügbar." : `${releases.length} Releases sind jetzt verfügbar.`,
    };
  }

  if (days === 1 && now.getDay() === 4) {
    return {
      eyebrow: `DONNERSTAG · ${time}`,
      title: "Heute Nacht",
      subtitle: releases.length === 1
        ? "1 Release wartet auf Mitternacht."
        : `${releases.length} Releases warten auf Mitternacht.`,
    };
  }

  return {
    eyebrow: `${new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(now).toUpperCase()} · ${time}`,
    title: "Diesen Freitag",
    subtitle: releases.length === 1 ? "1 Release ist aktuell bestätigt." : `${releases.length} Releases sind aktuell bestätigt.`,
  };
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function useCountdown(releaseDate: string) {
  const [label, setLabel] = useState("--:--:--");

  useEffect(() => {
    const target = parseLocalDate(releaseDate);
    const update = () => {
      const seconds = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      if (seconds <= 0) {
        setLabel("LIVE");
        return;
      }
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const rest = seconds % 60;
      setLabel(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [releaseDate]);

  return label;
}

function Artwork({ release, compact = false }: { release: MusicRelease; compact?: boolean }) {
  const className = `releaseArtwork ${compact ? "artworkCompact" : ""}`;
  if (release.coverUrl) {
    return (
      <div className={className}>
        <img src={release.coverUrl} alt={`Cover von ${release.title}`} loading="lazy" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className={`${className} artworkFallback`} aria-label={`Noch kein Cover für ${release.title}`}>
      <div className="artGlow" />
      <div className="artBars"><span /><span /><span /><span /><span /></div>
    </div>
  );
}

function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="screenHeader">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {subtitle ? <p className="screenSubtitle">{subtitle}</p> : null}
    </header>
  );
}

function FilterPills<T extends string>({
  value,
  items,
  onChange,
  label,
}: {
  value: T;
  items: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="filterPills" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          className={value === item.value ? "selected" : undefined}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, body, icon = "search" }: { title: string; body: string; icon?: IconName }) {
  return (
    <div className="emptyState" role="status">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function ReleaseRow({
  release,
  saved,
  onOpen,
  onToggleSaved,
}: {
  release: MusicRelease;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  const countdown = useCountdown(release.releaseDate);
  const live = countdown === "LIVE";
  const shortStatus = live ? "LIVE" : countdown.slice(0, 5);

  return (
    <article className="releaseRow">
      <button type="button" className="releaseRowMain" onClick={onOpen} aria-label={`${release.title} von ${release.artist} öffnen`}>
        <Artwork release={release} compact />
        <div className="releaseCopy">
          <span className={`releaseKicker ${live ? "isLive" : ""}`}>{release.country} · {kindLabels[release.kind]}</span>
          <strong>{release.title}</strong>
          <span>{release.artist}</span>
        </div>
        <div className={`releaseStatus ${live ? "isLive" : ""}`}>{shortStatus}</div>
      </button>
      <button
        type="button"
        className={`saveMini ${saved ? "isSaved" : ""}`}
        onClick={onToggleSaved}
        aria-label={saved ? `${release.title} entfernen` : `${release.title} speichern`}
        aria-pressed={saved}
      >
        <span />
      </button>
    </article>
  );
}

function FeaturedRelease({ release, onOpen }: { release: MusicRelease; onOpen: () => void }) {
  const countdown = useCountdown(release.releaseDate);
  const live = countdown === "LIVE";

  return (
    <button type="button" className="featuredRelease" onClick={onOpen}>
      <Artwork release={release} />
      <div className="featuredCopy">
        <span className={`releaseKicker ${live ? "isLive" : ""}`}>{release.country} · {kindLabels[release.kind]}</span>
        <h2>{release.title}</h2>
        <p>{release.artist}</p>
        <div className="countdownCard">
          <span><i className={live ? "live" : undefined} /> {live ? "JETZT" : "NOCH"}</span>
          <strong>{countdown}</strong>
        </div>
      </div>
    </button>
  );
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ id: Tab; label: string; icon: IconName }> = [
    { id: "releases", label: "Releases", icon: "home" },
    { id: "search", label: "Suche", icon: "search" },
    { id: "saved", label: "Gespeichert", icon: "star" },
    { id: "profile", label: "Profil", icon: "profile" },
  ];

  return (
    <nav className="prototypeNav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={active === item.id ? "active" : undefined}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function HomeScreen({
  releases,
  savedIds,
  onOpen,
  onToggleSaved,
}: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const now = useClock();
  const [filter, setFilter] = useState<CountryFilter>("ALL");
  const filtered = releases.filter((release) => filter === "ALL" || release.country === filter);
  const featured = filtered[0];
  const visible = filtered.slice(1);
  const copy = getHomeCopy(releases, now);

  return (
    <section className="screenContent homeScreen">
      <ScreenHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
      {featured ? (
        <>
          <FeaturedRelease release={featured} onOpen={() => onOpen(featured)} />
          <FilterPills
            value={filter}
            label="Region filtern"
            onChange={setFilter}
            items={[
              { value: "ALL", label: "Alle" },
              { value: "DE", label: "Deutschland" },
              { value: "US", label: "USA" },
            ]}
          />
          <h2 className="sectionTitle">Weitere Releases</h2>
          <div className="releaseStack">
            {visible.length ? visible.map((release) => (
              <ReleaseRow
                key={release.id}
                release={release}
                saved={savedIds.has(release.id)}
                onOpen={() => onOpen(release)}
                onToggleSaved={() => onToggleSaved(release.id)}
              />
            )) : (
              <EmptyState
                title="Keine weiteren Releases"
                body="Für diese Region ist aktuell nur der hervorgehobene Release bestätigt."
                icon="home"
              />
            )}
          </div>
        </>
      ) : (
        <>
          <FilterPills
            value={filter}
            label="Region filtern"
            onChange={setFilter}
            items={[
              { value: "ALL", label: "Alle" },
              { value: "DE", label: "Deutschland" },
              { value: "US", label: "USA" },
            ]}
          />
          <EmptyState
            title={filter === "DE" ? "Noch keine Deutschland-Releases" : filter === "US" ? "Noch keine USA-Releases" : "Noch keine bestätigten Releases"}
            body="Der Radar wird automatisch aktualisiert. Bestätigte Einträge erscheinen hier sofort."
            icon="home"
          />
        </>
      )}
    </section>
  );
}

function ArtistCard({
  artist,
  country,
  followed,
  onToggle,
}: {
  artist: string;
  country: ReleaseCountry;
  followed: boolean;
  onToggle: () => void;
}) {
  const initials = artist.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return (
    <article className="artistCard">
      <div className="artistAvatar">{initials}</div>
      <div className="artistCopy"><strong>{artist}</strong><span>{country} · RAP</span><small>Diese Woche</small></div>
      <button type="button" className={followed ? "following" : undefined} onClick={onToggle}>{followed ? "FOLGST DU" : "FOLGEN"}</button>
    </article>
  );
}

function SearchScreen({
  releases,
  savedIds,
  onOpen,
  onToggleSaved,
}: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(() => new Set());
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    if (!normalized) return releases;
    return releases.filter((release) => `${release.title} ${release.artist}`.toLocaleLowerCase("de-DE").includes(normalized));
  }, [query, releases]);
  const trending = useMemo(() => {
    const map = new Map<string, ReleaseCountry>();
    for (const release of releases) if (!map.has(release.artist)) map.set(release.artist, release.country);
    return [...map.entries()].slice(0, 3);
  }, [releases]);

  const toggleFollow = (artist: string) => {
    setFollowedArtists((current) => {
      const next = new Set(current);
      if (next.has(artist)) next.delete(artist); else next.add(artist);
      return next;
    });
  };

  return (
    <section className="screenContent searchScreen">
      <ScreenHeader eyebrow="DISCOVER" title="Suchen" subtitle="Durchsuche alle bestätigten Releases dieser Woche." />
      <label className="searchField">
        <Icon name="search" />
        <input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Künstler, Album oder Single" />
      </label>
      <h2 className="sectionTitle">Artists diese Woche</h2>
      <div className="artistStack">
        {trending.length ? trending.map(([artist, country]) => (
          <ArtistCard key={artist} artist={artist} country={country} followed={followedArtists.has(artist)} onToggle={() => toggleFollow(artist)} />
        )) : <EmptyState title="Noch keine Artists" body="Sobald Releases bestätigt sind, erscheinen die Artists hier." icon="profile" />}
      </div>
      <h2 className="sectionTitle searchResultsTitle">{query ? "Suchergebnisse" : "Alle Releases"}</h2>
      <div className="releaseStack">
        {results.length ? results.map((release) => (
          <ReleaseRow
            key={release.id}
            release={release}
            saved={savedIds.has(release.id)}
            onOpen={() => onOpen(release)}
            onToggleSaved={() => onToggleSaved(release.id)}
          />
        )) : <EmptyState title="Nichts gefunden" body="Probiere einen anderen Künstler oder Titel." />}
      </div>
    </section>
  );
}

function SavedScreen({
  releases,
  savedIds,
  onOpen,
  onToggleSaved,
}: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const [filter, setFilter] = useState<SavedFilter>("upcoming");
  const now = useClock();
  const saved = releases.filter((release) => savedIds.has(release.id));
  const visible = saved.filter((release) => {
    if (filter === "all") return true;
    const live = isReleaseLive(release, now);
    return filter === "live" ? live : !live;
  });
  const friday = releases[0]?.releaseDate ? formatReleaseDate(releases[0].releaseDate) : "kommender Freitag";
  const editorial = visible[0] ?? saved[0];

  return (
    <section className="screenContent savedScreen">
      <ScreenHeader eyebrow="DEINE WOCHE" title="Gespeichert" subtitle={`${pluralizeReleases(saved.length)} · ${friday}`} />
      <FilterPills
        value={filter}
        label="Gespeicherte Releases filtern"
        onChange={setFilter}
        items={[
          { value: "upcoming", label: "Upcoming" },
          { value: "live", label: "Live" },
          { value: "all", label: "Alle" },
        ]}
      />
      <h2 className="sectionTitle">Diese Woche</h2>
      <div className="releaseStack">
        {visible.length ? visible.map((release) => (
          <ReleaseRow
            key={release.id}
            release={release}
            saved
            onOpen={() => onOpen(release)}
            onToggleSaved={() => onToggleSaved(release.id)}
          />
        )) : <EmptyState title="Keine Releases hier" body="Speichere einen Release oder wechsle den Filter." icon="star" />}
      </div>
      {editorial ? (
        <article className="editorialCard">
          <Artwork release={editorial} />
          <div><span>WARUM ES SPANNEND IST</span><h3>{editorial.title}</h3><p>{editorial.description ?? `${editorial.artist} veröffentlicht am ${formatReleaseDate(editorial.releaseDate)}.`}</p></div>
        </article>
      ) : null}
    </section>
  );
}

function ToggleRow({ title, subtitle, enabled, onToggle }: { title: string; subtitle: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="settingsRow" onClick={onToggle} aria-pressed={enabled}>
      <span><strong>{title}</strong><small>{subtitle}</small></span>
      <i className={`toggle ${enabled ? "enabled" : ""}`}><b /></i>
    </button>
  );
}

function ProfileScreen({ savedCount, metadata }: { savedCount: number; metadata?: ReleaseDataMetadata }) {
  const [reminders, setReminders] = useState(true);
  const [briefing, setBriefing] = useState(true);
  const [region, setRegion] = useState<"DE + US" | ReleaseCountry>("DE + US");
  const cycleRegion = () => setRegion((current) => current === "DE + US" ? "DE" : current === "DE" ? "US" : "DE + US");

  return (
    <section className="screenContent profileScreen">
      <ScreenHeader eyebrow="ACCOUNT" title="Profil" />
      <article className="profileCard">
        <div className="profileAvatar">JP</div>
        <div><strong>Janus</strong><span>DEUTSCHRAP · US RAP · MELODIC</span><small>{pluralizeReleases(savedCount)} gespeichert</small></div>
      </article>
      <h2 className="sectionTitle settingsTitle">Einstellungen</h2>
      <div className="settingsStack">
        <ToggleRow title="Release-Erinnerungen" subtitle="Donnerstag am Abend" enabled={reminders} onToggle={() => setReminders((value) => !value)} />
        <div className="settingsRow settingsStatic">
          <span><strong>Streaming-Dienste</strong><small>Spotify, Apple Music, YouTube</small></span><Icon name="external" />
        </div>
        <button type="button" className="settingsRow" onClick={cycleRegion}>
          <span><strong>Region</strong><small>{region === "DE + US" ? "Deutschland + USA" : countryLabels[region]}</small></span><em>{region}</em>
        </button>
        <ToggleRow title="Editorial Briefing" subtitle="Warum diese Releases wichtig sind" enabled={briefing} onToggle={() => setBriefing((value) => !value)} />
      </div>
      <div className="versionCard">
        <strong>Release Friday · Prototype 0.4</strong>
        <span>Datenstand: {formatGeneratedAt(metadata?.generatedAt)}</span>
        {metadata ? <small>{metadata.fetchedCount} automatisch · {metadata.curatedCount} kuratiert</small> : null}
      </div>
    </section>
  );
}

function StreamingLink({ href, children, primary = false }: { href?: string; children: ReactNode; primary?: boolean }) {
  if (!href) return <span className={`streamingLink disabled ${primary ? "primary" : ""}`}>{children}<small>Noch nicht verfügbar</small></span>;
  return <a className={`streamingLink ${primary ? "primary" : ""}`} href={href} target="_blank" rel="noreferrer">{children}<Icon name="external" size={18} /></a>;
}

function DetailScreen({
  release,
  saved,
  onBack,
  onToggleSaved,
}: {
  release: MusicRelease;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
}) {
  const now = useClock();
  const live = isReleaseLive(release, now);
  const trackText = release.trackCount ? ` · ${release.trackCount} ${release.trackCount === 1 ? "TRACK" : "TRACKS"}` : "";

  return (
    <section className="detailScreen">
      <div className="detailGlow" />
      <div className="detailTopbar">
        <button type="button" onClick={onBack} aria-label="Zurück"><Icon name="back" /></button>
        <button type="button" className={saved ? "saved" : undefined} onClick={onToggleSaved} aria-label={saved ? "Aus Gespeichert entfernen" : "Speichern"}><Icon name="star" /></button>
      </div>
      <Artwork release={release} />
      <div className="detailBody">
        <span className={`livePill ${live ? "isLive" : ""}`}><i />{live ? "NOW LIVE" : "UPCOMING"}</span>
        <p className="detailMeta">{release.country} · {kindLabels[release.kind]}{trackText}</p>
        <h1>{release.title}</h1>
        <p className="detailArtist">{release.artist}</p>
        <span className="detailEyebrow">WARUM ES SPANNEND IST</span>
        <p className="detailDescription">{release.description ?? `${release.artist} veröffentlicht ${release.kind === "single" ? "eine neue Single" : "ein neues Projekt"} am ${formatReleaseDate(release.releaseDate)}.`}</p>
        <div className="streamingActions">
          <StreamingLink href={release.spotifyUrl} primary>Auf Spotify anhören</StreamingLink>
          <StreamingLink href={release.appleMusicUrl}>Apple Music</StreamingLink>
          <StreamingLink href={release.youtubeUrl}>YouTube öffnen</StreamingLink>
        </div>
        <p className="sourceNote">Quelle: {release.source}</p>
      </div>
    </section>
  );
}

function PrototypeShell({ children, active, onTabChange, showNav = true }: { children: ReactNode; active: Tab; onTabChange: (tab: Tab) => void; showNav?: boolean }) {
  const now = useClock();
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(now);
  return (
    <main className="prototypePage">
      <div className="prototypePhone">
        <div className="statusBar"><strong>{time}</strong><span>● ◌ ▬</span></div>
        {children}
        {showNav ? <BottomNav active={active} onChange={onTabChange} /> : null}
      </div>
    </main>
  );
}

function loadSavedIds(releases: MusicRelease[]) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem("release-friday:saved") ?? "[]") as string[];
    const validIds = new Set(releases.map((release) => release.id));
    return new Set(parsed.filter((id) => validIds.has(id)));
  } catch {
    return new Set<string>();
  }
}

export function PrototypeClient({ releases, metadata }: PrototypeClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("releases");
  const [selectedRelease, setSelectedRelease] = useState<MusicRelease | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => setSavedIds(loadSavedIds(releases)), [releases]);
  useEffect(() => {
    window.localStorage.setItem("release-friday:saved", JSON.stringify([...savedIds]));
  }, [savedIds]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const changeTab = (tab: Tab) => {
    setSelectedRelease(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRelease = (release: MusicRelease) => {
    setSelectedRelease(release);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validSavedCount = releases.filter((release) => savedIds.has(release.id)).length;
  let content: ReactNode;

  if (selectedRelease) {
    content = <DetailScreen release={selectedRelease} saved={savedIds.has(selectedRelease.id)} onBack={() => setSelectedRelease(null)} onToggleSaved={() => toggleSaved(selectedRelease.id)} />;
  } else if (activeTab === "search") {
    content = <SearchScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "saved") {
    content = <SavedScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "profile") {
    content = <ProfileScreen savedCount={validSavedCount} metadata={metadata} />;
  } else {
    content = <HomeScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  }

  return <PrototypeShell active={activeTab} onTabChange={changeTab} showNav={!selectedRelease}>{content}</PrototypeShell>;
}
