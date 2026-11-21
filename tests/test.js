/* Saans tests — run with: node tests/test.js
 * Unit tests use fixed inputs; the smoke test hits the LIVE Open-Meteo
 * API and asserts on its real shape. Never edit a test to make it pass:
 * fix the code instead. */
"use strict";

const { bandFor, bestWindows, windowAdvice, profileVerdict, activityFor, fmtHour, PROFILES } = require("../app.js");

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  ok  " + name); }
  else { failed++; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* --- bands --- */
check("band 25 is Good", bandFor(25).name === "Good");
check("band 50 is Good", bandFor(50).name === "Good");
check("band 51 is Moderate", bandFor(51).name === "Moderate");
check("band 100 is Moderate", bandFor(100).name === "Moderate");
check("band 101 is USG", bandFor(101).name === "Unhealthy for sensitive groups");
check("band 150 is USG", bandFor(150).name === "Unhealthy for sensitive groups");
check("band 151 is Unhealthy", bandFor(151).name === "Unhealthy");
check("band 200 is Unhealthy", bandFor(200).name === "Unhealthy");
check("band 201 is Very unhealthy", bandFor(201).name === "Very unhealthy");
check("band 300 is Very unhealthy", bandFor(300).name === "Very unhealthy");
check("band 301 is Hazardous", bandFor(301).name === "Hazardous");
check("band 450 is Hazardous", bandFor(450).name === "Hazardous");
check("band null is null", bandFor(null) === null);

/* --- profiles --- */
check("general limit 150", PROFILES.general.limit === 150);
check("child limit 100", PROFILES.child.limit === 100);
check("elderly limit 100", PROFILES.elderly.limit === 100);
check("asthma limit 50", PROFILES.asthma.limit === 50);
check("asthma verdict at 120 warns", /wait for one of the cleaner windows/.test(profileVerdict(120, "asthma")));
check("general verdict at 120 is fine", /counts as fine/.test(profileVerdict(120, "general")));
check("child advice at 90 is clean", /Clean enough for the kids/.test(windowAdvice(90, 100, "child")));
check("child advice at 130 is not clean", /above the safe line/.test(windowAdvice(130, 100, "child")));

/* --- planner windows --- */
function H(h, aqi) { return { time: "2026-11-22T" + String(h).padStart(2, "0") + ":00", aqi }; }
const day = [180, 170, 160, 140, 90, 80, 85, 95, 110, 130, 150, 160].map((a, i) => H(6 + i, a));
let r = bestWindows(day, 100);
check("planner finds windows under limit", r.windows.length > 0);
check("planner best window is the 11am clean stretch (mean 83)",
  r.windows.length && r.windows[0].from.time === "2026-11-22T11:00" && r.windows[0].mean === 83,
  JSON.stringify(r.windows.map(w => w.from.time + "=" + w.mean)));
check("planner excludes the 9am window (mean 115, over the 100 limit)",
  !r.windows.some(w => w.from.time === "2026-11-22T09:00"));
check("planner windows do not overlap", (() => {
  const starts = r.windows.map(w => w.start);
  return new Set(starts).size === starts.length && starts.every((s, i) => i === 0 || s - starts[i - 1] >= 2);
})());
check("planner picks at most 3", r.windows.length <= 3);

const badDay = [260, 250, 240, 230, 220, 210].map((a, i) => H(6 + i, a));
let rb = bestWindows(badDay, 100);
check("bad day: no good windows", rb.windows.length === 0);
check("bad day: least-bad window offered", rb.leastBad !== null && rb.leastBad.mean === 215,
  JSON.stringify(rb.leastBad));

const empty = bestWindows([], 100);
check("empty day: nothing picked", empty.windows.length === 0 && empty.leastBad === null);

/* Late-night case: only one hour left today, clean air tomorrow morning.
 * Hours are consecutive, as the real API returns them. */
function H2(d, h, aqi) { return { time: d + "T" + String(h).padStart(2, "0") + ":00", aqi }; }
const night = [H2("2026-11-21", 23, 210),
  H2("2026-11-22", 0, 190), H2("2026-11-22", 1, 180), H2("2026-11-22", 2, 170),
  H2("2026-11-22", 3, 160), H2("2026-11-22", 4, 150), H2("2026-11-22", 5, 120),
  H2("2026-11-22", 6, 90), H2("2026-11-22", 7, 80), H2("2026-11-22", 8, 85),
  H2("2026-11-22", 9, 120), H2("2026-11-22", 10, 140)];
let rn = bestWindows(night, 100);
check("late night: planner finds tomorrow-morning windows",
  rn.windows.length > 0 && rn.windows[0].from.time === "2026-11-22T07:00" && rn.windows[0].mean === 83,
  JSON.stringify(rn.windows.map(w => w.from.time + "=" + w.mean)));
check("late night: the 6am window loses to the cleaner 7am one",
  !rn.windows.some(w => w.from.time === "2026-11-22T06:00"));

/* --- formatting --- */
check("fmtHour 0 is 12am", fmtHour(0) === "12am");
check("fmtHour 13 is 1pm", fmtHour(13) === "1pm");
check("activity 6am is Morning run", activityFor(6) === "Morning run");
check("activity 10am is Kids play", /Kids/.test(activityFor(10)));
check("activity 16pm is Evening walk", activityFor(16) === "Evening walk");

/* --- live API smoke test (real data, not fixtures) --- */
async function liveSmoke() {
  console.log("live smoke: fetching Delhi from Open-Meteo…");
  const url = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.61&longitude=77.21&hourly=us_aqi,pm2_5,pm10&forecast_days=2&timezone=auto";
  const res = await fetch(url);
  check("live API answers 200", res.ok, "status " + res.status);
  const j = await res.json();
  check("live payload has hourly time/aqi/pm2_5/pm10",
    Array.isArray(j.hourly.time) && Array.isArray(j.hourly.us_aqi) &&
    Array.isArray(j.hourly.pm2_5) && Array.isArray(j.hourly.pm10));
  check("live payload has 48 hours", j.hourly.time.length === 48, "got " + j.hourly.time.length);
  const now = j.hourly.us_aqi.filter(v => v !== null);
  check("live AQI values are numbers in range 0..999",
    now.length > 40 && now.every(v => typeof v === "number" && v >= 0 && v <= 999),
    "nulls: " + (48 - now.length));
  const today = j.hourly.time[0].slice(0, 10);
  const rest = j.hourly.time.map((t, i) => ({ time: t, aqi: j.hourly.us_aqi[i] }))
    .filter(h => h.time.slice(0, 10) === today);
  const plan = bestWindows(rest, 150);
  check("live planner returns windows or a least-bad fallback",
    plan.windows.length > 0 || plan.leastBad !== null);
  const geo = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?name=Patna&count=3")).json();
  check("live geocoding finds Patna in India",
    Array.isArray(geo.results) && geo.results.some(g => g.name === "Patna" && g.country_code === "IN"));
}

liveSmoke().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch(e => {
  console.log("  FAIL live smoke threw: " + e.message);
  console.log(`\n${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
