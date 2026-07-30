import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { SPOTIFY_ARTIST_IMAGE_SOURCE, fetchResponse } from "./fetch-releases.mjs";
import {
  candidateToRelease,
  imageFormat,
  mergeSources,
  resolutionDetails,
  warningCodesAfterFailure,
  warningCodesAfterResolution,
} from "./enrich-release-inbox.mjs";

test("official cover resolution clears cover warnings", () => {
  assert.deepEqual(
    warningCodesAfterResolution(["missing_stored_cover", "weak_source"], "official"),
    ["weak_source"],
  );
});

test("artist fallback stays visible for editorial review", () => {
  assert.deepEqual(
    warningCodesAfterResolution(["missing_stored_cover"], "artist_fallback"),
    ["artist_image_fallback"],
  );
});

test("failed lookup is explicit and idempotent", () => {
  assert.deepEqual(
    warningCodesAfterFailure(["missing_stored_cover", "cover_lookup_failed"]),
    ["missing_stored_cover", "cover_lookup_failed"],
  );
});

test("sources retain provenance without duplicates", () => {
  assert.deepEqual(
    mergeSources(
      [{ name: "Reddit", url: "https://example.com/reddit", type: "weekly_thread" }],
      [
        { name: "Reddit", url: "https://example.com/reddit", type: "weekly_thread" },
        { name: "Spotify", url: "https://open.spotify.com/album/abc", type: "catalog_match" },
      ],
    ),
    [
      { name: "Reddit", url: "https://example.com/reddit", type: "weekly_thread" },
      { name: "Spotify", url: "https://open.spotify.com/album/abc", type: "catalog_match" },
    ],
  );
});

test("artist profile URL is provenance, never a release URL", () => {
  const details = resolutionDetails({
    source: `r/GermanRap + ${SPOTIFY_ARTIST_IMAGE_SOURCE}`,
    artistImageSourceUrl: "https://open.spotify.com/artist/abc",
  });
  assert.equal(details.coverKind, "artist_fallback");
  assert.deepEqual(details.source, [{
    name: "Spotify Artist",
    url: "https://open.spotify.com/artist/abc",
    type: "artist_image_fallback",
  }]);
});

test("candidate mapping keeps catalog fields separate", () => {
  assert.deepEqual(
    candidateToRelease({
      artist: "Artist",
      title: "Title",
      release_date: "2026-07-31",
      country: "DE",
      kind: "single",
      spotify_url: null,
      apple_music_url: "https://music.apple.com/de/album/example",
      primary_source: "r/GermanRap",
    }),
    {
      artist: "Artist",
      title: "Title",
      releaseDate: "2026-07-31",
      country: "DE",
      kind: "single",
      coverUrl: undefined,
      spotifyUrl: undefined,
      appleMusicUrl: "https://music.apple.com/de/album/example",
      description: undefined,
      trackCount: undefined,
      source: "r/GermanRap",
    },
  );
});

test("image signatures reject non-images", () => {
  assert.equal(imageFormat(Uint8Array.from([0xff, 0xd8, 0xff])).contentType, "image/jpeg");
  assert.throws(() => imageFormat(new TextEncoder().encode("not an image")));
});

test("permanent catalog request errors fail without repeated retries", async (context) => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "invalid request" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.equal(typeof address, "object");
  await assert.rejects(
    fetchResponse(`http://127.0.0.1:${address.port}/search`, {}, 4),
    /400 Bad Request/,
  );
  assert.equal(requests, 1);
});
