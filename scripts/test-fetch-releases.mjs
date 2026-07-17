import assert from "node:assert/strict";

process.env.ALLOW_SPOTIFY_ARTIST_IMAGE_FALLBACK = "1";
process.env.REFRESH_ARTIST_IMAGE_COVERS = "1";
const {
  artistFallbackCutoffOpen,
  candidatesNeedingCoverLookup,
  getCurrentOrUpcomingFriday,
  loadStoredReleases,
  primaryArtistName,
  releaseLookupMarkets,
  searchSpotifyArtistImage,
} = await import("./fetch-releases.mjs?artist-image-test");
const {
  hasInvalidArtistProfileReleaseUrl,
  isArtistImageFallbackReplacement,
  spotifyReleaseUrlForStorage,
} = await import("./release-sync-policy.mjs");
const originalFetch = globalThis.fetch;

const release = {
  artist: "Apsilon, Berq",
  title: "Kaputte Diamanten",
  releaseDate: "2026-07-17",
  country: "DE",
  kind: "single",
  source: "r/GermanRap",
  description: "Apsilon und Berq veröffentlichen die Single „Kaputte Diamanten“.",
};

try {
  assert.equal(primaryArtistName(release.artist), "Apsilon");
  assert.equal(primaryArtistName("Farid Bang feat. Miami Yacine"), "Farid Bang");
  assert.equal(artistFallbackCutoffOpen("2026-07-17", new Date("2026-07-16T16:29:00Z")), false);
  assert.equal(artistFallbackCutoffOpen("2026-07-17", new Date("2026-07-16T16:30:00Z")), true);
  assert.equal(artistFallbackCutoffOpen("2026-07-17", new Date("2026-07-17T00:00:00Z")), true);
  assert.equal(getCurrentOrUpcomingFriday(new Date("2026-07-16T12:00:00Z")), "2026-07-17");
  assert.equal(getCurrentOrUpcomingFriday(new Date("2026-07-16T22:02:00Z")), "2026-07-17");
  assert.deepEqual(releaseLookupMarkets("2026-07-17", "DE", "2026-07-16"), ["NZ", "AU"]);
  assert.deepEqual(releaseLookupMarkets("2026-07-17", "DE", "2026-07-17"), ["DE", "NZ", "AU"]);
  assert.equal(await loadStoredReleases("2026-07-17"), null);
  assert.deepEqual(candidatesNeedingCoverLookup([
    release,
    { ...release, artist: "Olexesh", title: "Mehr von dir" },
    { ...release, artist: "Pashanim", title: "Augenblick" },
  ], [
    { ...release, coverUrl: "https://example.com/release.jpg", source: "r/GermanRap + Spotify DE" },
    { ...release, artist: "Olexesh", title: "Mehr von dir", coverUrl: "https://example.com/artist.jpg", source: "r/GermanRap + Spotify artist image fallback" },
  ]).map(({ artist, title }) => `${artist} — ${title}`), [
    "Olexesh — Mehr von dir",
    "Pashanim — Augenblick",
  ]);
  assert.equal(isArtistImageFallbackReplacement(
    { source: "r/GermanRap + Spotify artist image fallback" },
    { source: "r/GermanRap + Spotify DE" },
  ), true);
  assert.equal(isArtistImageFallbackReplacement(
    { source: "Manual" },
    { source: "r/GermanRap + Spotify DE" },
  ), false);
  assert.equal(spotifyReleaseUrlForStorage({
    source: "r/GermanRap + Spotify artist image fallback",
    spotifyUrl: "https://open.spotify.com/artist/exact",
  }), null);
  assert.equal(spotifyReleaseUrlForStorage({
    source: "r/GermanRap + Spotify DE",
    spotifyUrl: "https://open.spotify.com/album/exact",
  }), "https://open.spotify.com/album/exact");
  assert.equal(hasInvalidArtistProfileReleaseUrl({
    source: "r/GermanRap + Spotify artist image fallback",
    spotify_url: "https://open.spotify.com/artist/exact",
  }), true);

  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v1/search");
    assert.equal(url.searchParams.get("q"), "artist:Apsilon");
    assert.equal(url.searchParams.get("type"), "artist");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return new Response(JSON.stringify({
      artists: {
        items: [
          {
            name: "Apsilon Tribute",
            images: [{ url: "https://i.scdn.co/image/wrong" }],
            external_urls: { spotify: "https://open.spotify.com/artist/wrong" },
          },
          {
            name: "Apsilon",
            images: [{ url: "https://i.scdn.co/image/exact" }],
            external_urls: { spotify: "https://open.spotify.com/artist/exact" },
          },
        ],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const resolved = await searchSpotifyArtistImage(release, "test-token");
  assert.equal(resolved.coverUrl, "https://i.scdn.co/image/exact");
  assert.equal(resolved.spotifyUrl, undefined);
  assert.match(resolved.source, /Spotify artist image fallback/);
  assert.equal(resolved.description, release.description);

  globalThis.fetch = async () => new Response(JSON.stringify({
    artists: {
      items: [{
        name: "Apsilon Tribute",
        images: [{ url: "https://i.scdn.co/image/wrong" }],
        external_urls: { spotify: "https://open.spotify.com/artist/wrong" },
      }],
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
  assert.equal(await searchSpotifyArtistImage(release, "test-token"), null);

  globalThis.fetch = async () => new Response("", {
    status: 429,
    statusText: "Too Many Requests",
    headers: { "retry-after": "3600" },
  });
  const rateLimitStartedAt = Date.now();
  await assert.rejects(() => searchSpotifyArtistImage(release, "test-token"), /429 Too Many Requests/);
  assert(Date.now() - rateLimitStartedAt < 1000, "Refresh lookup did not fail fast on a long Spotify rate limit.");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Spotify artist image fallback tests passed.");
