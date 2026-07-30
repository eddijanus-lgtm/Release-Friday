import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3000/Release-Friday/";
const outputDir = "qa-output";
const generatedSource = await readFile("lib/releases/real-releases.generated.ts", "utf8");
const targetDate = generatedSource.match(/"targetDate":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
if (!targetDate) throw new Error("Generated target date is missing.");

function atUtcNoon(isoDate) {
  return `${isoDate}T12:00:00Z`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
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

async function freezeClock(context, isoTimestamp) {
  await context.addInitScript(({ isoTimestamp }) => {
    const NativeDate = Date;
    const frozenTime = new NativeDate(isoTimestamp).getTime();

    class FrozenDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [frozenTime]));
      }

      static now() {
        return frozenTime;
      }
    }

    window.Date = FrozenDate;
  }, { isoTimestamp });
}

const gateContext = await browser.newContext({
  viewport: report.viewport,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
});
await freezeClock(gateContext, atUtcNoon(addDays(targetDate, -5)));
const gatePage = await gateContext.newPage();
await gatePage.goto(baseUrl, { waitUntil: "networkidle" });
await gatePage.waitForTimeout(350);
await gatePage.screenshot({ path: `${outputDir}/00-reveal-countdown-mobile.png`, fullPage: true });
const revealLabel = (await gatePage.locator(".releaseRevealCountdown").innerText()).trim();
report.checkpoints.releaseRevealGate = {
  label: revealLabel,
  featuredCount: await gatePage.locator(".dropHero").count(),
  navigation: await gatePage.locator(".tapeNav button").allInnerTexts(),
};
assert(revealLabel.includes("NEW RELEASES APPEAR IN"), "The Wednesday reveal countdown label is missing.");
assert(report.checkpoints.releaseRevealGate.featuredCount === 0, "A release is visible before the Wednesday reveal.");
assert(report.checkpoints.releaseRevealGate.navigation.join(" ") === "DROP FIND STASH ME", "The countdown navigation labels are incorrect.");
await gateContext.close();

const context = await browser.newContext({
  viewport: report.viewport,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
});
await freezeClock(context, atUtcNoon(targetDate));
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
assert(Boolean(report.checkpoints.drop.featuredTitle), "The current issue has no featured release.");
assert(Boolean(report.checkpoints.drop.featuredArtist), "The current featured artist is missing.");
assert(report.checkpoints.drop.navigation.join(" ") === "DROP FIND STASH ME", "The navigation labels are incorrect.");

const germanyButton = page.getByRole("button", { name: "DE", exact: true });
await germanyButton.click();
await settle();
const germanyTitle = await text(".heroCopy h1");
const germanyArtist = await text(".heroCopy > span");
assert(Boolean(germanyTitle && germanyArtist), "The current issue has no German release.");
const germanHeroCover = page.locator(".dropHero .tapeCover img");
await germanHeroCover.waitFor({ state: "visible" });
await germanHeroCover.evaluate((image) => image.decode());
await page.screenshot({ path: `${outputDir}/02-filter-de.png`, fullPage: true });
assert(await germanyButton.getAttribute("aria-pressed") === "true", "DE filter is not selected.");
assert(Boolean(await germanHeroCover.getAttribute("src")), "The German featured release has no cover source.");

await page.locator(".dropHero").click();
await settle();
const germanDetailCover = page.locator(".detailCover img");
await germanDetailCover.waitFor({ state: "visible" });
await germanDetailCover.evaluate((image) => image.decode());
const germanPreSave = page.locator("a.spotifyPreSave");
report.checkpoints.germanDetail = {
  heading: await text(".detailBody h1"),
  artist: await text(".artistTag"),
  meta: await text(".detailMeta"),
  status: await text(".confirmedLabel"),
  preSaveHref: (await germanPreSave.count()) ? await germanPreSave.getAttribute("href") : null,
  spotifyHref: await page.getByRole("link", { name: "OPEN SPOTIFY", exact: true }).getAttribute("href"),
};
assert(report.checkpoints.germanDetail.heading === germanyTitle, "German release detail title is inconsistent.");
assert(report.checkpoints.germanDetail.artist === germanyArtist, "German release detail artist is inconsistent.");
assert(report.checkpoints.germanDetail.meta?.includes("DE ·"), "German release metadata is incomplete.");
assert(report.checkpoints.germanDetail.preSaveHref === null, "A live release still shows a pre-save link.");
assert(report.checkpoints.germanDetail.spotifyHref?.startsWith("https://open.spotify.com/"), "German Spotify action is not real.");
await page.locator(".detailToolbar button").first().click();
await settle();

