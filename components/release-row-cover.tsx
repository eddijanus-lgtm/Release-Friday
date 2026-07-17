import type { MusicRelease } from "@/types/release";

export function ReleaseRowCover({ release }: { release: MusicRelease }) {
  if (!release.coverUrl) {
    return (
      <span className="rowCoverThumb isFallback" aria-hidden="true">
        <span>RELEASE</span>
        <span>FRIDAY</span>
      </span>
    );
  }

  return (
    <span className="rowCoverThumb">
      <img src={release.coverUrl} alt="" loading="eager" />
    </span>
  );
}
