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
  if (["error", "warning"].includes(message.type())) {
    report.consoleErrors.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => report.pageErrors.push(error.message));

async function text(selector) {
  const locator = page.locator(selector).first();
  return (await locator.count()) ? (await locator.innerText()).trim() : null;
}

async function count(selector) {
  return page.locator(selector).count();
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: `${outputDir}/01-home-mobile.png`, fullPage: true });
report.checkpoints.home = {
  documentTitle: await page.title(),
  heading: await text("h1"),
  subtitle: await text(".screenSubtitle"),
  featuredTitle: await text(".featuredCopy h2"),
  featuredArtist: await text(".featuredCopy p"),
  featuredCountryAndKind: await text(".featuredCopy .releaseKicker"),
  additionalReleaseRows: await count(".releaseRow"),
  navItems: await page.locator(".prototypeNav button span").allInnerTexts(),
};

const germanyButton = page.getByRole("button", { name: "Deutschland", exact: true });
if (await germanyButton.count()) {
  await germanyButton.click();
  await page.screenshot({ path: `${outputDir}/02-filter-germany.png`, fullPage: true });
  report.checkpoints.germanyFilter = {
    selected: await germanyButton.getAttribute("aria-pressed"),
    featuredStillVisible: await count(".featuredRelease"),
    featuredCountryAndKind: await text(".featuredCopy .releaseKicker"),
    additionalReleaseRows: await count(".releaseRow"),
    emptyStateVisible: await count(".emptyState"),
  };
}

const usaButton = page.getByRole("button", { name: "USA", exact: true });
if (await usaButton.count()) await usaButton.click();

const featured = page.locator(".featuredRelease").first();
if (await featured.count()) {
  await featured.click();
  await page.screenshot({ path: `${outputDir}/03-release-detail.png`, fullPage: true });
  report.checkpoints.detail = {
    heading: await text(".detailBody h1"),
    artist: await text(".detailArtist"),
    meta: await text(".detailMeta"),
    status: await text(".livePill"),
    description: await text(".detailDescription"),
    actionLabels: await page.locator(".streamingActions button").allInnerTexts(),
    hasArtworkImage: (await count(".releaseArtwork img")) > 0,
    artworkClass: await page.locator(".releaseArtwork").first().getAttribute("class"),
  };

  const oldUrl = page.url();
  const popupPromise = page.waitForEvent("popup", { timeout: 1200 }).catch(() => null);
  const spotifyButton = page.getByRole("button", { name: "Auf Spotify anhören", exact: true });
  if (await spotifyButton.count()) {
    await spotifyButton.click();
    const popup = await popupPromise;
    report.checkpoints.spotifyAction = {
      oldUrl,
      currentUrl: page.url(),
      openedPopup: Boolean(popup),
      toast: await text(".prototypeToast"),
    };
    if (popup) await popup.close();
  }

  const saveButton = page.locator(".detailTopbar button").nth(1);
  report.checkpoints.detailSaveBefore = await saveButton.getAttribute("class");
  await saveButton.click();
  report.checkpoints.detailSaveAfter = await saveButton.getAttribute("class");

  await page.locator(".detailTopbar button").first().click();
}

const searchNav = page.getByRole("button", { name: /Suche/ }).last();
if (await searchNav.count()) {
  await searchNav.click();
  const input = page.getByPlaceholder("Künstler, Album oder Single");
  await input.fill("DJ Khaled");
  await page.screenshot({ path: `${outputDir}/04-search.png`, fullPage: true });
  report.checkpoints.search = {
    trendingArtists: await page.locator(".artistCard .artistCopy strong").allInnerTexts(),
    query: await input.inputValue(),
    resultTitles: await page.locator(".releaseRow .releaseCopy strong").allInnerTexts(),
    resultArtists: await page.locator(".releaseRow .releaseCopy > span:not(.releaseKicker)").allInnerTexts(),
  };
}

const savedNav = page.getByRole("button", { name: /Gespeichert/ }).last();
if (await savedNav.count()) {
  await savedNav.click();
  await page.screenshot({ path: `${outputDir}/05-saved-after-save.png`, fullPage: true });
  report.checkpoints.saved = {
    subtitle: await text(".screenSubtitle"),
    releaseTitles: await page.locator(".releaseRow .releaseCopy strong").allInnerTexts(),
    emptyState: await text(".emptyState"),
    editorialCardVisible: (await count(".editorialCard")) > 0,
  };
}

const profileNav = page.getByRole("button", { name: /Profil/ }).last();
if (await profileNav.count()) {
  await profileNav.click();
  const regionRow = page.getByRole("button", { name: /Region/ });
  const remindersRow = page.getByRole("button", { name: /Release-Erinnerungen/ });
  const regionBefore = await text(".settingsRow:nth-child(3) small");
  if (await regionRow.count()) await regionRow.click();
  const regionAfter = await text(".settingsRow:nth-child(3) small");
  const reminderBefore = await remindersRow.getAttribute("aria-pressed");
  if (await remindersRow.count()) await remindersRow.click();
  const reminderAfter = await remindersRow.getAttribute("aria-pressed");
  await page.screenshot({ path: `${outputDir}/06-profile.png`, fullPage: true });
  report.checkpoints.profile = {
    name: await text(".profileCard strong"),
    savedCountText: await text(".profileCard small"),
    regionBefore,
    regionAfter,
    reminderBefore,
    reminderAfter,
    version: await text(".versionCard"),
  };
}

const desktop = await context.newPage();
await desktop.setViewportSize({ width: 1280, height: 900 });
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `${outputDir}/07-home-desktop.png`, fullPage: true });
report.checkpoints.desktop = {
  bodyScrollWidth: await desktop.evaluate(() => document.body.scrollWidth),
  viewportWidth: await desktop.evaluate(() => window.innerWidth),
  phoneWidth: await desktop.locator(".prototypePhone").evaluate((element) => Math.round(element.getBoundingClientRect().width)),
};

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
