/* Saans — live air-quality planner.
 *
 * Data: every number comes from the Open-Meteo Air Quality API
 * (Copernicus CAMS forecast), fetched live in the browser. No key, no
 * stored values, no made-up AQI anywhere in this file.
 *
 * Advice: a short hand-written rule table over the real AQI value.
 * AI helped draft this code and its wording; a person wrote the rules,
 * picked the data source, tested it, and can explain every line.
 */
(function () {
  "use strict";

  var AQ_API = "https://air-quality-api.open-meteo.com/v1/air-quality";
  var GEO_API = "https://geocoding-api.open-meteo.com/v1/search";

  var CITIES = [
    { name: "Delhi", lat: 28.61, lon: 77.21 },
    { name: "Mumbai", lat: 19.08, lon: 72.88 },
    { name: "Bengaluru", lat: 12.97, lon: 77.59 },
    { name: "Kolkata", lat: 22.57, lon: 88.36 },
    { name: "Chennai", lat: 13.08, lon: 80.27 },
    { name: "Hyderabad", lat: 17.39, lon: 78.49 },
    { name: "Lucknow", lat: 26.85, lon: 80.95 },
    { name: "Patna", lat: 25.59, lon: 85.14 },
    { name: "Jaipur", lat: 26.91, lon: 75.79 },
    { name: "Ahmedabad", lat: 23.02, lon: 72.57 }
  ];

  /* US AQI bands, standard EPA breaks. Colour is never the only signal:
   * every band also carries its name in words. */
  var BANDS = [
    { max: 50, name: "Good", cls: "good", color: "#2e9e5b",
      line: "The air is fine. Go out as you like." },
    { max: 100, name: "Moderate", cls: "moderate", color: "#8a6d00",
      line: "Okay for most people. If you have asthma, keep it easy." },
    { max: 150, name: "Unhealthy for sensitive groups", cls: "usg", color: "#e8821e",
      line: "Children, elderly people and anyone with asthma or a heart condition should stay in or keep outings short." },
    { max: 200, name: "Unhealthy", cls: "unhealthy", color: "#d43d2a",
      line: "Everyone will feel this. Keep outdoor time short, and skip the run." },
    { max: 300, name: "Very unhealthy", cls: "very", color: "#8e3a9e",
      line: "Stay indoors if you can. If you must go out, wear a proper mask and keep it brief." },
    { max: Infinity, name: "Hazardous", cls: "haz", color: "#6e1423",
      line: "Do not go out unless you have to. This air is dangerous for everyone." }
  ];

  /* When outdoor exercise is fine, by profile. Written by hand, not by a model. */
  var PROFILES = {
    general: { label: "General", limit: 150,
      why: "Healthy adults cope up to Unhealthy" },
    child: { label: "Child", limit: 100,
      why: "Children breathe faster and are still growing" },
    elderly: { label: "Elderly", limit: 100,
      why: "Older lungs and hearts feel it sooner" },
    asthma: { label: "Asthma / heart condition", limit: 50,
      why: "Only Good air is safe to push in" }
  };

  var WHO_PM25_24H = 15; /* WHO 24-hour guideline, µg/m³ */

  function bandFor(aqi) {
    if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
    for (var i = 0; i < BANDS.length; i++) {
      if (aqi <= BANDS[i].max) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function hourOf(iso) { return parseInt(iso.slice(11, 13), 10); }

  function fmtHour(h) {
    var ap = h < 12 ? "am" : "pm";
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ap;
  }

  /* Activity label for a window starting at hour h. */
  function activityFor(h) {
    if (h >= 5 && h < 9) return "Morning run";
    if (h >= 9 && h < 12) return "Kids' play · mid-morning";
    if (h >= 12 && h < 15) return "Midday errands";
    if (h >= 15 && h < 18) return "Evening walk";
    return "Evening outing";
  }

  /* Pick the cleanest 2-hour windows left today.
   * hours: [{time, aqi}], all for today, from the current hour onwards.
   * Returns up to 3 non-overlapping windows, best first. */
  function bestWindows(hours, limit) {
    var cands = [];
    for (var i = 0; i + 1 < hours.length; i++) {
      var a = hours[i].aqi, b = hours[i + 1].aqi;
      if (a === null || b === null) continue;
      cands.push({ start: i, mean: Math.round((a + b) / 2), from: hours[i], to: hours[i + 1] });
    }
    cands.sort(function (x, y) { return x.mean - y.mean; });
    var picked = [];
    for (var j = 0; j < cands.length && picked.length < 3; j++) {
      var c = cands[j];
      var overlaps = picked.some(function (p) { return Math.abs(p.start - c.start) < 2; });
      if (!overlaps) picked.push(c);
    }
    picked.sort(function (x, y) { return x.start - y.start; });
    var good = picked.filter(function (w) { return w.mean <= limit; });
    /* Least-bad window is the lowest-mean candidate overall, not the
     * earliest picked one (picked is sorted by start above). */
    return { windows: good, leastBad: good.length ? null : (cands[0] || null) };
  }

  /* Advice for one window, in plain words. */
  function windowAdvice(mean, limit, profileKey) {
    if (mean <= limit) {
      if (profileKey === "asthma") return "Clean enough to exercise. Keep your inhaler with you, as always.";
      if (profileKey === "child") return "Clean enough for the kids to play outside.";
      if (profileKey === "elderly") return "Clean enough for a walk. Take it slow and stay near home.";
      return "Clean enough for a run or a long walk.";
    }
    return "Still above the safe line for this profile — keep it short if you go.";
  }

  function profileVerdict(aqi, profileKey) {
    var band = bandFor(aqi);
    if (!band) return "";
    var p = PROFILES[profileKey];
    if (aqi <= p.limit) return band.line + " For a " + p.label.toLowerCase() + " profile, right now counts as fine.";
    if (profileKey === "general") return band.line;
    return band.line + " For a " + p.label.toLowerCase() + " profile, wait for one of the cleaner windows below.";
  }

  /* ---- data fetching (live, no key) ---- */
  function fetchAQ(lat, lon) {
    var url = AQ_API + "?latitude=" + lat + "&longitude=" + lon +
      "&hourly=us_aqi,pm2_5,pm10&forecast_days=2&timezone=auto";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Air-quality service answered " + r.status);
      return r.json();
    });
  }

  function geocode(q) {
    var url = GEO_API + "?name=" + encodeURIComponent(q) + "&count=5&language=en&format=json";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Place search answered " + r.status);
      return r.json();
    }).then(function (j) { return j.results || []; });
  }

  /* Index of the hour that matches "now" in the response timezone. */
  function nowIndex(times, tz) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ""; };
    var needle = get("year") + "-" + get("month") + "-" + get("day") + "T" + get("hour") + ":00";
    for (var i = 0; i < times.length; i++) {
      if (times[i] === needle) return i;
    }
    /* Fallback: first hour not in the past, judged by the date part. */
    var today = needle.slice(0, 10);
    for (var j = 0; j < times.length; j++) {
      if (times[j].slice(0, 10) === today) return j;
    }
    return 0;
  }

  /* ---- rendering ---- */
  var state = { city: CITIES[0], profile: "general", data: null };

  function $(id) { return document.getElementById(id); }

  function setStatus(html) { $("status").innerHTML = html || ""; }

  function showLoading(cityName) {
    setStatus('<div class="loading" role="status">Checking the live air forecast for ' +
      cityName + '&hellip;</div>');
  }

  function showError(msg, retry) {
    setStatus('<div class="error" role="alert"><strong>Could not load the air data.</strong><br>' +
      msg + ' The numbers come from a live service, so this is a network problem, not your city.' +
      '<br><button type="button" id="retryBtn">Try again</button></div>');
    $("retryBtn").addEventListener("click", retry);
  }

  function render(data) {
    var times = data.hourly.time;
    var aqi = data.hourly.us_aqi;
    var pm25 = data.hourly.pm2_5;
    var pm10 = data.hourly.pm10;
    var tz = data.timezone || "Asia/Kolkata";
    var idx = nowIndex(times, tz);
    var today = times[idx].slice(0, 10);

    /* Now card */
    var nowAqi = aqi[idx];
    var band = bandFor(nowAqi);
    $("nowCity").textContent = state.city.name;
    $("nowTime").textContent = "Updated for " + fmtHour(hourOf(times[idx])) +
      " · " + new Date(times[idx].replace("T", " ") + ":00").toLocaleDateString("en-GB", { day: "numeric", month: "long" }) +
      " · " + tz.replace("_", " ");
    $("aqiNum").textContent = (nowAqi === null ? "—" : Math.round(nowAqi));
    $("aqiNum").style.color = band ? band.color : "";
    $("aqiBand").textContent = band ? band.name : "No reading";
    $("aqiBand").style.color = band ? band.color : "";
    $("verdict").textContent = profileVerdict(nowAqi, state.profile);
    $("pm25").textContent = (pm25[idx] === null ? "—" : pm25[idx].toFixed(1) + " µg/m³");
    $("pm10").textContent = (pm10[idx] === null ? "—" : pm10[idx].toFixed(1) + " µg/m³");
    var ratio = pm25[idx] === null ? null : pm25[idx] / WHO_PM25_24H;
    $("whoLine").textContent = ratio === null ? "—" :
      (ratio < 1 ? "Under the WHO line" : ratio.toFixed(1) + "× the WHO 24-hour line (15 µg/m³)");
    var nowCard = $("nowCard");
    nowCard.hidden = false;
    nowCard.style.borderTopColor = band ? band.color : "";

    /* Rest-of-today hours */
    var rest = [];
    for (var i = idx; i < times.length && times[i].slice(0, 10) === today; i++) {
      rest.push({ time: times[i], aqi: aqi[i] });
    }

    /* Planner */
    var limit = PROFILES[state.profile].limit;
    var res = bestWindows(rest, limit);
    var winBox = $("windows");
    winBox.innerHTML = "";
    $("plannerSub").textContent = "For a " + PROFILES[state.profile].label.toLowerCase() +
      " profile — outdoor exercise is fine at AQI " + limit + " or under.";
    if (res.windows.length) {
      res.windows.forEach(function (w) {
        var b = bandFor(w.mean);
        var div = document.createElement("div");
        div.className = "window";
        div.innerHTML =
          '<div class="w-time">' + fmtHour(hourOf(w.from.time)) + " – " + fmtHour(hourOf(w.to.time) + 1) + '</div>' +
          '<div class="w-aqi" style="background:' + b.color + '"><small>US AQI</small>' + w.mean + "</div>" +
          '<div class="w-body"><p class="w-activity">' + activityFor(hourOf(w.from.time)) + " · " + b.name + "</p>" +
          '<p class="w-advice">' + windowAdvice(w.mean, limit, state.profile) + "</p></div>";
        winBox.appendChild(div);
      });
    } else if (res.leastBad) {
      var lb = res.leastBad, lbb = bandFor(lb.mean);
      var div2 = document.createElement("div");
      div2.className = "window";
      div2.innerHTML =
        '<div class="w-time">' + fmtHour(hourOf(lb.from.time)) + " – " + fmtHour(hourOf(lb.to.time) + 1) + '</div>' +
        '<div class="w-aqi" style="background:' + lbb.color + '"><small>US AQI</small>' + lb.mean + "</div>" +
        '<div class="w-body"><p class="w-activity">Least bad window · ' + lbb.name + "</p>" +
        '<p class="w-advice">No window today is under the safe line for this profile. ' +
        "If you must go out, this is the best of a bad day — keep it short and wear a mask.</p></div>";
      winBox.appendChild(div2);
    } else {
      winBox.innerHTML = '<p class="no-window">No forecast hours left today to plan from.</p>';
    }
    $("plannerCard").hidden = false;

    /* Timeline */
    var tl = $("timeline");
    tl.innerHTML = "";
    var maxAqi = 300;
    rest.forEach(function (h) {
      var b = bandFor(h.aqi);
      var bar = document.createElement("div");
      bar.className = "bar";
      var pct = h.aqi === null ? 0 : Math.min(100, (h.aqi / maxAqi) * 100);
      bar.innerHTML = "<b>" + (h.aqi === null ? "—" : Math.round(h.aqi)) + "</b>" +
        '<i style="height:' + Math.max(pct, 2) + '%;background:' + (b ? b.color : "#999") + '" title="' +
        (b ? b.name : "No reading") + '"></i><span>' + fmtHour(hourOf(h.time)) + "</span>";
      tl.appendChild(bar);
    });
    $("timelineCard").hidden = false;

    /* Tomorrow peek: tomorrow 6am–10am mean AQI */
    var tmr = [];
    for (var k = idx; k < times.length; k++) {
      var d = times[k].slice(0, 10), h = hourOf(times[k]);
      if (d !== today && h >= 6 && h <= 10 && aqi[k] !== null) tmr.push(aqi[k]);
    }
    if (tmr.length) {
      var mean = Math.round(tmr.reduce(function (s, v) { return s + v; }, 0) / tmr.length);
      var tb = bandFor(mean);
      $("tomorrowLine").textContent = "Tomorrow morning (6–10am) looks " + tb.name.toLowerCase() +
        ", around AQI " + mean + ". " + tb.line;
      $("tomorrowCard").hidden = false;
    } else {
      $("tomorrowCard").hidden = true;
    }
  }

  function loadCity(city) {
    state.city = city;
    document.querySelectorAll("#cityChips .chip").forEach(function (c) {
      c.classList.toggle("active", c.textContent === city.name);
    });
    showLoading(city.name);
    fetchAQ(city.lat, city.lon).then(function (data) {
      state.data = data;
      setStatus("");
      render(data);
    }).catch(function (err) {
      showError(err.message || "Network error.", function () { loadCity(city); });
    });
  }

  function buildChips() {
    var box = $("cityChips");
    CITIES.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (c.name === state.city.name ? " active" : "");
      b.textContent = c.name;
      b.addEventListener("click", function () { loadCity(c); });
      box.appendChild(b);
    });
  }

  function bindSearch() {
    var input = $("citySearch");
    var results = $("searchResults");
    function doSearch() {
      var q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ""; return; }
      results.innerHTML = '<li class="empty">Searching&hellip;</li>';
      geocode(q).then(function (list) {
        results.innerHTML = "";
        if (!list.length) {
          results.innerHTML = '<li class="empty">No place found for &ldquo;' + q + "&rdquo;. Try another spelling.</li>";
          return;
        }
        list.forEach(function (r) {
          var li = document.createElement("li");
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country ? " (" + r.country + ")" : "");
          b.addEventListener("click", function () {
            results.innerHTML = "";
            input.value = "";
            loadCity({ name: r.name, lat: r.latitude, lon: r.longitude });
          });
          li.appendChild(b);
          results.appendChild(li);
        });
      }).catch(function () {
        results.innerHTML = '<li class="empty">Place search failed. Check your connection and try again.</li>';
      });
    }
    $("searchBtn").addEventListener("click", doSearch);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
  }

  function bindProfiles() {
    document.querySelectorAll("#profileBtns .profile-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.profile = b.getAttribute("data-profile");
        document.querySelectorAll("#profileBtns .profile-btn").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("active", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (state.data) render(state.data);
      });
    });
  }

  /* Node test hook: pure functions exported when loaded under Node. */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { bandFor: bandFor, bestWindows: bestWindows, windowAdvice: windowAdvice,
      profileVerdict: profileVerdict, activityFor: activityFor, fmtHour: fmtHour,
      PROFILES: PROFILES, BANDS: BANDS, CITIES: CITIES, nowIndex: nowIndex };
  } else {
    buildChips();
    bindSearch();
    bindProfiles();
    loadCity(state.city);
  }
})();
