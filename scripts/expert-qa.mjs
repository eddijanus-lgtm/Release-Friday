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
  featuredTitle: await text(".heroCopy h1"),
  featuredArtist: await text(".heroCopy > span"),
  navigation: await page.locator(".tapeNav button").allInnerTexts(),
};
assert(report.checkpoints.drop.wordmark?.includes("RELEASE"), "Midnight Tape wordmark is missing.");
assert(report.checkpoints.drop.featuredTitle?.toUpperCase() === "ENDGAME", "Erabi — Endgame is not featured.");
assert(report.checkpoints.drop.featuredArtist?.toUpperCase() === "ERABI", "The featured German artist is incorrect.");
assert(report.checkpoints.drop.navigation.join(" ") === "DROP FIND STASH ME", "The navigation labels are incorrect.");

const germanyButton = page.getByRole("button", { name: "DE", exact: true });
await germanyButton.click();
await settle();
const erabiHeroCover = page.locator(".dropHero .tapeCover img");
await erabiHeroCover.waitFor({ state: "visible" });
await erabiHeroCover.evaluate((image) => image.decode());
await page.screenshot({ path: `${outputDir}/02-filter-de.png`, fullPage: true });
assert(await germanyButton.getAttribute("aria-pressed") === "true", "DE filter is not selected.");
assert((await text(".heroCopy h1"))?.toUpperCase() === "ENDGAME", "DE filter shows the wrong release.");
assert((await erabiHeroCover.getAttribute("src"))?.startsWith("https://i.scdn.co/image/"), "Erabi uses the wrong cover source.");

await page.locator(".dropHero").click();
await settle();
const erabiCover = page.locator(".detailCover img");
await erabiCover.waitFor({ state: "visible" });
await erabiCover.evaluate((image) => image.decode());
report.checkpoints.erabi = {
  heading: await text(".detailBody h1"),
  artist: await text(".artistTag"),
  meta: await text(".detailMeta"),
  preSaveHref: await page.locator("a.spotifyPreSave").getAttribute("href"),
  spotifyHref: await page.getByRole("link", { name: "OPEN SPOTIFY", exact: true }).getAttribute("href"),
};
assert(report.checkpoints.erabi.heading?.toUpperCase() === "ENDGAME", "Erabi release detail is incorrect.");
assert(report.checkpoints.erabi.artist?.toUpperCase() === "ERABI", "Erabi release artist is incorrect.");
assert(report.checkpoints.erabi.meta?.includes("DE · EP · 6 TRACKS"), "Erabi metadata is incomplete.");
assert(report.checkpoints.erabi.preSaveHref === "https://open.spotify.com/album/0Smo8Rf3BFzK1mQVEIwO4s", "Erabi pre-save link is incorrect.");
assert(report.checkpoints.erabi.spotifyHref === "https://open.spotify.com/album/0Smo8Rf3BFzK1mQVEIwO4s", "Erabi Spotify link is incorrect.");
await page.locator(".detailToolbar button").first().click();
await settle();

const usaButton = page.getByRole("button", { name: "US", exact: true });
await usaButton.click();
await settle();
assert((await text(".heroCopy h1"))?.toUpperCase() === "AALAM OF GOD", "US filter shows the wrong featured release.");
assert(await page.getByRole("button", { name: "Who Coppin öffnen", exact: true }).count() === 1, "Larry June — Who Coppin is missing.");

await page.locator(".dropHero").click();
await settle();
await page.screenshot({ path: `${outputDir}/03-release-detail.png`, fullPage: true });
report.checkpoints.detail = {
  heading: await text(".detailBody h1"),
  spotifyHref: await page.getByRole("link", { name: "OPEN SPOTIFY", exact: true }).getAttribute("href"),
  appleHref: await page.getByRole("link", { name: "APPLE MUSIC", exact: true }).getAttribute("href"),
  youtubeHref: await page.getByRole("link", { name: "YOUTUBE", exact: true }).getAttribute("href"),
};
assert(report.checkpoints.detail.heading?.toUpperCase() === "AALAM OF GOD", "DJ Khaled release detail is incorrect.");
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
const findTitles = await page.locator(".tapeRow .rowCopy strong").allInnerTexts();
assert(findTitles.includes("AALAM OF GOD"), "Find screen does not use current release data.");

await page.getByRole("button", { name: "Stash", exact: true }).click();
await settle();
await page.screenshot({ path: `${outputDir}/05-stash.png`, fullPage: true });
const stashTitles = await page.locator(".stashCard strong").allInnerTexts();
assert(stashTitles.length === 1 && stashTitles[0] === "AALAM OF GOD", "Stash contains stale or missing data.");
assert((await text(".reminderCard"))?.includes("MIDNIGHT REMINDER"), "Midnight reminder is missing.");

await page.getByRole("button", { name: "Me", exact: true }).click();
await settle();
await page.screenshot({ path: `${outputDir}/06-me.png`, fullPage: true });
assert((await text(".radarIdentity small"))?.includes("1 STASHED"), "Profile stash count is incorrect.");
assert((await text(".buildCard"))?.includes("SOURCES CHECKED"), "Editorial data-mode message is missing.");

const adminLink = page.getByRole("link", { name: /RELEASE ANLEGEN/ });
assert(await adminLink.count() === 1, "The private release editor is not linked from the profile.");
await adminLink.click();
await page.waitForURL(/\/admin\/?$/);
await settle();
await page.screenshot({ path: `${outputDir}/07-admin-login.png`, fullPage: true });
assert((await text(".adminTitle"))?.replace(/\s+/g, " ").toUpperCase() === "ADMIN LOGIN", "The admin login screen is missing.");
assert(await text(".adminNotice strong") === "BACKEND NOCH NICHT VERBUNDEN", "The safe unconfigured admin state is missing.");
assert(await page.locator('input[name="email"]').isDisabled(), "Admin login must stay disabled without backend configuration.");
assert((await page.locator(".adminWordmark").getAttribute("href"))?.endsWith("/Release-Friday/"), "The admin back link is incorrect.");

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
assert(report.checkpoints.desktop.bodyScrollWidth <= report.checkpoints.desktop.viewportWidth, "Desktop layout has horizontal overflow.");
assert(report.checkpoints.desktop.phoneWidth >= 430 && report.checkpoints.desktop.phoneWidth <= report.checkpoints.desktop.viewportWidth - 40, "Desktop responsive frame width is outside the approved range.");
assert(report.consoleErrors.length === 0, `Console errors found: ${JSON.stringify(report.consoleErrors)}`);
assert(report.pageErrors.length === 0, `Page errors found: ${JSON.stringify(report.pageErrors)}`);

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