const usaButton = page.getByRole("button", { name: "US", exact: true });
await usaButton.click();
await settle();
const usFeatured = page.locator(".dropHero");
if (await usFeatured.count()) {
  await usFeatured.click();
  await settle();
  assert((await text(".detailMeta"))?.includes("US ·"), "US release metadata is incomplete.");
  await page.locator(".detailToolbar button").first().click();
  await settle();
} else {
  assert((await text(".systemState"))?.includes("NO US RELEASES YET"), "US empty state is missing.");
}

await germanyButton.click();
await settle();
await page.locator(".dropHero").click();
await settle();
await page.screenshot({ path: `${outputDir}/03-release-detail.png`, fullPage: true });
const saveButton = page.locator(".detailToolbar button").nth(1);
await saveButton.click();
assert((await saveButton.getAttribute("class"))?.includes("saved"), "Stashing from detail did not update state.");
await page.locator(".detailToolbar button").first().click();
await settle();

await page.getByRole("button", { name: "Find", exact: true }).click();
await settle();
const input = page.getByPlaceholder("ARTIST, ALBUM OR SINGLE");
await input.fill(germanyArtist);
await settle();
await page.screenshot({ path: `${outputDir}/04-find.png`, fullPage: true });
const findTitles = await page.locator(".tapeRow .rowCopy strong").allInnerTexts();
assert(findTitles.includes(germanyTitle), "Find screen does not use current release data.");

await page.getByRole("button", { name: "Stash", exact: true }).click();
await settle();
await page.screenshot({ path: `${outputDir}/05-stash.png`, fullPage: true });
const stashTitles = await page.locator(".stashCard strong").allInnerTexts();
assert(stashTitles.length === 1 && stashTitles[0] === germanyTitle, "Stash contains stale or missing data.");
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
await page.screenshot({ path: `${outputDir}/07-release-inbox-mobile.png`, fullPage: true });
assert((await text(".adminTitle"))?.replace(/\s+/g, " ").toUpperCase() === "PRÜFEN. FREIGEBEN.", "The release inbox is missing.");
assert((await text(".inboxStats"))?.includes("3 gefunden"), "The inbox summary is incorrect.");
assert(await page.locator(".inboxCandidate").count() === 2, "Problem-first filtering is incorrect.");
await page.getByRole("button", { name: "ALLE 3", exact: true }).click();
await settle();
assert(await page.locator(".inboxCandidate").count() === 3, "The all-candidates filter is incorrect.");
await page.getByRole("button", { name: "KORRIGIEREN", exact: true }).first().click();
await settle();
assert(await page.locator(".inboxEditForm").count() === 1, "Inline candidate editing did not open.");
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

const tablet = await context.newPage();
await tablet.setViewportSize({ width: 834, height: 1194 });
await tablet.goto(`${baseUrl}admin/`, { waitUntil: "networkidle" });
await tablet.waitForTimeout(350);
await tablet.screenshot({ path: `${outputDir}/09-release-inbox-tablet.png`, fullPage: true });
report.checkpoints.inbox = {
  mobileCandidates: 3,
  inlineEditorOpen: true,
  tabletBodyScrollWidth: await tablet.evaluate(() => document.body.scrollWidth),
  tabletViewportWidth: await tablet.evaluate(() => window.innerWidth),
};
assert(report.checkpoints.inbox.tabletBodyScrollWidth <= report.checkpoints.inbox.tabletViewportWidth, "Tablet inbox has horizontal overflow.");
assert(report.consoleErrors.length === 0, `Console errors found: ${JSON.stringify(report.consoleErrors)}`);
assert(report.pageErrors.length === 0, `Page errors found: ${JSON.stringify(report.pageErrors)}`);

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
