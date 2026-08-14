// Merges data/macro-us.json, data/macro-jp.json and data/earnings.json
// into a single RFC 5545 .ics file at docs/calendar.ics.
import { readFile, writeFile } from "node:fs/promises";

const FILES = ["../data/macro-us.json", "../data/macro-jp.json", "../data/earnings.json"];
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

// Converts a wall-clock date/time in `timeZone` to a UTC Date, without
// external tz data, using Intl.DateTimeFormat as the source of truth for
// the zone's offset at that instant (handles DST correctly).
function zonedTimeToUtc(dateISO, timeStr, timeZone) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = {};
  for (const p of dtf.formatToParts(guess)) map[p.type] = p.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asIfUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
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

  let dtLines;
  if (ev.allDay || !ev.time) {
    const start = fmtDateOnly(ev.date);
    const end = fmtDateOnly(addDays(ev.date, 1));
    dtLines = `DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}`;
  } else {
    const startUtc = zonedTimeToUtc(ev.date, ev.time, ev.tz || "UTC");
    const endUtc = new Date(startUtc.getTime() + 30 * 60 * 1000);
    dtLines = `DTSTART:${fmtUtc(startUtc)}\r\nDTEND:${fmtUtc(endUtc)}`;
  }

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
