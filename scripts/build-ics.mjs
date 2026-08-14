// Merges all data/*.json event sources into a single RFC 5545 .ics file
// at docs/calendar.ics. Every event is emitted as an all-day (date-only)
// entry, regardless of whether the source data has a time-of-day.
import { readFile, writeFile } from "node:fs/promises";

const FILES = [
  "../data/macro-us.json",
  "../data/macro-jp.json",
  "../data/macro-pmi.json",
  "../data/earnings.json",
  "../data/treasury.json",
];
const OUT_PATH = new URL("../docs/calendar.ics", import.meta.url);

async function loadEvents() {
  const all = [];
  for (const rel of FILES) {
    try {
      const raw = await readFile(new URL(rel, import.meta.url), "utf8");
      const json = JSON.parse(raw);
      all.push(...(json.events ?? []));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      console.warn(`  (skipping ${rel}: not found)`);
    }
  }
  return all;
}

function fmtUtc(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function fmtDateOnly(dateISO) {
  return dateISO.replace(/-/g, "");
}

function addDays(dateISO, n) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function escapeText(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 line folding: break lines longer than 75 octets.
function foldLine(line) {
  const bytes = Buffer.byteLength(line, "utf8");
  if (bytes <= 75) return line;
  let out = "";
  let chunk = line;
  let first = true;
  while (Buffer.byteLength(chunk, "utf8") > 0) {
    const limit = first ? 75 : 74;
    let end = Math.min(chunk.length, limit);
    while (Buffer.byteLength(chunk.slice(0, end), "utf8") > limit) end--;
    out += (first ? "" : "\r\n ") + chunk.slice(0, end);
    chunk = chunk.slice(end);
    first = false;
  }
  return out;
}

function buildEvent(ev) {
  const uid = `${ev.id}@financial-calendar`;
  const summary = escapeText(ev.title);
  const desc = escapeText(ev.description || "");
  const url = ev.link ? `\r\nURL:${ev.link}` : "";
  const category = ev.category ? `\r\nCATEGORIES:${escapeText(ev.category.toUpperCase())}` : "";

  const start = fmtDateOnly(ev.date);
  const end = fmtDateOnly(addDays(ev.date, 1));
  const dtLines = `DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    dtLines,
    `SUMMARY:${summary}`,
    desc ? `DESCRIPTION:${desc}` : null,
    url.slice(2) || null,
    category.slice(2) || null,
    "END:VEVENT",
  ].filter(Boolean);

  return lines.map(foldLine).join("\r\n");
}

async function main() {
  const events = await loadEvents();
  const body = events.map(buildEvent).join("\r\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//financial-calendar//US+JP Financial Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:US + Japan Financial Calendar",
    "X-WR-TIMEZONE:UTC",
    body,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  await writeFile(OUT_PATH, ics, "utf8");
  console.log(`Wrote ${events.length} events to ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
