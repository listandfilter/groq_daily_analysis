import dotenv from "dotenv";
dotenv.config();
import { Groq } from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function summariseFeeds(stockName, recentFeeds) {
  if (!recentFeeds.length) return ["No recent feeds found"];

  const prompt = `
You are a financial analyst.

Analyze the following recent news and updates about the NSE-listed company "${stockName}":

${recentFeeds.join("\n")}

From this feed, extract exactly the top 3 reasons why this company may be appearing as a monthly gainer in the stock market.

Only return a numbered list in this exact format:
1. Title: Short explanation
2. Title: Short explanation
3. Title: Short explanation

Do NOT include any introductions, summaries, or extra lines. Be concise (≤ 180 characters per reason).Also dont mention like "here's reasons" etc only summaries`;

  const { choices } = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 256,
    temperature: 0.4,
  });

  return choices[0].message.content.trim().split("\n");
}
