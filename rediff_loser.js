const REDIFF_URLS = [
  "https://money.rediff.com/losers/bse/daily/groupa",
  "https://money.rediff.com/losers/bse/daily/groupb",
];
const MIN_CHANGE = -7.0; // %‑change threshold

export async function getTopLoser(page) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.118 Safari/537.36"
  );

  const gainers = [];
  for (const url of REDIFF_URLS) {
    console.log(`Visiting: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    await new Promise((r) => setTimeout(r, 3000));
    await page.waitForSelector("table.dataTable tbody  tr", { timeout: 15000 });
    const rows = await page.$$eval("table tr", (trs) =>
      trs.slice(1).map((tr) => {
        const tds = [...tr.querySelectorAll("td")].map((td) =>
          td.innerText.trim()
        );
        return {
          name: tds[0],
          change: tds[4] ? parseFloat(tds[4].replace(/[+% ]/g, "")) : 0,
        };
      })
    );
    gainers.push(...rows.filter((r) => r.change <= MIN_CHANGE));
  }
  return gainers;
}
