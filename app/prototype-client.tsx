"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MusicRelease, ReleaseCountry } from "@/types/release";

type Tab = "releases" | "search" | "saved" | "profile";
type CountryFilter = "ALL" | ReleaseCountry;
type SavedFilter = "upcoming" | "live" | "all";

type PrototypeClientProps = {
  releases: MusicRelease[];
};

type IconName = "home" | "search" | "star" | "profile" | "back" | "more" | "heart" | "chevron";

const liveReleaseIds = new Set(["no-sleep"]);

const descriptions: Record<string, string> = {
  "neon-uber-berlin": "Das erste gemeinsame Album seit drei Jahren verbindet melodische Hooks mit einer deutlich dunkleren Berliner Nachtästhetik.",
  "no-sleep": "Ein direkter US-Rap-Track für die Nacht: wenig Pause, viel Druck und ein Refrain, der sofort hängen bleibt.",
  freitag: "Ein kompakter Deutschrap-Single-Release mit warmen Synths und einer Hook für die erste Fahrt ins Wochenende.",
  "north-london": "Melodischer Rap trifft internationalen Club-Sound und eine reduzierte, kalte Produktion.",
  nachtbus: "Eine kurze EP über späte Heimwege, leere Straßen und den Moment zwischen Donnerstag und Freitag.",
};

const artworkThemes: Record<string, string> = {
  "neon-uber-berlin": "artworkMagenta",
  "no-sleep": "artworkBlue",
  freitag: "artworkViolet",
  "north-london": "artworkOrange",
  nachtbus: "artworkCyan",
};

const countryLabels: Record<ReleaseCountry, string> = {
  DE: "Deutschland",
  US: "USA",
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

  if (name === "home") {
    return <svg {...common}><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>;
  }
  if (name === "search") {
    return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  }
  if (name === "star") {
    return <svg {...common}><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z"/></svg>;
  }
  if (name === "profile") {
    return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.2 3.4-6.3 7.5-6.3s6.7 2.1 7.5 6.3"/></svg>;
  }
  if (name === "back") {
    return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
  }
  if (name === "more") {
    return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
  }
  if (name === "heart") {
    return <svg {...common}><path d="M20.8 5.8c-1.9-1.9-5-1.9-6.9 0L12 7.7l-1.9-1.9a4.9 4.9 0 0 0-6.9 6.9L12 21l8.8-8.3a4.9 4.9 0 0 0 0-6.9Z"/></svg>;
  }
  return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
}

function Artwork({ release, compact = false }: { release: MusicRelease; compact?: boolean }) {
  const theme = artworkThemes[release.id] ?? "artworkMagenta";
  return (
    <div className={`releaseArtwork ${theme} ${compact ? "artworkCompact" : ""}`} aria-hidden="true">
      <div className="artGlow" />
      <div className="artBars">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  );
}

function useClock() {
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return time;
}

