# financial-calendar

A US + Japan financial events calendar (FOMC, CPI, NFP, BOJ, Japan CPI/employment, ISM/Japan PMI, US Treasury auctions, large-cap earnings calls) published as an `.ics` feed you subscribe to from Google Calendar. All events are all-day (date only, no time-of-day).

## How it works

- `data/macro-us.json` / `data/macro-jp.json` / `data/macro-pmi.json` — hand-curated macro release dates (Fed, BLS, BOJ, Japan Statistics Bureau, ISM). These change rarely; re-verify against the official sources once or twice a year.
- `scripts/fetch-earnings.mjs` — pulls upcoming large-cap ($10B+ market cap) earnings dates for the next 180 days from Nasdaq's public earnings-calendar endpoint, writes `data/earnings.json`.
- `scripts/fetch-treasury.mjs` — pulls upcoming 10-year note & 30-year bond auction dates from TreasuryDirect's public API, writes `data/treasury.json`. Unlike the other sources, Treasury only announces each auction about a week ahead, so this is fetched fresh daily rather than hardcoded — expect it to be empty until the next auction is officially announced.
- `scripts/build-ics.mjs` — merges all data files into `docs/calendar.ics` as all-day events.
- `.github/workflows/update.yml` — runs the fetch + build daily and commits the refreshed `docs/calendar.ics`, which GitHub Pages serves as a stable URL.

## Local usage

```bash
npm run update   # fetch earnings + treasury auctions, rebuild docs/calendar.ics
```

## Limitations

- **Japan earnings**: the Nasdaq endpoint only covers US-listed tickers, including major Japanese ADRs (Toyota/TM, Sony/SONY, Mitsubishi UFJ/MUFG, Honda/HMC) but not Tokyo-only listings (Nintendo, SoftBank Group, etc.). There's no free, reliable API for the full Nikkei 225 earnings calendar; this would need a paid data provider to fill in.
- **Japan Manufacturing PMI dates** in `data/macro-pmi.json` are *estimated* (marked "est." in the title) using S&P Global's usual first-business-day-of-month release convention — S&P Global doesn't publish an advance full-year schedule the way ISM does. Verify close to date via the linked press-release page.
- **Japan CPI dates** beyond what's currently listed, and **US CPI/NFP/ISM dates** beyond 2026, will need to be re-added to `data/macro-*.json` once the respective agencies publish next year's schedule (usually a few months in advance).
- **Treasury auctions** only appear once officially announced (~1 week ahead) — this is a TreasuryDirect constraint, not a bug.

## Subscribing in Google Calendar

Add the `.ics` URL in Google Calendar via *Other calendars → From URL*. Google polls the feed roughly every 12–24 hours.
