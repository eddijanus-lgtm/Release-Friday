import type { MusicRelease } from "@/types/release";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function releaseIdentity(release: MusicRelease) {
  return [normalize(release.artist), normalize(release.title), release.releaseDate].join("::");
}

function preferDefined<T>(replacement: T | undefined, fallback: T | undefined) {
  return replacement ?? fallback;
}

export function mergeManualReleases(curated: MusicRelease[], manual: MusicRelease[]) {
  const manualByIdentity = new Map(manual.map((release) => [releaseIdentity(release), release]));
  const merged = curated.map((release) => {
    const identity = releaseIdentity(release);
    const replacement = manualByIdentity.get(identity);
    if (!replacement) return release;
    manualByIdentity.delete(identity);

    return {
      ...release,
      ...replacement,
      coverUrl: preferDefined(replacement.coverUrl, release.coverUrl),
      spotifyUrl: preferDefined(replacement.spotifyUrl, release.spotifyUrl),
      spotifyPreSaveUrl: preferDefined(replacement.spotifyPreSaveUrl, release.spotifyPreSaveUrl),
      appleMusicUrl: preferDefined(replacement.appleMusicUrl, release.appleMusicUrl),
      youtubeUrl: preferDefined(replacement.youtubeUrl, release.youtubeUrl),
      sourceUrl: preferDefined(replacement.sourceUrl, release.sourceUrl),
      description: preferDefined(replacement.description, release.description),
      trackCount: preferDefined(replacement.trackCount, release.trackCount),
      genres: replacement.genres?.length ? replacement.genres : release.genres,
    };
  });

  return [...merged, ...manualByIdentity.values()];
}
