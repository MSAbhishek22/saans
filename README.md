# Saans — the best hours to step out today

Don't just check the AQI. Find the best hours to step out.

Saans is a web app that uses **live air-quality data** to tell people in
Indian cities the safest hours to go out today — for a morning run, kids'
play, an elderly parent's walk, or the commute. It was built during
**EvoHacks 2 (21–22 Nov 2026)**.

## What it does

- **Pick a city** — ten Indian cities one tap away, or search any place.
- **Right now** — the current US AQI with its plain-English band
  (Good / Moderate / Unhealthy …), PM2.5 and PM10, and a one-line verdict.
- **Best hours to go out** — the app picks the cleanest two-hour windows
  coming up — into tomorrow morning if the day is nearly over — and labels
  them (Morning run, Kids' play, Evening walk…). If no window is safe, it
  says so and shows the least-bad one.
- **Who is going out?** — pick General, Child, Elderly, or Asthma / heart
  condition and the advice gets stricter: outdoor exercise is fine at AQI
  150 or under for a healthy adult, 100 or under for a child or an elderly
  person, and 50 or under with asthma or a heart condition.
- **Tomorrow morning** — a one-line peek at what 6–10am looks like.

## Data — real, live, credited

Every number on screen is fetched live, in the browser, from the
**Open-Meteo Air Quality API** (Copernicus CAMS forecast): hourly US AQI,
PM2.5 and PM10. Place search uses the **Open-Meteo Geocoding API**. Both
are free and need no key. There is no stored or made-up AQI anywhere in
this app — if the service is down, the page says so instead of guessing.

## How it works

The planner reads the forecast hour by hour and picks the cleanest
two-hour windows left today. The advice comes from a short rule table
written by hand (see the table in the app under "How this works"). There
is no black-box model and no fake "AI" — the rules are on the page for
anyone to read.

## Run it

No build step, no keys, no backend. Open `index.html` in a browser, or
serve the folder with any static server:

```
python3 -m http.server
```

## Tests

```
node tests/test.js        # unit checks + live-API smoke test
xvfb-run -a python3 tests/probe.py   # headless render check (desktop + phone)
```

42 checks pass (36 unit + 6 live smoke), including a real fetch of Delhi's
air quality and a geocoding lookup.

## Built during the event

Everything in this repo was written during EvoHacks 2, 21–22 Nov 2026.
No pre-existing code, templates or assets were reused. AI helped draft
code and wording; a person wrote the advice rules, picked the data source,
tested every screen, and can explain each line — the demo video shows the
code and the live API response.

## Note

Forecast data comes from a weather model. For medical decisions, follow
official CPCB readings and your doctor.
