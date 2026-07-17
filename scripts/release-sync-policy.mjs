export const SPOTIFY_ARTIST_IMAGE_SOURCE = "Spotify artist image fallback";

export function isArtistImageFallbackRelease(release) {
  return String(release?.source ?? "").includes(SPOTIFY_ARTIST_IMAGE_SOURCE);
}

export function isSpotifyArtistProfileUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.hostname.toLowerCase() === "open.spotify.com"
      && /^\/artist\/[^/]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function spotifyReleaseUrlForStorage(release) {
  const value = release?.spotifyUrl ?? release?.spotify_url ?? null;
  if (isArtistImageFallbackRelease(release) && isSpotifyArtistProfileUrl(value)) return null;
  return value || null;
}

export function hasInvalidArtistProfileReleaseUrl(release) {
  return isArtistImageFallbackRelease(release)
    && isSpotifyArtistProfileUrl(release?.spotify_url ?? release?.spotifyUrl);
}

export function isArtistImageFallbackReplacement(existingRelease, resolvedRelease) {
  return isArtistImageFallbackRelease(existingRelease)
    && !isArtistImageFallbackRelease(resolvedRelease);
}
