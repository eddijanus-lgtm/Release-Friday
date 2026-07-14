import { readFile, writeFile, rm } from "node:fs/promises";

async function replaceOrFail(path, search, replacement) {
  const current = await readFile(path, "utf8");
  if (!current.includes(search)) {
    throw new Error(`Expected text not found in ${path}`);
  }
  await writeFile(path, current.replace(search, replacement));
}

await replaceOrFail(
  "types/release.ts",
  "  spotifyUrl?: string;\n  appleMusicUrl?: string;",
  "  spotifyUrl?: string;\n  spotifyPreSaveUrl?: string;\n  appleMusicUrl?: string;",
);

await replaceOrFail(
  "app/prototype-client.tsx",
  "  const trackText = release.trackCount ? ` · ${release.trackCount} ${release.trackCount === 1 ? \"TRACK\" : \"TRACKS\"}` : \"\";",
  "  const trackText = release.trackCount ? ` · ${release.trackCount} ${release.trackCount === 1 ? \"TRACK\" : \"TRACKS\"}` : \"\";\n  const canPreSave = !live && Boolean(release.spotifyPreSaveUrl);",
);

await replaceOrFail(
  "app/prototype-client.tsx",
  `        <div className="streamGrid">\n          {release.spotifyUrl ? <a className="primary" href={release.spotifyUrl} target="_blank" rel="noreferrer">OPEN SPOTIFY</a> : <span className="disabled">SPOTIFY UNAVAILABLE</span>}\n          {release.appleMusicUrl ? <a href={release.appleMusicUrl} target="_blank" rel="noreferrer">APPLE MUSIC</a> : <span className="disabled">APPLE MUSIC</span>}\n          {release.youtubeUrl ? <a href={release.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a> : <span className="disabled">YOUTUBE</span>}\n        </div>`,
  `        <div className="streamGrid">\n          {!live ? (\n            canPreSave ? (\n              <a className="spotifyPreSave" href={release.spotifyPreSaveUrl} target="_blank" rel="noreferrer">\n                <strong>PRE-SAVE ON SPOTIFY</strong><small>OFFICIAL COUNTDOWN</small>\n              </a>\n            ) : (\n              <span className="spotifyPreSave disabled" aria-disabled="true">\n                <strong>SPOTIFY PRE-SAVE</strong><small>LINK NOT LIVE YET</small>\n              </span>\n            )\n          ) : null}\n          {release.spotifyUrl ? <a className="primary" href={release.spotifyUrl} target="_blank" rel="noreferrer">OPEN SPOTIFY</a> : <span className="disabled">SPOTIFY UNAVAILABLE</span>}\n          {release.appleMusicUrl ? <a href={release.appleMusicUrl} target="_blank" rel="noreferrer">APPLE MUSIC</a> : <span className="disabled">APPLE MUSIC</span>}\n          {release.youtubeUrl ? <a href={release.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a> : <span className="disabled">YOUTUBE</span>}\n        </div>`,
);

await replaceOrFail(
  "app/globals.css",
  `.streamGrid .primary { grid-column: 1 / -1; border-color: var(--lime); background: var(--lime); color: #050805; }\n.streamGrid .disabled { color: var(--muted-2); }`,
  `.streamGrid .primary { grid-column: 1 / -1; border-color: var(--lime); background: var(--lime); color: #050805; }\n.streamGrid .spotifyPreSave {\n  grid-column: 1 / -1;\n  display: grid;\n  min-height: 58px;\n  align-content: center;\n  justify-items: start;\n  gap: 4px;\n  padding: 0 16px;\n  border-color: #1ed760;\n  background: #1ed760;\n  color: #050805;\n  text-align: left;\n}\n.streamGrid .spotifyPreSave strong { font-size: 9px; letter-spacing: .04em; }\n.streamGrid .spotifyPreSave small { font-size: 7px; font-weight: 700; opacity: .72; }\n.streamGrid .spotifyPreSave.disabled {\n  border-color: #354035;\n  border-style: dashed;\n  background: #0b100b;\n  color: #788274;\n}\n.streamGrid .disabled { color: var(--muted-2); }`,
);

await rm("scripts/apply-presave-patch.mjs");
await rm(".github/workflows/apply-presave-patch.yml");
