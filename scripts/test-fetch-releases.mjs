import assert from "node:assert/strict";

process.env.ALLOW_SPOTIFY_ARTIST_IMAGE_FALLBACK = "1";
const { primaryArtistName, searchSpotifyArtistImage } = await import("./fetch-releases.mjs?artist-image-test");
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
  assert.equal(resolved.spotifyUrl, "https://open.spotify.com/artist/exact");
  assert.match(resolved.source, /Spotify artist image fallback/);
  assert.match(resolved.description, /Spotify-Profilbild von Apsilon/);

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
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Spotify artist image fallback tests passed.");
