import dayjs from "dayjs";

export async function visitStockEdge(browser, { name }) {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.118 Safari/537.36";

  // 1. Open search page
  const searchPage = await browser.newPage();
  await searchPage.setUserAgent(userAgent);
  await searchPage.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
  await searchPage.setViewport({ width: 1280, height: 800 });

  await searchPage.goto("https://search.stockedge.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await searchPage.type("#searchText", name, { delay: 25 });
  await Promise.all([
    searchPage.keyboard.press("Enter"),
    searchPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
  ]);

  await searchPage.waitForSelector(".response-table tr", { timeout: 10000 });

  const rawUrl = await searchPage.$eval(
    ".response-table tr td span.entity_name",
    (badge) => {
      const td = badge.closest("td");
      return td.querySelector("a")?.href;
    }
  );

  await searchPage.close();

  if (!rawUrl || !rawUrl.includes("/share/")) {
    throw new Error("No valid stock row found for: " + name);
  }

  const feedUrl = `${rawUrl}?section=feeds`;

  // 2. Open feeds page
  const page = await browser.newPage();
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(feedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("ion-item", { timeout: 10000 });

    const { symbol, feeds } = await page.evaluate(() => {
      const symbol =
        document
          .querySelector("ion-text.small-font.low-margin-left")
          ?.textContent.trim() || "N/A";
      const feeds = [...document.querySelectorAll("ion-item")].map((it) => ({
        date: it
          .querySelector("ion-col:nth-child(2) ion-text")
          ?.textContent.trim(),
        headline: it.querySelector("p")?.textContent.trim(),
      }));
      return { symbol, feeds };
    });

    await page.close();

    const recentFeeds = feeds
      .filter((f) =>
        dayjs(f.date, "DD-MMM-YYYY").isAfter(dayjs().subtract(90, "day"))
      )
      .map((f) => f.headline);

    return { symbol, recentFeeds };
  } catch (err) {
    await page.close();
    throw new Error(`Failed scraping StockEdge feed page: ${err.message}`);
  }
}
