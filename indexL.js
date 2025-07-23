import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import chalk from "chalk";
import { getTopLoser } from "./rediff_loser.js";
import { summariseFeeds } from "./groqL.js";
import { visitStockEdge } from "./stockEdge.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

puppeteer.use(Stealth());

/* ---------- Helpers ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const wpApiUrl = process.env.WP_API_URL;

async function sendToWordPress(
  stockName,
  nseSymbol,
  changePercent,
  reasons,
  tag = "dailylosers"
) {
  try {
    const response = await axios.post(
      wpApiUrl,
      {
        stockName,
        nseSymbol,
        changePercent: `${changePercent.toFixed(2)}%`,
        summary1: reasons[0],
        summary2: reasons[1],
        summary3: reasons[2],
        tag,
      },
      {
        auth: {
          username: process.env.WP_USER,
          password: process.env.WP_PASS,
        },
      }
    );

    console.log(`Posted to WordPress for ${stockName}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(
      `WordPress API error for ${stockName}:`,
      error.response?.data || error.message
    );
    return null;
  }
}

/* ---------- Orchestrator ---------- */
(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
    ],
  });

  const [page] = await browser.pages();
  const gainers = await getTopLoser(page);
  console.log(chalk.cyan(`✔ Found ${gainers.length} gainers ≥ -7.0`));

  for (const g of gainers) {
    console.log(chalk.yellow(`\n🔍 Processing ${g.name} ...`));
    try {
      const { symbol, recentFeeds } = await visitStockEdge(browser, g);
      const reasons = await summariseFeeds(g.name, recentFeeds);

      console.log(
        chalk.greenBright(
          JSON.stringify(
            { company: g.name, symbol, change: g.change, reasons },
            null,
            2
          )
        )
      );

      await sendToWordPress(g.name, symbol, g.change, reasons);
    } catch (err) {
      console.log(chalk.red(`Skipped ${g.name}: ${err.message}`));
    }
  }

  await browser.close();
})();
