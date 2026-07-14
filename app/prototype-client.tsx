"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MusicRelease, ReleaseCountry, ReleaseDataMetadata } from "@/types/release";

type Tab = "drop" | "find" | "stash" | "me";
type Region = "ALL" | ReleaseCountry;

type PrototypeClientProps = {
  releases: MusicRelease[];
  metadata?: ReleaseDataMetadata;
};

const kindLabels: Record<MusicRelease["kind"], string> = {
  album: "ALBUM",
  ep: "EP",
  mixtape: "MIXTAPE",
  single: "SINGLE",
};

const countryLabels: Record<ReleaseCountry, string> = {
  DE: "DEUTSCHLAND",
  US: "USA",
};

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isReleaseLive(release: MusicRelease, now = new Date()) {
  return now.getTime() >= parseLocalDate(release.releaseDate).getTime();
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(value)).toUpperCase();
}

function formatGeneratedAt(value?: string) {
  if (!value) return "NO DATA RUN";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "UNKNOWN";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).toUpperCase();
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useCountdown(date: string) {
  const [label, setLabel] = useState("--:--:--");
  useEffect(() => {
    const update = () => {
      const seconds = Math.max(0, Math.floor((parseLocalDate(date).getTime() - Date.now()) / 1000));
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
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [date]);
  return label;
}

function BrandHeader({ label = "ISSUE 29", date }: { label?: string; date?: string }) {
  return (
    <header className="tapeHeader">
      <div className="wordmark">RELEASE<br />FRIDAY</div>
      <div className="issueMeta"><span>{label}</span><strong>{date ?? "NEXT FRIDAY"}</strong></div>
    </header>
  );
}

function TapeStrip() {
  return <div className="tapeStrip">NEW MUSIC LOADING · DE / USA · MIDNIGHT DROP</div>;
}

function Cover({ release, compact = false }: { release: MusicRelease; compact?: boolean }) {
  return (
    <div className={`tapeCover ${compact ? "isCompact" : ""}`}>
      {release.coverUrl ? (
        <img src={release.coverUrl} alt={`Cover von ${release.title}`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="coverFallback" aria-label={`Noch kein Cover für ${release.title}`}>
          <span>{release.artist}</span><strong>{release.title}</strong><i>RF</i>
        </div>
      )}
    </div>
  );
}

function ConfirmedLabel({ live = false }: { live?: boolean }) {
  return <span className={`confirmedLabel ${live ? "isLive" : ""}`}>{live ? "LIVE NOW" : "CONFIRMED"}</span>;
}

function RegionSwitch({ value, onChange }: { value: Region; onChange: (value: Region) => void }) {
  const options: Array<{ value: Region; label: string }> = [
    { value: "ALL", label: "ALL" },
    { value: "DE", label: "DE" },
    { value: "US", label: "US" },
  ];
  return (
    <div className="regionSwitch" role="group" aria-label="Region filtern">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? "active" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="systemState" role="status">
      <div className="stateRail" />
      <div><strong>{title}</strong><p>{body}</p></div>
      {action && onAction ? <button type="button" onClick={onAction}>{action}</button> : null}
    </section>
  );
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ id: Tab; label: string; aria: string }> = [
    { id: "drop", label: "DROP", aria: "Drop" },
    { id: "find", label: "FIND", aria: "Find" },
    { id: "stash", label: "STASH", aria: "Stash" },
    { id: "me", label: "ME", aria: "Me" },
  ];
  return (
    <nav className="tapeNav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={active === item.id ? "active" : undefined}
          aria-current={active === item.id ? "page" : undefined}
          aria-label={item.aria}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ReleaseListRow({ release, number, saved, onOpen, onToggleSaved }: {
  release: MusicRelease;
  number: number;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <article className="tapeRow">
      <button type="button" className="tapeRowMain" onClick={onOpen} aria-label={`${release.title} öffnen`}>
        <span className="rowNumber">{String(number).padStart(2, "0")}</span>
        <div className="rowCopy"><strong>{release.title}</strong><span>{release.artist}</span></div>
        <span className="rowArrow">→</span>
      </button>
      <button type="button" className={`rowSave ${saved ? "saved" : ""}`} onClick={onToggleSaved} aria-pressed={saved} aria-label={saved ? "Aus Stash entfernen" : "In Stash speichern"}>+</button>
    </article>
  );
}

function HomeScreen({ releases, savedIds, onOpen, onToggleSaved }: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const [region, setRegion] = useState<Region>("ALL");
  const filtered = releases.filter((release) => region === "ALL" || release.country === region);
  const featured = filtered[0];
  const rest = filtered.slice(1);
  const countdown = useCountdown(featured?.releaseDate ?? "2099-01-01");
  const live = featured ? countdown === "LIVE" : false;

  return (
    <section className="tapeScreen dropScreen">
      <BrandHeader date={featured ? formatShortDate(featured.releaseDate) : undefined} />
      <TapeStrip />
      <div className="screenInner">
        <RegionSwitch value={region} onChange={setRegion} />
        {featured ? (
          <>
            <button type="button" className="dropHero" onClick={() => onOpen(featured)}>
              <ConfirmedLabel live={live} />
              <Cover release={featured} />
              <div className="heroCopy">
                <span>{featured.artist}</span>
                <h1>{featured.title}</h1>
                <small>{String(filtered.length).padStart(2, "0")} / RELEASES</small>
              </div>
              <div className="countdownTape"><span>{live ? "AVAILABLE NOW" : "MIDNIGHT IN"}</span><strong>{countdown}</strong></div>
            </button>
            <div className="nextTape">
              <span>NEXT ON TAPE</span>
              <div>{rest.length ? rest.map((release) => <button key={release.id} type="button" onClick={() => onOpen(release)}>{release.artist} — {release.title}</button>) : <small>NO MORE VERIFIED DROPS</small>}</div>
            </div>
            <div className="homeRows">
              {rest.map((release, index) => (
                <ReleaseListRow key={release.id} release={release} number={index + 2} saved={savedIds.has(release.id)} onOpen={() => onOpen(release)} onToggleSaved={() => onToggleSaved(release.id)} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={region === "DE" ? "NO DE RELEASES YET" : region === "US" ? "NO US RELEASES YET" : "NO RELEASES YET"}
            body="The editorial radar is quiet for this region. Verified releases appear here after approval."
          />
        )}
      </div>
    </section>
  );
}

function SearchScreen({ releases, savedIds, onOpen, onToggleSaved }: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    if (!needle) return releases;
    return releases.filter((release) => `${release.title} ${release.artist}`.toLocaleLowerCase("de-DE").includes(needle));
  }, [query, releases]);

  return (
    <section className="tapeScreen findScreen">
      <BrandHeader label="FIND / 29" date={releases[0] ? formatShortDate(releases[0].releaseDate) : undefined} />
      <TapeStrip />
      <div className="screenInner">
        <h1 className="posterTitle">FIND<br />THE DROP</h1>
        <label className="tapeSearch">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ARTIST, ALBUM OR SINGLE" />
        </label>
        <p className="microHeading">{query ? "SEARCH RESULTS" : "TRENDING / VERIFIED"}</p>
        <div className="finderList">
          {results.length ? results.map((release, index) => (
            <ReleaseListRow key={release.id} release={release} number={index + 1} saved={savedIds.has(release.id)} onOpen={() => onOpen(release)} onToggleSaved={() => onToggleSaved(release.id)} />
          )) : <EmptyState title="NOTHING FOUND" body="Try another artist, album or single." />}
        </div>
        <p className="editorialNotice">ONLY RELEASES WITH CHECKED DATE + SOURCE ENTER THE RADAR.</p>
      </div>
    </section>
  );
}

function DetailScreen({ release, saved, onBack, onToggleSaved }: {
  release: MusicRelease;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
}) {
  const now = useClock();
  const live = isReleaseLive(release, now);
  const trackText = release.trackCount ? ` · ${release.trackCount} ${release.trackCount === 1 ? "TRACK" : "TRACKS"}` : "";
  const canPreSave = !live && Boolean(release.spotifyPreSaveUrl);

  return (
    <section className="tapeScreen detailScreen">
      <div className="detailToolbar">
        <button type="button" onClick={onBack}>← BACK TO TAPE</button>
        <button type="button" className={saved ? "saved" : undefined} onClick={onToggleSaved}>{saved ? "✓ STASHED" : "+ STASH"}</button>
      </div>
      <div className="detailCover"><Cover release={release} /></div>
      <div className="detailBody">
        <ConfirmedLabel live={live} />
        <span className="artistTag">{release.artist}</span>
        <h1>{release.title}</h1>
        <p className="detailMeta">{release.country} · {kindLabels[release.kind]}{trackText} · {formatShortDate(release.releaseDate)}</p>
        <p className="detailDescription">{release.description ?? `${release.artist} delivers a verified new ${release.kind} for this Friday's radar.`}</p>
        <div className="streamGrid">
          {!live ? (
            canPreSave ? (
              <a className="spotifyPreSave" href={release.spotifyPreSaveUrl} target="_blank" rel="noreferrer">
                <strong>PRE-SAVE ON SPOTIFY</strong><small>OFFICIAL COUNTDOWN</small>
              </a>
            ) : (
              <span className="spotifyPreSave disabled" aria-disabled="true">
                <strong>SPOTIFY PRE-SAVE</strong><small>LINK NOT LIVE YET</small>
              </span>
            )
          ) : null}
          {release.spotifyUrl ? <a className="primary" href={release.spotifyUrl} target="_blank" rel="noreferrer">OPEN SPOTIFY</a> : <span className="disabled">SPOTIFY UNAVAILABLE</span>}
          {release.appleMusicUrl ? <a href={release.appleMusicUrl} target="_blank" rel="noreferrer">APPLE MUSIC</a> : <span className="disabled">APPLE MUSIC</span>}
          {release.youtubeUrl ? <a href={release.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a> : <span className="disabled">YOUTUBE</span>}
        </div>
        <p className="sourceNote">SOURCE · {release.source}</p>
      </div>
    </section>
  );
}

function StashScreen({ releases, savedIds, onOpen, onToggleSaved }: {
  releases: MusicRelease[];
  savedIds: Set<string>;
  onOpen: (release: MusicRelease) => void;
  onToggleSaved: (id: string) => void;
}) {
  const saved = releases.filter((release) => savedIds.has(release.id));
  return (
    <section className="tapeScreen stashScreen">
      <BrandHeader label={`STASH / ${String(saved.length).padStart(2, "0")}`} date={releases[0] ? formatShortDate(releases[0].releaseDate) : undefined} />
      <TapeStrip />
      <div className="screenInner">
        <h1 className="posterTitle">YOUR<br />STASH</h1>
        <p className="screenLead">{pluralize(saved.length, "VERIFIED RELEASE", "VERIFIED RELEASES")} SAVED FOR FRIDAY</p>
        <div className="stashList">
          {saved.length ? saved.map((release, index) => (
            <article className="stashCard" key={release.id}>
              <button type="button" className="stashOpen" onClick={() => onOpen(release)}>
                <Cover release={release} compact />
                <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{release.title}</strong><small>{release.artist} · {kindLabels[release.kind]}</small></div>
                <b>→</b>
              </button>
              <button type="button" className="stashRemove" onClick={() => onToggleSaved(release.id)}>REMOVE</button>
            </article>
          )) : <EmptyState title="YOUR STASH IS EMPTY" body="Save a verified release and it will wait here for Friday night." />}
        </div>
        <div className="reminderCard"><strong>MIDNIGHT REMINDER IS ON</strong><span>Notification planned for 23:45</span></div>
      </div>
    </section>
  );
}

function SettingRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const content = <><strong>{label}</strong><span>{value}</span></>;
  return onClick ? <button type="button" className="settingRow" onClick={onClick}>{content}</button> : <div className="settingRow">{content}</div>;
}

function ProfileScreen({ releases, savedCount, metadata }: { releases: MusicRelease[]; savedCount: number; metadata?: ReleaseDataMetadata }) {
  const [reminders, setReminders] = useState(true);
  const [region, setRegion] = useState<"DE + USA" | "DE" | "USA">("DE + USA");
  const cycleRegion = () => setRegion((value) => value === "DE + USA" ? "DE" : value === "DE" ? "USA" : "DE + USA");

  return (
    <section className="tapeScreen meScreen">
      <BrandHeader label="ME / LOCAL" date={releases[0] ? formatShortDate(releases[0].releaseDate) : undefined} />
      <TapeStrip />
      <div className="screenInner">
        <h1 className="posterTitle">MY<br />RADAR</h1>
        <article className="radarIdentity"><div>RF</div><span><strong>RELEASE FRIDAY</strong><small>{releases.length} WATCHED · {savedCount} STASHED</small></span></article>
        <p className="microHeading">SETTINGS</p>
        <div className="settingsList">
          <SettingRow label="REGION" value={region} onClick={cycleRegion} />
          <SettingRow label="RELEASE REMINDERS" value={reminders ? "ON" : "OFF"} onClick={() => setReminders((value) => !value)} />
          <SettingRow label="DATA MODE" value="EDITORIAL REVIEW" />
          <SettingRow label="LAST UPDATE" value={formatGeneratedAt(metadata?.generatedAt)} />
        </div>
        <div className="buildCard">BUILD 0.5 · SOURCES CHECKED BEFORE PUBLISH</div>
      </div>
    </section>
  );
}

function PrototypeShell({ active, onTabChange, children }: { active: Tab; onTabChange: (tab: Tab) => void; children: ReactNode }) {
  return (
    <main className="prototypePage">
      <div className="prototypePhone">
        {children}
        <BottomNav active={active} onChange={onTabChange} />
      </div>
    </main>
  );
}

function loadSavedIds(releases: MusicRelease[]) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem("release-friday:saved") ?? "[]") as string[];
    const valid = new Set(releases.map((release) => release.id));
    return new Set(parsed.filter((id) => valid.has(id)));
  } catch {
    return new Set<string>();
  }
}

export function PrototypeClient({ releases, metadata }: PrototypeClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("drop");
  const [selectedRelease, setSelectedRelease] = useState<MusicRelease | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSavedIds(loadSavedIds(releases));
    setHydrated(true);
  }, [releases]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("release-friday:saved", JSON.stringify([...savedIds]));
  }, [savedIds, hydrated]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openRelease = (release: MusicRelease) => {
    setSelectedRelease(release);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeTab = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedRelease(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savedCount = releases.filter((release) => savedIds.has(release.id)).length;
  let content: ReactNode;

  if (selectedRelease) {
    content = <DetailScreen release={selectedRelease} saved={savedIds.has(selectedRelease.id)} onBack={() => setSelectedRelease(null)} onToggleSaved={() => toggleSaved(selectedRelease.id)} />;
  } else if (activeTab === "find") {
    content = <SearchScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "stash") {
    content = <StashScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  } else if (activeTab === "me") {
    content = <ProfileScreen releases={releases} savedCount={savedCount} metadata={metadata} />;
  } else {
    content = <HomeScreen releases={releases} savedIds={savedIds} onOpen={openRelease} onToggleSaved={toggleSaved} />;
  }

  return <PrototypeShell active={activeTab} onTabChange={changeTab}>{content}</PrototypeShell>;
}
