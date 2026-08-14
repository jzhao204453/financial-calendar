// Fetches upcoming 10-year note and 30-year bond auction dates from
// TreasuryDirect's public API. Unlike Fed/BLS/BOJ, Treasury does not
// pre-publish exact auction dates for the full year -- each auction is
// only officially announced about a week ahead -- so this is fetched
// fresh on the same daily schedule as earnings, rather than hardcoded.
import { writeFile } from "node:fs/promises";

const OUT_PATH = new URL("../data/treasury.json", import.meta.url);
const UPCOMING_URL = "https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json";

// Reopened notes/bonds are tagged with their remaining term at reopening,
// not their original term, so "10-Year" and "30-Year" alone would miss most
// auctions -- these are the terms observed for 10yr/30yr-family auctions.
const TEN_YEAR_TERMS = new Set(["10-Year", "9-Year 10-Month", "9-Year 11-Month"]);
const THIRTY_YEAR_TERMS = new Set(["30-Year", "29-Year 10-Month", "29-Year 11-Month"]);

function labelFor(term) {
  if (TEN_YEAR_TERMS.has(term)) return "10-Year Note";
  if (THIRTY_YEAR_TERMS.has(term)) return "30-Year Bond";
  return null;
}

async function main() {
  const res = await fetch(UPCOMING_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`TreasuryDirect API returned HTTP ${res.status}`);
  const rows = await res.json();

  const events = rows
    .map((r) => ({ row: r, label: labelFor(r.securityTerm) }))
    .filter((x) => x.label)
    .map(({ row: r, label }) => {
      const dateISO = r.auctionDate.slice(0, 10);
      return {
        id: `treasury-${r.cusip}`,
        title: `US Treasury ${label} Auction`,
        category: "treasury",
        date: dateISO,
        description: `Term: ${r.securityTerm}. Issue/settlement date: ${r.issueDate.slice(0, 10)}. CUSIP: ${r.cusip}.`,
        link: "https://www.treasurydirect.gov/auctions/upcoming/",
      };
    });

  console.log(`Fetched ${events.length} upcoming 10yr/30yr Treasury auctions.`);
  await writeFile(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2));
  console.log(`Wrote ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
