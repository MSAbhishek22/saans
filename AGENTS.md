# Saans — project memory (EvoHacks 2, 21–22 Nov 2026)

## What it is
A web app that uses live air-quality data to tell people in Indian cities
the safest hours to step out today — commute, exercise, kids' play,
elderly walks — instead of just showing a scary AQI number.

## Stack
Plain HTML + CSS + vanilla JS. No build step, no backend, no accounts,
no keys. Static hosting (Vercel).

## Data — real only
- Open-Meteo Air Quality API (`air-quality-api.open-meteo.com`), hourly
  US AQI / PM2.5 / PM10, Copernicus CAMS forecast. Free, no key.
- Open-Meteo Geocoding API for the city search. Free, no key.
- Every number on screen is fetched live at request time. No stored or
  made-up AQI anywhere. If the API is down, the app says so (error state
  with retry) — it never shows fake numbers.

## Advice rules (hand-written, in app.js)
- US AQI bands: standard EPA breaks (50/100/150/200/300).
- Outdoor exercise is fine at AQI ≤150 General, ≤100 Child, ≤100 Elderly,
  ≤50 Asthma/heart. The planner picks the cleanest 2-hour windows coming
  up (into tomorrow morning when the day is nearly over); if none is under
  the line it shows the least-bad window and says so plainly.
- WHO PM2.5 24-hour guideline shown for comparison: 15 µg/m³.

## Files
- `index.html` — page structure, incl. the "How this works" section
  (rules table, data credit, AI-use note).
- `styles.css` — Swiss Minimalism layout + glass cards; AQI band colours.
- `app.js` — fetch + planner + render. Pure functions exported under Node
  for tests (`typeof module` guard).
- `tests/test.js` — `node tests/test.js`: 34 unit checks + live-API smoke test.
- `tests/probe.py` — `xvfb-run -a python3 tests/probe.py`: headless render
  check (desktop 1280×720 + phone 375px, city switch, profile switch,
  search, no console errors, no horizontal overflow).
- `demo-video/` — `record_demo.py` (Playwright, relay on 127.0.0.1:8899) +
  `relay_proxy.py`.

## Decisions
- 21 Nov 22:40 IST: theme still not published on Devpost and not readable
  in Discord (no signed-in session). Built Saans against the published
  prompt/tags (Social Good; "solves a real problem, improves an everyday
  experience"). Re-skinnable per BUILD_BRIEF.md pivot notes if the theme
  lands narrower.
- 21 Nov ~23:00 IST: fixed a real bug found by tests — `bestWindows`
  returned the earliest picked window as "least bad" instead of the
  lowest-AQI one. Tests: 42/42 pass (36 unit + 6 live smoke).
- 21 Nov 23:05 IST: planner now looks ahead to tomorrow midday when the
  day is nearly over (at 23:00 the old code found no 2-hour window at
  all). Windows that fall tomorrow carry a "Tomorrow ·" tag. Verified by
  a new late-night unit test + the render probe.
- 21 Nov 22:50 IST: LIVE on GitHub Pages — https://msabhishek22.github.io/saans/
  (browser-verified: Delhi AQI 209 "Very unhealthy", PM2.5 216.5 µg/m³,
  PM10 221.7 µg/m³). Vercel import left unfinished behind identity
  verification (code to msabhishekanni10@gmail.com) — user-only step.
- 21 Nov 22:43 IST render probe: Delhi AQI 209 "Very unhealthy" (live),
  Mumbai 250, Patna 81; asthma profile changes the verdict; no console
  errors; no overflow at 375px.
- 21 Nov 22:47 IST: GitHub repo LIVE — https://github.com/MSAbhishek22/saans
  (5 files, commit dba829e, via browser task). Vercel deploy BLOCKED on
  identity verification (6-digit code to msabhishekanni10@gmail.com) —
  user-only step, left alone per the task hard limit; deploy moved to
  GitHub Pages (same browser task).

## Rules for this repo
- Human tone in all copy: plain words, short sentences, no AI-marketing
  phrases.
- Free-only. No secrets in the repo (none are used — say so in the README).
- Never edit a test to make it pass. Fix the code.
- Demo video: screen recording of the actual live site with a real action.
