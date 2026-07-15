import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3000/Release-Friday/";
const outputDir = "qa-output";
await mkdir(outputDir, { recursive: true });

const report = {
  testedAt: new Date().toISOString(),
  baseUrl,
  viewport: { width: 390, height: 844 },
  consoleErrors: [],
  pageErrors: [],
  checkpoints: {},
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: report.viewport,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) report.consoleErrors.push({ type: message.type(), text: message.text() });
});
page.on("pageerror", (error) => report.pageErrors.push(error.message));

async function text(selector) {
  const locator = page.locator(selector).first();
  return (await locator.count()) ? (await locator.innerText()).trim() : null;
}

async function count(selector) {
  return page.locator(selector).count();
}

async function settle() {
  await page.waitForTimeout(350);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await settle();
await page.screenshot({ path: `${outputDir}/01-drop-mobile.png`, fullPage: true });

report.checkpoints.drop = {
  wordmark: await text(".wordmark"),
  tape: await text(".tapeStrip"),
  featuredTitle: await text(".heroCopy h1"),
  featuredArtist: await text(".heroCopy > span"),
  navigation: await page.locator(".tapeNav button").allInnerTexts(),
};
assert(report.checkpoints.drop.wordmark?.includes("RELEASE"), "Midnight Tape wordmark is missing.");
assert(report.checkpoints.drop.featuredTitle?.toUpperCase() === "EUROSPORT 2", "The approved German release is not featured.");
assert(report.checkpoints.drop.navigation.join(" ") === "DROP FIND STASH ME", "The approved navigation labels are not present.");

const germanyButton = page.getByRole("button", { name: "DE", exact: true });
await germanyButton.click();
await settle();
const germanyCover = page.locator(".dropHero .tapeCover img");
await germanyCover.waitFor({ state: "visible" });
await page.screenshot({ path: `${outputDir}/02-filter-de.png`, fullPage: true });
report.checkpoints.germanyFilter = {
  selected: await germanyButton.getAttribute("aria-pressed"),
  featuredVisible: await count(".dropHero"),
  featuredTitle: await text(".heroCopy h1"),
  coverSrc: await germanyCover.getAttribute("src"),
  coverLoaded: await germanyCover.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
};
assert(report.checkpoints.germanyFilter.featuredVisible === 1, "DE filter does not show the German release.");
assert(report.checkpoints.germanyFilter.featuredTitle?.toUpperCase() === "EUROSPORT 2", "DE filter shows the wrong release.");
assert(report.checkpoints.germanyFilter.coverSrc?.startsWith("data:image/webp;base64,"), "The supplied Eurosport 2 cover is not embedded.");
assert(report.checkpoints.germanyFilter.coverLoaded, "The supplied Eurosport 2 cover does not render.");

await page.locator(".dropHero").click();
await settle();
const germanySpotifyLink = page.getByRole("link", { name: "OPEN SPOTIFY", exact: true });
report.checkpoints.germanyDetail = {
  heading: await text(".detailBody h1"),
  spotifyHref: await germanySpotifyLink.getAttribute("href"),
};
assert(report.checkpoints.germanyDetail.heading?.toUpperCase() === "EUROSPORT 2", "The German release detail is incorrect.");
assert(report.checkpoints.germanyDetail.spotifyHref === "https://open.spotify.com/search/Azet%20Dardan%20Eurosport%202", "Eurosport 2 points at the wrong Spotify release.");
await page.locator(".detailToolbar button").first().click();
await settle();

await germanyButton.click();
await settle();
const erabiRow = page.getByRole("button", { name: "Endgame öffnen", exact: true });
assert(await erabiRow.count() === 1, "Erabi — Endgame is missing from the German releases.");
await erabiRow.click();
await settle();
const erabiCover = page.locator(".detailCover img");
await erabiCover.waitFor({ state: "visible" });
await erabiCover.evaluate((image) => image.decode());
const erabiPreSaveLink = page.locator("a.spotifyPreSave");
const erabiSpotifyLink = page.getByRole("link", { name: "OPEN SPOTIFY", exact: true });
report.checkpoints.erabi = {
  heading: await text(".detailBody h1"),
  artist: await text(".artistTag"),
  meta: await text(".detailMeta"),
  preSaveHref: await erabiPreSaveLink.getAttribute("href"),
  spotifyHref: await erabiSpotifyLink.getAttribute("href"),
  coverLoaded: await erabiCover.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
};
assert(report.checkpoints.erabi.heading?.toUpperCase() === "ENDGAME", "Erabi release detail is incorrect.");
assert(report.checkpoints.erabi.artist?.toUpperCase() === "ERABI", "Erabi release artist is incorrect.");
assert(report.checkpoints.erabi.meta?.includes("DE · EP · 6 TRACKS"), "Erabi release is missing its DE EP and 6-track metadata.");
assert(report.checkpoints.erabi.preSaveHref === "https://open.spotify.com/album/0Smo8Rf3BFzK1mQVEIwO4s", "Erabi pre-save does not use the supplied Spotify album link.");
assert(report.checkpoints.erabi.spotifyHref === "https://open.spotify.com/album/0Smo8Rf3BFzK1mQVEIwO4s", "Erabi Spotify action does not use the supplied album link.");
assert(report.checkpoints.erabi.coverLoaded, "Erabi album cover does not render.");
await page.locator(".detailToolbar button").first().click();
await settle();

const usaButton = page.getByRole("button", { name: "US", exact: true });
await usaButton.click();
await settle();
assert(await count(".dropHero") === 1, "US filter does not restore the release.");

const larryJuneRow = page.getByRole("button", { name: "Who Coppin öffnen", exact: true });
assert(await larryJuneRow.count() === 1, "Larry June — Who Coppin is missing from the US releases.");
await larryJuneRow.click();
await settle();
const larryJuneCover = page.locator(".detailCover img");
await larryJuneCover.waitFor({ state: "visible" });
await larryJuneCover.evaluate((image) => image.decode());
const larryJuneSpotifyLink = page.getByRole("link", { name: "OPEN SPOTIFY", exact: true });
report.checkpoints.larryJune = {
  heading: await text(".detailBody h1"),
  artist: await text(".artistTag"),
  meta: await text(".detailMeta"),
  spotifyHref: await larryJuneSpotifyLink.getAttribute("href"),
  coverLoaded: await larryJuneCover.evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
};
assert(report.checkpoints.larryJune.heading?.toUpperCase() === "WHO COPPIN", "Larry June release detail is incorrect.");
assert(report.checkpoints.larryJune.artist?.toUpperCase() === "LARRY JUNE", "Larry June release artist is incorrect.");
assert(report.checkpoints.larryJune.meta?.includes("16 TRACKS"), "Larry June release is missing its 16-track metadata.");
assert(report.checkpoints.larryJune.spotifyHref === "https://open.spotify.com/album/30FpY222IPaWUUD71VXbUB", "Larry June release does not use the supplied Spotify album link.");
assert(report.checkpoints.larryJune.coverLoaded, "Larry June album cover does not render.");
await page.locator(".detailToolbar button").first().click();
await settle();
await usaButton.click();
await settle();

assert((await text(".heroCopy h1"))?.toUpperCase() === "AALAM OF GOD", "US filter shows the wrong featured release.");
await page.locator(".dropHero").click();
await settle();
await page.screenshot({ path: `${outputDir}/03-release-detail.png`, fullPage: true });

const spotifyLink = page.getByRole("link", { name: "OPEN SPOTIFY", exact: true });
const appleLink = page.getByRole("link", { name: "APPLE MUSIC", exact: true });
const youtubeLink = page.getByRole("link", { name: "YOUTUBE", exact: true });
report.checkpoints.detail = {
  heading: await text(".detailBody h1"),
  description: await text(".detailDescription"),
  meta: await text(".detailMeta"),
  spotifyHref: await spotifyLink.getAttribute("href"),
  appleHref: await appleLink.getAttribute("href"),
  youtubeHref: await youtubeLink.getAttribute("href"),
  source: await text(".sourceNote"),
};
assert(report.checkpoints.detail.spotifyHref?.startsWith("https://open.spotify.com/"), "Spotify action is not real.");
assert(report.checkpoints.detail.appleHref?.startsWith("https://music.apple.com/"), "Apple Music action is not real.");
assert(report.checkpoints.detail.youtubeHref?.startsWith("https://www.youtube.com/"), "YouTube action is not real.");

const saveButton = page.locator(".detailToolbar button").nth(1);
await saveButton.click();
assert((await saveButton.getAttribute("class"))?.includes("saved"), "Stashing from detail did not update state.");
await page.locator(".detailToolbar button").first().click();
await settle();

await page.getByRole("button", { name: "Find", exact: true }).click();
await settle();
const input = page.getByPlaceholder("ARTIST, ALBUM OR SINGLE");
await input.fill("DJ Khaled");
await settle();
await page.screenshot({ path: `${outputDir}/04-find.png`, fullPage: true });
report.checkpoints.find = {
  heading: await text(".posterTitle"),
  resultTitles: await page.locator(".tapeRow .rowCopy strong").allInnerTexts(),
};
assert(report.checkpoints.find.heading?.includes("FIND"), "Find screen heading is missing.");
assert(report.checkpoints.find.resultTitles.includes("AALAM OF GOD"), "Find screen does not use real release data.");

await page.getByRole("button", { name: "Stash", exact: true }).click();
await settle();
await page.screenshot({ path: `${outputDir}/05-stash.png`, fullPage: true });
report.checkpoints.stash = {
  heading: await text(".posterTitle"),
  titles: await page.locator(".stashCard strong").allInnerTexts(),
  reminder: await text(".reminderCard"),
};
assert(report.checkpoints.stash.titles.length === 1 && report.checkpoints.stash.titles[0] === "AALAM OF GOD", "Stash contains stale or missing data.");
assert(report.checkpoints.stash.reminder?.includes("MIDNIGHT REMINDER"), "Midnight reminder is missing.");

await page.getByRole("button", { name: "Me", exact: true }).click();
await settle();
await page.screenshot({ path: `${outputDir}/06-me.png`, fullPage: true });
report.checkpoints.me = {
  heading: await text(".posterTitle"),
  savedCount: await text(".radarIdentity small"),
  build: await text(".buildCard"),
};
assert(report.checkpoints.me.savedCount?.includes("1 STASHED"), "Profile stash count is incorrect.");
assert(report.checkpoints.me.build?.includes("SOURCES CHECKED"), "Editorial data-mode message is missing.");

const adminLink = page.getByRole("link", { name: /RELEASE ANLEGEN/ });
assert(await adminLink.count() === 1, "The private release editor is not linked from the profile.");
report.checkpoints.adminEntry = {
  href: await adminLink.getAttribute("href"),
};
await adminLink.click();
await page.waitForURL(/\/admin\/?$/);
await settle();
await page.screenshot({ path: `${outputDir}/07-admin-login.png`, fullPage: true });
report.checkpoints.adminLogin = {
  url: page.url(),
  heading: await text(".adminTitle"),
  setupNotice: await text(".adminNotice strong"),
  emailDisabled: await page.locator('input[name="email"]').isDisabled(),
  homeHref: await page.locator(".adminWordmark").getAttribute("href"),
};
assert(report.checkpoints.adminEntry.href?.includes("/admin"), "The profile admin link points to the wrong route.");
assert(report.checkpoints.adminLogin.heading?.replace(/\s+/g, " ").toUpperCase() === "ADMIN LOGIN", "The admin login screen is missing.");
assert(report.checkpoints.adminLogin.setupNotice === "BACKEND NOCH NICHT VERBUNDEN", "The safe unconfigured admin state is missing.");
assert(report.checkpoints.adminLogin.emailDisabled, "The admin login must stay disabled without backend configuration.");
assert(report.checkpoints.adminLogin.homeHref?.endsWith("/Release-Friday/"), "The admin back link does not return to Release Friday.");

const desktop = await context.newPage();
await desktop.setViewportSize({ width: 1280, height: 900 });
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.waitForTimeout(350);
await desktop.screenshot({ path: `${outputDir}/08-drop-desktop.png`, fullPage: true });
report.checkpoints.desktop = {
  bodyScrollWidth: await desktop.evaluate(() => document.body.scrollWidth),
  viewportWidth: await desktop.evaluate(() => window.innerWidth),
  phoneWidth: await desktop.locator(".prototypePhone").evaluate((element) => Math.round(element.getBoundingClientRect().width)),
};

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
assert(report.checkpoints.desktop.bodyScrollWidth <= report.checkpoints.desktop.viewportWidth, "Desktop layout has horizontal overflow.");
assert(
  report.checkpoints.desktop.phoneWidth >= 430
    && report.checkpoints.desktop.phoneWidth <= report.checkpoints.desktop.viewportWidth - 40,
  "Desktop responsive frame width is outside the approved layout range.",
);
assert(report.consoleErrors.length === 0, `Console errors found: ${JSON.stringify(report.consoleErrors)}`);
assert(report.pageErrors.length === 0, `Page errors found: ${JSON.stringify(report.pageErrors)}`);

await browser.close();
console.log(JSON.stringify(report, null, 2));
