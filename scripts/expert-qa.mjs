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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({ path: `${outputDir}/01-home-mobile.png`, fullPage: true });

report.checkpoints.home = {
  heading: await text("h1"),
  subtitle: await text(".screenSubtitle"),
  featuredTitle: await text(".featuredCopy h2"),
  featuredArtist: await text(".featuredCopy p"),
  featuredCountryAndKind: await text(".featuredCopy .releaseKicker"),
  emptyStateVisible: await count(".emptyState"),
};
assert(report.checkpoints.home.featuredTitle === "Aalam of God", "The confirmed real release is not featured.");
assert(report.checkpoints.home.subtitle?.startsWith("1 Release"), "Singular release copy is incorrect.");

const germanyButton = page.getByRole("button", { name: "Deutschland", exact: true });
await germanyButton.click();
await page.screenshot({ path: `${outputDir}/02-filter-germany.png`, fullPage: true });
report.checkpoints.germanyFilter = {
  selected: await germanyButton.getAttribute("aria-pressed"),
  featuredVisible: await count(".featuredRelease"),
  emptyState: await text(".emptyState"),
};
assert(report.checkpoints.germanyFilter.featuredVisible === 0, "Germany filter still shows a US featured release.");
assert(report.checkpoints.germanyFilter.emptyState?.includes("Deutschland"), "Germany filter lacks a useful empty state.");

const usaButton = page.getByRole("button", { name: "USA", exact: true });
await usaButton.click();
assert(await count(".featuredRelease") === 1, "USA filter does not restore the matching featured release.");
await page.locator(".featuredRelease").click();
await page.screenshot({ path: `${outputDir}/03-release-detail.png`, fullPage: true });

const spotifyLink = page.getByRole("link", { name: /Auf Spotify anhören/ });
const appleLink = page.getByRole("link", { name: /Apple Music/ });
const youtubeLink = page.getByRole("link", { name: /YouTube öffnen/ });
report.checkpoints.detail = {
  heading: await text(".detailBody h1"),
  description: await text(".detailDescription"),
  meta: await text(".detailMeta"),
  spotifyHref: await spotifyLink.getAttribute("href"),
  appleHref: await appleLink.getAttribute("href"),
  youtubeHref: await youtubeLink.getAttribute("href"),
  source: await text(".sourceNote"),
};
assert(report.checkpoints.detail.spotifyHref?.startsWith("https://open.spotify.com/"), "Spotify action is not a real external link.");
assert(report.checkpoints.detail.appleHref?.startsWith("https://music.apple.com/"), "Apple Music action is not a real external link.");
assert(report.checkpoints.detail.youtubeHref?.startsWith("https://www.youtube.com/"), "YouTube action is not a real external link.");
assert(!report.checkpoints.detail.meta?.includes("14 TRACKS"), "Unknown track counts are still hard-coded.");

const saveButton = page.locator(".detailTopbar button").nth(1);
await saveButton.click();
assert((await saveButton.getAttribute("class"))?.includes("saved"), "Saving from the detail screen did not update state.");
await page.locator(".detailTopbar button").first().click();

await page.getByRole("button", { name: /Suche/ }).last().click();
const input = page.getByPlaceholder("Künstler, Album oder Single");
await input.fill("DJ Khaled");
await page.screenshot({ path: `${outputDir}/04-search.png`, fullPage: true });
report.checkpoints.search = {
  artistCards: await page.locator(".artistCard .artistCopy strong").allInnerTexts(),
  resultTitles: await page.locator(".releaseRow .releaseCopy strong").allInnerTexts(),
};
assert(report.checkpoints.search.artistCards.includes("DJ Khaled"), "Artist section is still driven by mock artists.");
assert(!report.checkpoints.search.artistCards.includes("Luciano") && !report.checkpoints.search.artistCards.includes("Central"), "Old mock artists remain visible.");

await page.getByRole("button", { name: /Gespeichert/ }).last().click();
await page.screenshot({ path: `${outputDir}/05-saved.png`, fullPage: true });
report.checkpoints.saved = {
  subtitle: await text(".screenSubtitle"),
  titles: await page.locator(".releaseRow .releaseCopy strong").allInnerTexts(),
  editorialTitle: await text(".editorialCard h3"),
};
assert(report.checkpoints.saved.titles.length === 1 && report.checkpoints.saved.titles[0] === "Aalam of God", "Saved list contains stale mock IDs or misses the saved release.");
assert(report.checkpoints.saved.editorialTitle === "Aalam of God", "Saved editorial content is still hard-coded.");

await page.getByRole("button", { name: /Profil/ }).last().click();
await page.screenshot({ path: `${outputDir}/06-profile.png`, fullPage: true });
report.checkpoints.profile = {
  savedCount: await text(".profileCard small"),
  version: await text(".versionCard"),
};
assert(report.checkpoints.profile.savedCount?.startsWith("1 Release"), "Profile saved count includes stale releases.");
assert(report.checkpoints.profile.version?.includes("Datenstand"), "Data freshness is not visible in the profile.");

const desktop = await context.newPage();
await desktop.setViewportSize({ width: 1280, height: 900 });
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `${outputDir}/07-home-desktop.png`, fullPage: true });
report.checkpoints.desktop = {
  bodyScrollWidth: await desktop.evaluate(() => document.body.scrollWidth),
  viewportWidth: await desktop.evaluate(() => window.innerWidth),
  phoneWidth: await desktop.locator(".prototypePhone").evaluate((element) => Math.round(element.getBoundingClientRect().width)),
};
assert(report.checkpoints.desktop.bodyScrollWidth <= report.checkpoints.desktop.viewportWidth, "Desktop layout has horizontal overflow.");
assert(report.consoleErrors.length === 0, `Console errors found: ${JSON.stringify(report.consoleErrors)}`);
assert(report.pageErrors.length === 0, `Page errors found: ${JSON.stringify(report.pageErrors)}`);

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
