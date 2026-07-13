import type { Release } from "@/types/release";

type ReleaseCardProps = {
  release: Release;
};

export function ReleaseCard({ release }: ReleaseCardProps) {
  return (
    <article className="releaseCard">
      <div className="cover" aria-hidden="true">
        {release.artist.slice(0, 2).toUpperCase()}
      </div>

      <div className="releaseInfo">
        <span className="releaseMeta">
          {release.country} · {release.type}
        </span>
        <h2>{release.title}</h2>
        <p>{release.artist}</p>
      </div>

      <button className="more" type="button" aria-label={`Details zu ${release.title}`}>
        <span aria-hidden="true">›</span>
      </button>
    </article>
  );
}
