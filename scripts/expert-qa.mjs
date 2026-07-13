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
assert(report.checkpoints.drop.featuredTitle === "Aalam of God", "The confirmed real release is not featured.");
assert(report.checkpoints.drop.navigation.join(" ") === "DROP FIND STASH ME", "The approved navigation labels are not present.");

const germanyButton = page.getByRole("button", { name: "DE", exact: true });
await germanyButton.click();
await settle();
await page.screenshot({ path: `${outputDir}/02-filter-de.png`, fullPage: true });
report.checkpoints.germanyFilter = {
  selected: await germanyButton.getAttribute("aria-pressed"),
  featuredVisible: await count(".dropHero"),
  emptyState: await text(".systemState"),
};
assert(report.checkpoints.germanyFilter.featuredVisible === 0, "DE filter still shows a US release.");
assert(report.checkpoints.germanyFilter.emptyState?.includes("NO DE RELEASES"), "DE filter lacks the approved empty state.");

const usaButton = page.getByRole("button", { name: "US", exact: true });
await usaButton.click();
await settle();
assert(await count(".dropHero") === 1, "US filter does not restore the release.");
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

const desktop = await context.newPage();
await desktop.setViewportSize({ width: 1280, height: 900 });
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.waitForTimeout(350);
await desktop.screenshot({ path: `${outputDir}/07-drop-desktop.png`, fullPage: true });
report.checkpoints.desktop = {
  bodyScrollWidth: await desktop.evaluate(() => document.body.scrollWidth),
  viewportWidth: await desktop.evaluate(() => window.innerWidth),
  phoneWidth: await desktop.locator(".prototypePhone").evaluate((element) => Math.round(element.getBoundingClientRect().width)),
};
assert(report.checkpoints.desktop.bodyScrollWidth <= report.checkpoints.desktop.viewportWidth, "Desktop layout has horizontal overflow.");
assert(report.checkpoints.desktop.phoneWidth <= 430, "Desktop phone frame is wider than the approved layout.");
assert(report.consoleErrors.length === 0, `Console errors found: ${JSON.stringify(report.consoleErrors)}`);
assert(report.pageErrors.length === 0, `Page errors found: ${JSON.stringify(report.pageErrors)}`);

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
