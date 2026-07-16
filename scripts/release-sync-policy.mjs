export const SPOTIFY_ARTIST_IMAGE_SOURCE = "Spotify artist image fallback";

export function isArtistImageFallbackReplacement(existingRelease, resolvedRelease) {
  return String(existingRelease?.source ?? "").includes(SPOTIFY_ARTIST_IMAGE_SOURCE)
    && !String(resolvedRelease?.source ?? "").includes(SPOTIFY_ARTIST_IMAGE_SOURCE);
}
