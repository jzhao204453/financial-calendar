# financial-calendar

A US + Japan financial events calendar (FOMC, CPI, NFP, BOJ, Japan CPI/employment, large-cap earnings calls) published as an `.ics` feed you subscribe to from Google Calendar.

## How it works

- `data/macro-us.json` / `data/macro-jp.json` — hand-curated macro release dates (Fed, BLS, BOJ, Japan Statistics Bureau). These change rarely; re-verify against the official sources once or twice a year.
- `scripts/fetch-earnings.mjs` — pulls upcoming large-cap ($10B+ market cap) earnings dates for the next 90 days from Nasdaq's public earnings-calendar endpoint, writes `data/earnings.json`.
- `scripts/build-ics.mjs` — merges all three JSON files into `docs/calendar.ics`.
- `.github/workflows/update.yml` — runs the fetch + build daily and commits the refreshed `docs/calendar.ics`, which GitHub Pages serves as a stable URL.

## Local usage

```bash
npm run update   # fetch earnings + rebuild docs/calendar.ics
```

## Limitations

- **Japan earnings**: the Nasdaq endpoint only covers US-listed tickers, including major Japanese ADRs (Toyota/TM, Sony/SONY, Mitsubishi UFJ/MUFG, Honda/HMC) but not Tokyo-only listings (Nintendo, SoftBank Group, etc.). There's no free, reliable API for the full Nikkei 225 earnings calendar; this would need a paid data provider to fill in.
- **Japan CPI dates** beyond what's currently listed, and **US CPI/NFP dates** beyond 2026, will need to be re-added to `data/macro-*.json` once the respective agencies publish next year's schedule (usually a few months in advance).
- **BOJ decision times** vary meeting to meeting, so those are listed as all-day events rather than a fixed time.

## Subscribing in Google Calendar

Once published via GitHub Pages, add the `.ics` URL in Google Calendar via *Other calendars → From URL*. Google polls the feed roughly every 12–24 hours.
