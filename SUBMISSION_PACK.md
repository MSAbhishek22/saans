# EvoHacks 2 — Devpost submission pack: Saans

> STATUS (21 Nov 2026, ~23:10 IST): repo LIVE at
> https://github.com/MSAbhishek22/saans. LIVE SITE:
> https://msabhishek22.github.io/saans/ (GitHub Pages, browser-verified
> 22:50 IST: Delhi AQI 209 "Very unhealthy", PM2.5 216.5, PM10 221.7).
> Planner fix (look-ahead to tomorrow morning) re-uploaded to the repo
> ~23:10 IST, Pages rebuild pending. Vercel import left unfinished
> behind identity verification (code to msabhishekanni10@gmail.com) —
> user-only step, not attempted.
> THEME FLAG: as of 22:40 IST on 21 Nov, the theme was NOT published on
> the Devpost overview/rules pages (still "The theme will not be released
> till the Hackathon!") and could not be read in Discord (no signed-in
> session). **Before filing, re-check the theme and confirm Saans fits;
> if the theme lands narrower, re-frame per BUILD_BRIEF.md pivot notes
> (health → lead with profiles; environment → lead with the WHO line;
> accessibility → lead with the plain-language answer). Do not file
> against an unchecked theme.**

## Devpost fields

**Project name:** Saans — the best hours to step out today

**Tagline:** Don't just check the AQI. Find the best hours to step out.

**Live demo:** https://msabhishek22.github.io/saans/

**Source code:** https://github.com/MSAbhishek22/saans

**Demo video (≤3 min):** [YOUTUBE LINK — upload needed; see note below]

**Built with:** HTML, CSS, JavaScript, Open-Meteo Air Quality API
(Copernicus CAMS data), Open-Meteo Geocoding API, GitHub Pages

**Team:** M S Abhishek (solo) — Devpost MSAbhishek22

## Description — the problem

Every November, the air across Delhi and north India turns poor or
severe, and it stays that way for weeks. People check the AQI number —
and then they still don't know what to do. Is it safe to take the kids
out? Should an elderly parent go for their walk? Is this a good hour for
a run, or should I wait?

A number is not a plan. Saans turns the number into a plan.

## Description — how it works

Saans fetches live air-quality data for your city — current US AQI,
PM2.5 and PM10, plus the hourly forecast — from the Open-Meteo Air
Quality API (Copernicus CAMS forecast), the moment you open the page.
Then it does three simple things:

1. **Right now.** The current AQI with its plain-English band and a
   one-line verdict, plus how today's PM2.5 compares with the WHO
   24-hour guideline.
2. **Best hours to go out.** The app reads the forecast hour by hour and
   picks the cleanest two-hour windows coming up — into tomorrow morning
   if the day is nearly over — labelled for what they suit (Morning run,
   Kids' play, Evening walk). If no window is safe, it says so plainly
   and shows the least-bad one instead of pretending.
3. **Who is going out?** Pick General, Child, Elderly, or Asthma / heart
   condition, and the advice gets stricter — outdoor exercise is fine at
   AQI 150 or under for a healthy adult, 100 or under for a child or an
   elderly person, 50 or under with asthma or a heart condition. There is
   also a tomorrow-morning peek and an hour-by-hour bar chart for the
   rest of today.

The advice comes from a short rule table written by hand and shown on
the page. There is no black-box model and no fake "AI" — the rules are
there for anyone to read.

## What was built during the event

Everything in the repo was written during EvoHacks 2, 21–22 Nov 2026:
the page, the styling, the planner logic, the tests, the demo video.
No pre-existing code, templates or assets were reused.

## Datasets, libraries and AI use

- Air-quality data: Open-Meteo Air Quality API, Copernicus CAMS
  forecast — https://open-meteo.com/en/docs/air-quality-api
- Place search: Open-Meteo Geocoding API
- No libraries or frameworks: plain HTML, CSS and vanilla JavaScript.
- AI helped draft code and wording. A person wrote the advice rules,
  picked the data source, tested every screen, and can explain each line
  — the demo video shows the code and the live API response. No secrets
  or keys are used anywhere, and none appear in the repo.

## Tests (honest results)

- `node tests/test.js` — 42 checks pass: 36 unit checks (AQI bands,
  profile limits, planner windows incl. the late-night tomorrow-morning
  case, formatting) + 6 live smoke checks against the real Open-Meteo API
  (Delhi fetch, geocoding lookup).
  One real bug was found and fixed by the tests (the "least bad window"
  used to be the earliest picked window, not the lowest-AQI one).
- Headless render probe (`tests/probe.py`) — desktop 1280×720 and phone
  375px: Delhi AQI 209 "Very unhealthy" live, Mumbai 250, Patna 81;
  profile switch changes the advice; city search works; no console
  errors; no horizontal overflow at 375px.

## Video note

The demo video is a screen recording of the actual live site with real
actions (switch city, switch profile, search a city, show the timeline
and the rules table, show the live API response). YouTube upload needs
the user's own sign-in — the "Verify it's you" wall has blocked uploads
before, so the main chat must upload it or the filing waits on that step.