function useCountdown(releaseDate: string) {
  const [label, setLabel] = useState("--:--:--");
  useEffect(() => {
    const target = new Date(`${releaseDate}T00:00:00`);
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
  const live = liveReleaseIds.has(release.id);
  return (
    <article className="releaseRow">
      <button type="button" className="releaseRowMain" onClick={onOpen} aria-label={`${release.title} von ${release.artist} öffnen`}>
        <Artwork release={release} compact />
        <div className="releaseCopy">
          <span className={`releaseKicker ${live ? "isLive" : ""}`}>{release.country} · {release.kind.toUpperCase()}</span>
          <strong>{release.title}</strong>
          <span>{release.artist}</span>
        </div>
        <div className={`releaseStatus ${live ? "isLive" : ""}`}>{live ? "LIVE" : "00:19"}</div>
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
  return (
    <button type="button" className="featuredRelease" onClick={onOpen}>
      <Artwork release={release} />
      <div className="featuredCopy">
        <span className="releaseKicker">{release.country} · {release.kind.toUpperCase()}</span>
        <h2>{release.title}</h2>
        <p>{release.artist}</p>
        <div className="countdownCard">
          <span><i /> NOCH</span>
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
  const time = useClock();
  const [filter, setFilter] = useState<CountryFilter>("ALL");
  const featured = releases[0];
  const visible = releases.slice(1).filter((release) => filter === "ALL" || release.country === filter);

  return (
    <section className="screenContent homeScreen">
      <ScreenHeader eyebrow={`DONNERSTAG · ${time}`} title="Heute Nacht" subtitle={`${releases.length} Releases warten auf Mitternacht.`} />
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
        {visible.map((release) => (
          <ReleaseRow
            key={release.id}
            release={release}
            saved={savedIds.has(release.id)}
            onOpen={() => onOpen(release)}
            onToggleSaved={() => onToggleSaved(release.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ArtistCard({
  initials,
  name,
  meta,
  followed,
  onToggle,
}: {
  initials: string;
  name: string;
  meta: string;
  followed: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="artistCard">
      <div className="artistAvatar">{initials}</div>
      <div className="artistCopy"><strong>{name}</strong><span>{meta}</span><small>Diese Woche</small></div>
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
  const [followedArtists, setFollowedArtists] = useState(new Set(["Central"]));
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    if (!normalized) return releases.slice(0, 4);
    return releases.filter((release) => `${release.title} ${release.artist}`.toLocaleLowerCase("de-DE").includes(normalized));
  }, [query, releases]);

  const toggleFollow = (artist: string) => {
    setFollowedArtists((current) => {
      const next = new Set(current);
      if (next.has(artist)) next.delete(artist); else next.add(artist);
      return next;
    });
  };

  return (
    <section className="screenContent searchScreen">
      <ScreenHeader eyebrow="DISCOVER" title="Suchen" />
      <label className="searchField">
        <Icon name="search" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Künstler, Album oder Single" />
      </label>
      <h2 className="sectionTitle">Trending Artists</h2>
      <div className="artistStack">
        <ArtistCard initials="LC" name="Luciano" meta="DE · RAP" followed={followedArtists.has("Luciano")} onToggle={() => toggleFollow("Luciano")} />
        <ArtistCard initials="CC" name="Central" meta="UK · RAP" followed={followedArtists.has("Central")} onToggle={() => toggleFollow("Central")} />
      </div>
      <h2 className="sectionTitle searchResultsTitle">{query ? "Suchergebnisse" : "Beliebte Releases"}</h2>
      <div className="releaseStack">
        {results.length ? results.map((release) => (
          <ReleaseRow
            key={release.id}
            release={release}
            saved={savedIds.has(release.id)}
            onOpen={() => onOpen(release)}
            onToggleSaved={() => onToggleSaved(release.id)}
          />
        )) : <div className="emptyState"><Icon name="search" size={30}/><strong>Nichts gefunden</strong><span>Probiere einen anderen Künstler oder Titel.</span></div>}
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
  const saved = releases.filter((release) => savedIds.has(release.id));
  const visible = saved.filter((release) => filter === "all" || (filter === "live" ? liveReleaseIds.has(release.id) : !liveReleaseIds.has(release.id)));
  const friday = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(releases[0].releaseDate));

  return (
    <section className="screenContent savedScreen">
      <ScreenHeader eyebrow="DEINE WOCHE" title="Gespeichert" subtitle={`${saved.length} Releases · ${friday}`} />
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
        )) : <div className="emptyState"><Icon name="star" size={30}/><strong>Keine Releases hier</strong><span>Speichere einen Release oder wechsle den Filter.</span></div>}
      </div>
      <article className="editorialCard">
        <div className="editorialVisual" />
        <div><span>WARUM ES SPANNEND IST</span><h3>Berlin trifft London.</h3><p>Melodischer Rap trifft internationalen Club-Sound.</p></div>
      </article>
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

function ProfileScreen({ savedCount, notify }: { savedCount: number; notify: (message: string) => void }) {
  const [reminders, setReminders] = useState(true);
  const [briefing, setBriefing] = useState(true);
  const [region, setRegion] = useState("DE + US");
  const cycleRegion = () => setRegion((current) => current === "DE + US" ? "DE" : current === "DE" ? "US" : "DE + US");

  return (
    <section className="screenContent profileScreen">
      <ScreenHeader eyebrow="ACCOUNT" title="Profil" />
      <article className="profileCard">
        <div className="profileAvatar">JP</div>
        <div><strong>Janus</strong><span>DEUTSCHRAP · US RAP · MELODIC</span><small>{savedCount} gespeicherte Releases</small></div>
      </article>
      <h2 className="sectionTitle settingsTitle">Einstellungen</h2>
      <div className="settingsStack">
        <ToggleRow title="Release-Erinnerungen" subtitle="Donnerstag um 20:00" enabled={reminders} onToggle={() => setReminders((value) => !value)} />
        <button type="button" className="settingsRow" onClick={() => notify("Streaming-Dienste: Spotify, Apple Music und YouTube")}> 
          <span><strong>Streaming-Dienste</strong><small>Spotify, Apple Music, YouTube</small></span><Icon name="chevron" />
        </button>
        <button type="button" className="settingsRow" onClick={cycleRegion}>
          <span><strong>Region</strong><small>{region === "DE + US" ? "Deutschland + USA" : countryLabels[region as ReleaseCountry]}</small></span><em>{region}</em>
        </button>
        <ToggleRow title="Editorial Briefing" subtitle="Warum diese Releases wichtig sind" enabled={briefing} onToggle={() => setBriefing((value) => !value)} />
      </div>
      <div className="versionCard">Release Friday · Prototype 0.2</div>
    </section>
  );
}

function DetailScreen({
  release,
  saved,
  onBack,
  onToggleSaved,
  notify,
}: {
  release: MusicRelease;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  notify: (message: string) => void;
}) {
  const live = liveReleaseIds.has(release.id);
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
        <p className="detailMeta">{release.country} · {release.kind.toUpperCase()} · {release.kind === "album" ? "14 TRACKS" : "1 TRACK"}</p>
        <h1>{release.title}</h1>
        <p className="detailArtist">{release.artist}</p>
        <span className="detailEyebrow">WARUM ES SPANNEND IST</span>
        <p className="detailDescription">{descriptions[release.id] ?? "Ein Release, den du diesen Freitag auf dem Radar haben solltest."}</p>
        <div className="streamingActions">
          <button type="button" className="primary" onClick={() => notify("Demo: Spotify würde jetzt geöffnet")}>Auf Spotify anhören</button>
          <button type="button" onClick={() => notify("Demo: Apple Music würde jetzt geöffnet")}>Apple Music</button>
          <button type="button" onClick={() => notify("Demo: YouTube würde jetzt geöffnet")}>YouTube öffnen</button>
        </div>
      </div>
    </section>
  );
}

function PrototypeShell({ children, active, onTabChange, showNav = true, toast }: { children: ReactNode; active: Tab; onTabChange: (tab: Tab) => void; showNav?: boolean; toast: string }) {
  return (
    <main className="prototypePage">
      <div className="prototypePhone">
        <div className="statusBar"><strong>23:41</strong><span>● ◌ ▬</span></div>
        {children}
        {showNav ? <BottomNav active={active} onChange={onTabChange} /> : null}
        {toast ? <div className="prototypeToast" role="status">{toast}</div> : null}
      </div>
    </main>
  );
}

export function PrototypeClient({ releases }: PrototypeClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("releases");
  const [selectedRelease, setSelectedRelease] = useState<MusicRelease | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(["neon-uber-berlin", "no-sleep", "freitag"]));
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  let content: ReactNode;
  if (selectedRelease) {
    content = (
      <DetailScreen
        release={selectedRelease}
        saved={savedIds.has(selectedRelease.id)}
        onBack={() => setSelectedRelease(null)}
        onToggleSaved={() => toggleSaved(selectedRelease.id)}
        notify={setToast}
      />
    );
  } else if (activeTab === "search") {
    content = <SearchScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "saved") {
    content = <SavedScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "profile") {
    content = <ProfileScreen savedCount={savedIds.size} notify={setToast} />;
  } else {
    content = <HomeScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  }

  return (
    <PrototypeShell active={activeTab} onTabChange={changeTab} showNav={!selectedRelease} toast={toast}>
      {content}
    </PrototypeShell>
  );
}
