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

export function mergeManualReleases(curated: MusicRelease[], manual: MusicRelease[]) {
  const manualByIdentity = new Map(manual.map((release) => [releaseIdentity(release), release]));
  const merged = curated.map((release) => {
    const identity = releaseIdentity(release);
    const replacement = manualByIdentity.get(identity);
    if (!replacement) return release;
    manualByIdentity.delete(identity);
    return { ...release, ...replacement };
  });

  return [...merged, ...manualByIdentity.values()];
}
