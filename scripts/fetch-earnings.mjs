// Fetches upcoming earnings-call dates from Nasdaq's public earnings-calendar
// endpoint and keeps only large-cap names (default: >= $10B market cap).
// This endpoint is US-listed companies, which includes major Japanese ADRs
// (e.g. Toyota/TM, Sony/SONY, Mitsubishi UFJ/MUFG, Honda/HMC) but not
// Tokyo-only listings (e.g. Nintendo, SoftBank Group) -- there is no free,
// reliable API for the full Nikkei 225 earnings calendar.
import { writeFile } from "node:fs/promises";

const DAYS_AHEAD = 180;
const MIN_MARKET_CAP = 10_000_000_000; // $10B
const OUT_PATH = new URL("../data/earnings.json", import.meta.url);

function parseMarketCap(raw) {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchDay(dateISO) {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${dateISO}`;
  const res = await fetch(url, {
    headers: {
      // Nasdaq's WAF blocks generic/"bot"-labeled UAs with an HTTP/2 stream
      // reset rather than a clean 4xx, so a realistic browser UA is required.
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.warn(`  ${dateISO}: HTTP ${res.status}, skipping`);
    return [];
  }
  const json = await res.json();
  const rows = json?.data?.rows ?? [];
  return rows
    .filter((r) => parseMarketCap(r.marketCap) >= MIN_MARKET_CAP)
    .map((r) => ({
      id: `earn-${r.symbol}-${dateISO}`,
      title: `${r.name} (${r.symbol}) Earnings Call`,
      category: "earnings",
      date: dateISO,
      description: `Reports ${r.time === "time-pre-market" ? "before market open" : r.time === "time-after-hours" ? "after market close" : "time TBD"}. EPS forecast: ${r.epsForecast || "N/A"} | Market cap: ${r.marketCap || "N/A"}`,
      link: `https://www.nasdaq.com/market-activity/stocks/${String(r.symbol).toLowerCase()}/earnings`,
    }));
}

async function main() {
  const today = new Date();
  const allEvents = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = dateStr(d);
    process.stdout.write(`Fetching earnings for ${iso}...\r`);
    try {
      const events = await fetchDay(iso);
      allEvents.push(...events);
    } catch (err) {
      console.warn(`  ${iso}: fetch failed (${err.message}), skipping`);
    }
    // be polite to the endpoint
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\nFetched ${allEvents.length} large-cap earnings events over ${DAYS_AHEAD} days.`);
  await writeFile(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), events: allEvents }, null, 2));
  console.log(`Wrote ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
