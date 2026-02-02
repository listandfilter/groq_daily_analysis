// ✅ DAILY LOSER (IPv4 FORCED + safe summaries to avoid WP missing_field)
import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import chalk from "chalk";
import axios from "axios";
import dotenv from "dotenv";
import https from "https";

import { getTopLoser } from "./rediff_loser.js";
import { summariseFeeds } from "./groqL.js";
import { visitStockEdge } from "./stockEdge.js";

dotenv.config();
puppeteer.use(Stealth());

/* ---------- IPv4 Forced HTTPS Agent ---------- */
const httpsAgent = new https.Agent({
  keepAlive: true,
  family: 4, // ✅ FORCE IPv4
});

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
  // ✅ Always send 3 summaries (prevents "Field summary2 is required")
  const safeReasons = [
    reasons?.[0] || "No recent feeds found",
    reasons?.[1] || "Selling pressure continues",
    reasons?.[2] || "Weak price structure observed",
  ];

  const payload = {
    stockName,
    nseSymbol,
    changePercent: `${Number(changePercent).toFixed(2)}%`,
    summary1: safeReasons[0],
    summary2: safeReasons[1],
    summary3: safeReasons[2],
    tag,
  };

  try {
    const response = await axios.post(wpApiUrl, payload, {
      auth: {
        username: process.env.WP_USER,
        password: process.env.WP_PASS,
      },
      timeout: 60000,
      httpsAgent, // ✅ IPv4 forced
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      validateStatus: () => true,
    });

    console.log(`📩 WP status for ${stockName}:`, response.status);

    if (response.status < 200 || response.status >= 300) {
      console.error(`❌ WordPress API error for ${stockName}:`, response.data);
      return null;
    }

    console.log(`✅ Posted to WordPress for ${stockName}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Axios/network error for ${stockName}:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    });
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
  const losers = await getTopLoser(page);

  // ✅ Just log correctly (these are losers, not gainers)
  console.log(chalk.cyan(`✔ Found ${losers.length} losers ≤ -7.0`));

  for (const g of losers) {
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
      await wait(1000);
    } catch (err) {
      console.log(chalk.red(`Skipped ${g.name}: ${err.message}`));
    }
  }

  await browser.close();
})();
