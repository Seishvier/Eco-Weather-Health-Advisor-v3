/* =========================================================
   AeroVita — front-end logic
   Data source: Open-Meteo (no API key required)
   ========================================================= */

(() => {
  "use strict";

  /* ---------- API endpoints ---------- */
  const GEOCODE_URL  = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const AIR_URL      = "https://air-quality-api.open-meteo.com/v1/air-quality";
  const REVERSE_URL  = "https://api.bigdatacloud.net/data/reverse-geocode-client";
  const QR_API       = "https://api.qrserver.com/v1/create-qr-code/";

  /* ---------- Default place (used if geolocation fails) ---------- */
  const DEFAULT_PLACE = {
    name: "Jakarta",
    country: "Indonesia",
    admin1: "",
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: "Asia/Jakarta"
  };

  /* ---------- App state ---------- */
  const state = {
    place: null,
    weather: null,
    air: null,
    loading: false
  };

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const els = {
    sidebar: $("sidebar"),
    scrim: $("scrim"),
    menuBtn: $("menuBtn"),
    sidebarClose: $("sidebarClose"),
    nav: $("nav"),
    topbarTitle: $("topbarTitle"),
    refreshBtn: $("refreshBtn"),
    cityInput: $("cityInput"),
    suggest: $("suggest"),
    locBtn: $("locBtn"),
    loadbar: $("loadbar"),
    toast: $("toast"),
    // dashboard
    heroCard: $("heroCard"),
    heroImg: $("heroImg"),
    heroCity: $("heroCity"),
    heroSub: $("heroSub"),
    heroIcon: $("heroIcon"),
    heroTemp: $("heroTemp"),
    heroCond: $("heroCond"),
    heroStrip: $("heroStrip"),
    statGrid: $("statGrid"),
    chartBox: $("chartBox"),
    chartMeta: $("chartMeta"),
    forecastList: $("forecastList"),
    sunMeta: $("sunMeta"),
    // air
    aqiPill: $("aqiPill"),
    gauge: $("gauge"),
    aqiNote: $("aqiNote"),
    pollutants: $("pollutants"),
    airAdvice: $("airAdvice"),
    // health / agri
    healthList: $("healthList"),
    agriList: $("agriList"),
    // business / qr
    qrSide: $("qrSide"),
    qrBig: $("qrBig"),
    copyLinkBtn: $("copyLinkBtn"),
    openLinkBtn: $("openLinkBtn")
  };

  /* =========================================================
     HELPERS
     ========================================================= */
  const weatherCodeText = (code) => {
    const map = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      56: "Light freezing drizzle", 57: "Dense freezing drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      66: "Light freezing rain", 67: "Heavy freezing rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
      77: "Snow grains",
      80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      85: "Slight snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
    };
    return map[code] || "Unknown";
  };

  const weatherCodeEmoji = (code, isDay = true) => {
    if (code === 0) return isDay ? "☀️" : "🌙";
    if (code === 1) return isDay ? "🌤️" : "🌙";
    if (code === 2) return "⛅";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 57) return "🌦️";
    if (code >= 61 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 80 && code <= 82) return "🌧️";
    if (code >= 85 && code <= 86) return "🌨️";
    if (code >= 95) return "⛈️";
    return "🌡️";
  };

  const heroPhoto = (code, isDay) => {
    if (!isDay) return "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1600&q=70";
    if (code === 0 || code === 1) return "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1600&q=70";
    if (code === 2 || code === 3) return "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=70";
    if (code === 45 || code === 48) return "https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&w=1600&q=70";
    if (code >= 51 && code <= 67) return "https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=1600&q=70";
    if (code >= 71 && code <= 77) return "https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=1600&q=70";
    if (code >= 80 && code <= 86) return "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1600&q=70";
    if (code >= 95) return "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=1600&q=70";
    return "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1600&q=70";
  };

  const dayLabel = (iso) => {
    const d = new Date(iso + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString(undefined, { weekday: "short" });
  };

  const fmtHour = (iso) => {
    const d = new Date(iso);
    return d.getHours().toString().padStart(2, "0") + ":00";
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const round = (n) => (n == null || isNaN(n) ? "—" : Math.round(n * 10) / 10);

  /* ---------- Toast ---------- */
  let toastTimer;
  const toast = (msg) => {
    els.toast.textContent = msg;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  };

  /* ---------- Load bar ---------- */
  const startLoad = () => {
    els.loadbar.classList.remove("is-done");
    els.loadbar.classList.add("is-loading");
  };
  const endLoad = () => {
    els.loadbar.classList.remove("is-loading");
    els.loadbar.classList.add("is-done");
    setTimeout(() => els.loadbar.classList.remove("is-done"), 500);
  };

  /* =========================================================
     NAVIGATION / SIDEBAR
     ========================================================= */
  const closeSidebar = () => {
    els.sidebar.classList.remove("is-open");
    els.scrim.classList.remove("is-open");
  };
  const openSidebar = () => {
    els.sidebar.classList.add("is-open");
    els.scrim.classList.add("is-open");
  };
  els.menuBtn.addEventListener("click", openSidebar);
  els.sidebarClose.addEventListener("click", closeSidebar);
  els.scrim.addEventListener("click", closeSidebar);

  const setView = (view) => {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    const target = $("view-" + view);
    if (target) target.classList.add("is-active");
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.view === view);
    });
    const titleEl = target ? target.dataset.title : "Dashboard";
    els.topbarTitle.textContent = titleEl || "Dashboard";
    if (window.innerWidth < 1024) closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  els.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (btn) setView(btn.dataset.view);
  });

  /* =========================================================
     SEARCH / SUGGEST
     ========================================================= */
  let suggestTimer;
  let suggestResults = [];
  let suggestFocus = -1;

  const renderSuggest = (results) => {
    suggestResults = results;
    suggestFocus = -1;
    if (!results.length) {
      els.suggest.classList.remove("is-open");
      els.suggest.innerHTML = "";
      return;
    }
    els.suggest.innerHTML = results
      .map((r, i) => {
        const region = [r.admin1, r.country].filter(Boolean).join(", ");
        return `<button class="suggest-item" data-i="${i}">
          <span>${r.name}</span>
          <small>${region}</small>
        </button>`;
      })
      .join("");
    els.suggest.classList.add("is-open");
  };

  const pickSuggest = (r) => {
    els.cityInput.value = r.name;
    els.suggest.classList.remove("is-open");
    els.suggest.innerHTML = "";
    loadPlace({
      name: r.name,
      country: r.country || "",
      admin1: r.admin1 || "",
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone || "auto"
    });
  };

  els.suggest.addEventListener("click", (e) => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;
    pickSuggest(suggestResults[Number(item.dataset.i)]);
  });

  els.cityInput.addEventListener("input", () => {
    const q = els.cityInput.value.trim();
    clearTimeout(suggestTimer);
    if (q.length < 2) {
      els.suggest.classList.remove("is-open");
      return;
    }
    suggestTimer = setTimeout(async () => {
      try {
        const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        renderSuggest(data.results || []);
      } catch {
        /* silent */
      }
    }, 260);
  });

  els.cityInput.addEventListener("keydown", (e) => {
    if (!els.suggest.classList.contains("is-open")) {
      if (e.key === "Enter" && els.cityInput.value.trim()) {
        e.preventDefault();
        els.cityInput.blur();
        // fall back to first geocode result
        fetch(`${GEOCODE_URL}?name=${encodeURIComponent(els.cityInput.value.trim())}&count=1&language=en&format=json`)
          .then((r) => r.json())
          .then((d) => { if (d.results?.[0]) pickSuggest(d.results[0]); })
          .catch(() => toast("Could not find that city"));
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestFocus = Math.min(suggestFocus + 1, suggestResults.length - 1);
      updateSuggestFocus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestFocus = Math.max(suggestFocus - 1, 0);
      updateSuggestFocus();
    } else if (e.key === "Enter" && suggestFocus >= 0) {
      e.preventDefault();
      pickSuggest(suggestResults[suggestFocus]);
    } else if (e.key === "Escape") {
      els.suggest.classList.remove("is-open");
    }
  });

  const updateSuggestFocus = () => {
    els.suggest.querySelectorAll(".suggest-item").forEach((el, i) => {
      el.classList.toggle("is-focus", i === suggestFocus);
    });
    const focusEl = els.suggest.querySelectorAll(".suggest-item")[suggestFocus];
    if (focusEl) focusEl.scrollIntoView({ block: "nearest" });
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) els.suggest.classList.remove("is-open");
  });

  /* =========================================================
     GEOLOCATION
     ========================================================= */
  els.locBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Geolocation not supported — using default city");
      loadPlace(DEFAULT_PLACE);
      return;
    }
    startLoad();
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const url = `${REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
          const res = await fetch(url);
          const d = await res.json();
          const cityName = d.city || d.locality || d.principalSubdivision || "Your location";
          loadPlace({
            name: cityName,
            country: d.countryName || "",
            admin1: d.principalSubdivision || "",
            latitude,
            longitude,
            timezone: "auto"
          });
        } catch {
          loadPlace({
            name: "Your location",
            country: "",
            admin1: "",
            latitude,
            longitude,
            timezone: "auto"
          });
        }
      },
      () => {
        endLoad();
        toast("Location permission denied — using default city");
        loadPlace(DEFAULT_PLACE);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });

  /* =========================================================
     LOAD PLACE — WEATHER + AIR
     ========================================================= */
  async function loadPlace(place) {
    if (state.loading) return;
    state.loading = true;
    startLoad();
    state.place = place;

    try {
      const lat = place.latitude;
      const lon = place.longitude;

      const weatherUrl =
        `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
        `&hourly=temperature_2m,precipitation_probability,weather_code,relative_humidity_2m,wind_speed_10m,soil_moisture_0_to_1cm` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max` +
        `&timezone=auto&forecast_days=7`;

      const airUrl =
        `${AIR_URL}?latitude=${lat}&longitude=${lon}` +
        `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi,us_aqi` +
        `&timezone=auto`;

      const [wRes, aRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
      if (!wRes.ok || !aRes.ok) throw new Error("API error");

      state.weather = await wRes.json();
      state.air = await aRes.json();

      renderAll();
      endLoad();
    } catch (err) {
      console.error(err);
      toast("Could not load data — try again");
      endLoad();
    } finally {
      state.loading = false;
    }
  }

  els.refreshBtn.addEventListener("click", () => {
    if (state.place) loadPlace(state.place);
  });

  /* =========================================================
     RENDER
     ========================================================= */
  function renderAll() {
    renderHero();
    renderStats();
    renderChart();
    renderForecast();
    renderAir();
    renderHealth();
    renderAgri();
    renderQR();
  }

  /* ---------- Hero ---------- */
  function renderHero() {
    const w = state.weather.current;
    const d = state.weather.daily;
    const p = state.place;

    const isDay = w.is_day === 1;
    const code = w.weather_code;
    const emoji = weatherCodeEmoji(code, isDay);
    const photo = heroPhoto(code, isDay);

    els.heroImg.src = photo;
    els.heroImg.alt = weatherCodeText(code);

    const region = [p.admin1, p.country].filter(Boolean).join(", ");
    els.heroCity.textContent = p.name + (region ? `, ${region}` : "");
    els.heroSub.textContent = `${weatherCodeText(code)} · feels like ${round(w.apparent_temperature)}°C`;

    els.heroIcon.textContent = emoji;
    els.heroTemp.textContent = round(w.temperature_2m);
    els.heroCond.textContent = weatherCodeText(code);

    // strip
    const uv = d.uv_index_max?.[0];
    const rainChance = d.precipitation_probability_max?.[0];
    els.heroStrip.innerHTML = `
      <div><span class="lbl">Humidity</span><span class="val">${round(w.relative_humidity_2m)}%</span></div>
      <div><span class="lbl">Wind</span><span class="val">${round(w.wind_speed_10m)} km/h</span></div>
      <div><span class="lbl">UV index</span><span class="val">${round(uv)}</span></div>
      <div><span class="lbl">Rain chance</span><span class="val">${round(rainChance)}%</span></div>
    `;
  }

  /* ---------- Stat cards ---------- */
  function renderStats() {
    const w = state.weather.current;
    const d = state.weather.daily;
    const air = state.air.current;
    const aqi = air.european_aqi;
    const aqiLabel = aqiLabelFor(aqi);

    const stats = [
      { lbl: "Temperature", val: round(w.temperature_2m), unit: "°C", sub: `Feels ${round(w.apparent_temperature)}°` },
      { lbl: "Air Quality", val: aqiLabel, unit: "", sub: `EAQI ${Math.round(aqi ?? 0)}` },
      { lbl: "Wind", val: round(w.wind_speed_10m), unit: "km/h", sub: `${windDir(w.wind_direction_10m)}` },
      { lbl: "Precipitation", val: round(w.precipitation), unit: "mm", sub: `Today ${round(d.precipitation_sum?.[0])} mm` }
    ];

    els.statGrid.innerHTML = stats
      .map(
        (s) => `
        <div class="stat">
          <span class="lbl">${s.lbl}</span>
          <span class="val">${s.val}${s.unit ? `<small>${s.unit}</small>` : ""}</span>
          <span class="sub">${s.sub}</span>
        </div>`
      )
      .join("");
  }

  function windDir(deg) {
    if (deg == null) return "—";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8] + " wind";
  }

  /* ---------- Chart ---------- */
  function renderChart() {
    const h = state.weather.hourly;
    if (!h) return;

    const now = Date.now();
    const idx = h.time.findIndex((t) => new Date(t).getTime() >= now);
    const start = idx >= 0 ? idx : 0;
    const slice = [];
    for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
      slice.push({
        time: h.time[i],
        temp: h.temperature_2m[i],
        precipProb: h.precipitation_probability[i] ?? 0
      });
    }
    if (!slice.length) return;

    els.chartMeta.textContent = `${fmtHour(slice[0].time)} → ${fmtHour(slice[slice.length - 1].time)}`;

    const W = 720, H = 220, padL = 34, padR = 16, padT = 18, padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const temps = slice.map((s) => s.temp);
    const tMin = Math.min(...temps) - 2;
    const tMax = Math.max(...temps) + 2;
    const tRange = Math.max(tMax - tMin, 1);

    const x = (i) => padL + (i / (slice.length - 1)) * innerW;
    const y = (t) => padT + (1 - (t - tMin) / tRange) * innerH;

    let linePath = "";
    slice.forEach((s, i) => {
      linePath += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(s.temp).toFixed(1);
    });

    // gradient area under the line
    const areaPath = `${linePath} L ${x(slice.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

    // precip bars
    let bars = "";
    const barW = (innerW / slice.length) * 0.55;
    slice.forEach((s, i) => {
      const prob = s.precipProb || 0;
      const bh = (prob / 100) * innerH * 0.55;
      if (bh < 0.5) return;
      const bx = x(i) - barW / 2;
      const by = padT + innerH - bh;
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2.5" fill="url(#barGrad)" opacity="0.85"/>`;
    });

    // x labels every 4 hours
    let labels = "";
    slice.forEach((s, i) => {
      if (i % 4 === 0 || i === slice.length - 1) {
        const label = fmtHour(s.time);
        labels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="rgba(234,255,245,0.5)" font-family="inherit">${label}</text>`;
      }
    });

    // y labels + grid
    let yLabels = "";
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (tRange / steps) * i;
      const yy = y(t);
      yLabels += `<text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(234,255,245,0.4)" font-family="inherit">${Math.round(t)}°</text>`;
      yLabels += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    }

    els.chartBox.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:auto;display:block">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#7ef2b0"/>
            <stop offset="1" stop-color="#5eead4"/>
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(126,242,176,0.28)"/>
            <stop offset="1" stop-color="rgba(126,242,176,0)"/>
          </linearGradient>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#4ade80"/>
            <stop offset="1" stop-color="#22d3ee"/>
          </linearGradient>
        </defs>
        ${yLabels}
        ${bars}
        <path d="${areaPath}" fill="url(#areaGrad)"/>
        <path d="${linePath}" fill="none" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${labels}
      </svg>`;
  }

  /* ---------- Forecast ---------- */
  function renderForecast() {
    const d = state.weather.daily;
    if (!d) return;

    const days = d.time.map((iso, i) => ({
      iso,
      code: d.weather_code[i],
      tMax: d.temperature_2m_max[i],
      tMin: d.temperature_2m_min[i],
      precip: d.precipitation_probability_max?.[i] ?? 0
    }));

    const allMax = Math.max(...days.map((d) => d.tMax));
    const allMin = Math.min(...days.map((d) => d.tMin));

    els.forecastList.innerHTML = days
      .map((d) => {
        const range = Math.max(allMax - allMin, 1);
        const pct = ((d.tMax - allMin) / range) * 100;
        return `
          <li>
            <span class="day">${dayLabel(d.iso)}</span>
            <span class="ico" aria-hidden="true">${weatherCodeEmoji(d.code, true)}</span>
            <span class="temp">
              <span class="min">${Math.round(d.tMin)}°</span>
              <span class="bar" style="width:${pct.toFixed(0)}%"></span>
              <span class="max">${Math.round(d.tMax)}°</span>
            </span>
            <span class="num" style="color:var(--muted);font-size:12px">${Math.round(d.precip)}%</span>
          </li>`;
      })
      .join("");

    els.sunMeta.textContent = `Sunrise ${fmtTime(d.sunrise?.[0])} · Sunset ${fmtTime(d.sunset?.[0])}`;
  }

  /* =========================================================
     AIR QUALITY
     ========================================================= */
  function aqiLabelFor(aqi) {
    if (aqi == null) return "—";
    if (aqi <= 10) return "Good";
    if (aqi <= 20) return "Fair";
    if (aqi <= 25) return "Moderate";
    if (aqi <= 50) return "Poor";
    if (aqi <= 75) return "Very poor";
    return "Extremely poor";
  }

  function aqiColorFor(aqi) {
    if (aqi == null) return "#7ef2b0";
    if (aqi <= 10) return "#4ade80";
    if (aqi <= 20) return "#a3e635";
    if (aqi <= 25) return "#fbbf24";
    if (aqi <= 50) return "#fb923c";
    if (aqi <= 75) return "#f87171";
    return "#c084fc";
  }

  function renderAir() {
    const air = state.air.current;
    const aqi = air.european_aqi ?? 0;
    const label = aqiLabelFor(aqi);
    const color = aqiColorFor(aqi);

    els.aqiPill.textContent = label;
    els.aqiPill.style.color = color;
    els.aqiPill.style.borderColor = color + "66";
    els.aqiPill.style.background = color + "18";

    // gauge (half circle)
    const W = 260, H = 150, cx = W / 2, cy = H - 18, r = 96;
    const startAngle = Math.PI;
    const endAngle = 0;
    const frac = Math.min(Math.max(aqi / 100, 0), 1);
    const angle = startAngle + (endAngle - startAngle) * frac;
    const needleX = cx + Math.cos(angle) * (r - 14);
    const needleY = cy + Math.sin(angle) * (r - 14);

    // arc segments
    const arc = (from, to, col) => {
      const a1 = Math.PI + (Math.PI) * from;
      const a2 = Math.PI + (Math.PI) * to;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
      const large = to - from > 0.5 ? 1 : 0;
      return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round"/>`;
    };

    const segments = [
      [0.0, 0.1, "#4ade80"],
      [0.1, 0.2, "#a3e635"],
      [0.2, 0.25, "#fbbf24"],
      [0.25, 0.5, "#fb923c"],
      [0.5, 0.75, "#f87171"],
      [0.75, 1.0, "#c084fc"]
    ];

    els.gauge.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}">
        ${segments.map(([a, b, c]) => arc(a, b, c + "55")).join("")}
        <line x1="${cx}" y1="${cy}" x2="${needleX.toFixed(1)}" y2="${needleY.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>
        <text x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="28" font-family="Instrument Serif, serif" fill="${color}">${Math.round(aqi)}</text>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="10" letter-spacing="2" fill="rgba(234,255,245,0.55)">EAQI</text>
      </svg>`;

    const note = {
      "Good": "Air quality is clean. Outdoor activity is safe for everyone.",
      "Fair": "Air quality is acceptable. Unusually sensitive people should consider reducing prolonged outdoor exertion.",
      "Moderate": "Sensitive groups (children, elderly, asthmatics) should limit prolonged outdoor activity.",
      "Poor": "Everyone may begin to experience health effects. Limit outdoor exertion.",
      "Very poor": "Health alert: everyone may experience more serious effects. Avoid outdoor activity.",
      "Extremely poor": "Emergency conditions. Stay indoors, keep windows closed, use air purifiers."
    }[label] || "Data unavailable.";
    els.aqiNote.textContent = note;

    // pollutants
    const pollutants = [
      { name: "PM2.5", val: air.pm2_5, unit: "µg/m³", max: 100 },
      { name: "PM10", val: air.pm10, unit: "µg/m³", max: 150 },
      { name: "O₃", val: air.ozone, unit: "µg/m³", max: 180 },
      { name: "NO₂", val: air.nitrogen_dioxide, unit: "µg/m³", max: 120 },
      { name: "SO₂", val: air.sulphur_dioxide, unit: "µg/m³", max: 80 },
      { name: "CO", val: air.carbon_monoxide, unit: "µg/m³", max: 4000 }
    ];

    els.pollutants.innerHTML = pollutants
      .map((p) => {
        const v = p.val ?? 0;
        const pct = Math.min((v / p.max) * 100, 100);
        return `
          <li>
            <span class="name">${p.name}</span>
            <span class="track"><span class="fill" style="width:${pct.toFixed(1)}%"></span></span>
            <span class="num">${round(v)}</span>
          </li>`;
      })
      .join("");

    // air advice
    const advice = [];
    if (aqi <= 10) advice.push({ level: "good", icon: "🌿", title: "Great air day", text: "Perfect conditions for a run, cycle or outdoor work. Open the windows." });
    if (aqi > 20 && aqi <= 50) advice.push({ level: "warn", icon: "😷", title: "Sensitive groups take care", text: "Asthmatics and young children should shorten outdoor sessions." });
    if (aqi > 50) advice.push({ level: "bad", icon: "⚠️", title: "Stay indoors if you can", text: "Consider an indoor workout and keep windows closed until conditions improve." });
    if ((air.pm2_5 ?? 0) > 25) advice.push({ level: "warn", icon: "🌫️", title: "High fine particulates", text: "PM2.5 can penetrate deep into lungs. A well-fitted N95 mask helps outdoors." });
    if ((air.ozone ?? 0) > 100) advice.push({ level: "warn", icon: "☀️", title: "Elevated ozone", text: "Ozone peaks in the afternoon. Schedule outdoor activity before 11am or after 6pm." });
    if (!advice.length) advice.push({ level: "good", icon: "✅", title: "All clear", text: "No air-quality concerns at your location right now." });

    els.airAdvice.innerHTML = advice
      .map(
        (a) => `
        <div class="advice level-${a.level}">
          <div class="advice-ico">${a.icon}</div>
          <div class="advice-body">
            <h4>${a.title}</h4>
            <p>${a.text}</p>
          </div>
        </div>`
      )
      .join("");
  }

  /* =========================================================
     HEALTH ADVICE
     ========================================================= */
  function renderHealth() {
    const w = state.weather.current;
    const d = state.weather.daily;
    const air = state.air.current;

    const temp = w.temperature_2m;
    const hum = w.relative_humidity_2m;
    const uv = d.uv_index_max?.[0] ?? 0;
    const aqi = air.european_aqi ?? 0;
    const wind = w.wind_speed_10m;

    const items = [];

    // Heat
    if (temp >= 32) items.push({ level: "warn", icon: "🥵", title: "Heat stress risk", text: "Drink water every 20 minutes. Avoid outdoor exertion between 11am and 4pm." });
    else if (temp >= 27) items.push({ level: "good", icon: "💧", title: "Warm day — stay hydrated", text: "Carry a water bottle. Light, breathable clothing works best." });
    else if (temp <= 10) items.push({ level: "warn", icon: "🧥", title: "Cold — layer up", text: "Wear an insulating mid-layer and cover extremities. Cold can raise blood pressure." });
    else items.push({ level: "good", icon: "🌤️", title: "Comfortable temperature", text: "Thermal conditions are pleasant for most outdoor activity." });

    // UV
    if (uv >= 8) items.push({ level: "bad", icon: "🧴", title: "Very high UV", text: "SPF 50+, hat, sunglasses, and shade during midday. Risk of sunburn in <15 minutes." });
    else if (uv >= 6) items.push({ level: "warn", icon: "🕶️", title: "High UV", text: "Use SPF 30+, a hat and sunglasses. Seek shade between 11am and 3pm." });
    else if (uv >= 3) items.push({ level: "good", icon: "☀️", title: "Moderate UV", text: "Sunscreen advised for extended outdoor time. Safe for most skin types." });

    // AQI
    if (aqi > 25) items.push({ level: "warn", icon: "😷", title: "Air quality advisory", text: `EAQI is ${Math.round(aqi)} — sensitive groups should reduce outdoor exercise.` });
    else items.push({ level: "good", icon: "🌿", title: "Air is clean", text: "Outdoor breathing is safe. Great time for exercise or a walk." });

    // Humidity
    if (hum >= 80) items.push({ level: "warn", icon: "💦", title: "Very humid", text: "Sweat evaporates slowly — pace yourself and take frequent breaks." });
    else if (hum <= 30) items.push({ level: "warn", icon: "🫧", title: "Dry air", text: "Use moisturiser and stay hydrated. Dry air can irritate airways." });

    // Wind
    if (wind >= 30) items.push({ level: "warn", icon: "🌬️", title: "Strong wind", text: "Secure loose items outdoors. Cyclists should take extra care." });

    // Water
    items.push({ level: "good", icon: "🚰", title: "Hydration reminder", text: "Aim for 2–2.5 L of water today, more if you exercise or sweat heavily." });

    els.healthList.innerHTML = items
      .map(
        (a) => `
        <div class="advice level-${a.level}">
          <div class="advice-ico">${a.icon}</div>
          <div class="advice-body">
            <h4>${a.title}</h4>
            <p>${a.text}</p>
          </div>
        </div>`
      )
      .join("");
  }

  /* =========================================================
     AGRICULTURE ADVICE
     ========================================================= */
  function renderAgri() {
    const w = state.weather.current;
    const d = state.weather.daily;
    const h = state.weather.hourly;
    const air = state.air.current;

    const temp = w.temperature_2m;
    const wind = w.wind_speed_10m;
    const precipToday = d.precipitation_sum?.[0] ?? 0;
    const precipNext24 = d.precipitation_probability_max?.[0] ?? 0;
    const soil = h.soil_moisture_0_to_1cm;
    const soilNow = soil && soil.length ? soil[0] : null;

    const items = [];

    // Irrigation
    if (precipNext24 >= 60) {
      items.push({ level: "good", icon: "🌧️", title: "Skip irrigation", text: `Rain is ${Math.round(precipNext24)}% likely in the next 24h. Save water — natural rainfall will cover the field.` });
    } else if (soilNow != null && soilNow < 0.15) {
      items.push({ level: "warn", icon: "💧", title: "Irrigate today", text: "Surface soil moisture is low (<15%). Water early morning or late afternoon to reduce evaporation." });
    } else if (soilNow != null && soilNow > 0.35) {
      items.push({ level: "good", icon: "✅", title: "Soil moisture is adequate", text: "No irrigation needed today. Check again after 24–48 hours." });
    } else {
      items.push({ level: "good", icon: "🌱", title: "Monitor soil moisture", text: "Conditions are balanced. Re-check tomorrow before irrigating." });
    }

    // Spraying
    if (wind >= 20) {
      items.push({ level: "bad", icon: "🚫", title: "Avoid spraying pesticides", text: `Wind at ${round(wind)} km/h will cause drift and reduce efficacy. Wait for calmer conditions.` });
    } else if (precipNext24 >= 50) {
      items.push({ level: "warn", icon: "🌦️", title: "Delay spraying", text: "Rain is likely — applied chemicals may wash off. Spray after the rain passes." });
    } else if (wind < 12) {
      items.push({ level: "good", icon: "🎯", title: "Good spraying window", text: "Low wind and dry conditions. Ideal for foliar application this morning." });
    }

    // Temperature stress
    if (temp >= 34) items.push({ level: "bad", icon: "🔥", title: "Heat stress alert", text: "Shade-sensitive crops may wilt. Irrigate before 9am and consider shade netting." });
    else if (temp <= 5) items.push({ level: "bad", icon: "❄️", title: "Frost risk", text: "Cover sensitive plants overnight. Frost can damage flowers and young fruit." });

    // Rainfall total
    if (precipToday >= 20) items.push({ level: "warn", icon: "🌊", title: "Heavy rain expected", text: `~${round(precipToday)} mm today. Check drainage and harvest ripe produce before it arrives.` });

    // Humidity
    const hum = w.relative_humidity_2m;
    if (hum >= 85) items.push({ level: "warn", icon: "🍄", title: "Fungal disease pressure", text: "High humidity favours fungal pathogens. Scout leaves and improve airflow between plants." });
    else if (hum <= 40) items.push({ level: "good", icon: "🌾", title: "Low disease pressure", text: "Dry air keeps fungal risk low — a good window for field scouting." });

    // UV for photosynthesis note
    const uv = d.uv_index_max?.[0] ?? 0;
    if (uv >= 8) items.push({ level: "warn", icon: "☀️", title: "Very high UV", text: "Strong midday sun can scorch tender leaves. Irrigate early to reduce stress." });

    // Pollination note
    if (wind < 15 && precipNext24 < 40 && temp > 15 && temp < 32) {
      items.push({ level: "good", icon: "🐝", title: "Good pollination window", text: "Calm, warm conditions are ideal for bee activity and pollination." });
    }

    els.agriList.innerHTML = items
      .map(
        (a) => `
        <div class="advice level-${a.level}">
          <div class="advice-ico">${a.icon}</div>
          <div class="advice-body">
            <h4>${a.title}</h4>
            <p>${a.text}</p>
          </div>
        </div>`
      )
      .join("");
  }

  /* =========================================================
     QR CODE
     ========================================================= */
  function renderQR() {
    const url = window.location.href.split("#")[0];
    const sideSrc = `${QR_API}?size=300x300&margin=0&data=${encodeURIComponent(url)}`;
    const bigSrc  = `${QR_API}?size=500x500&margin=0&data=${encodeURIComponent(url)}`;
    if (els.qrSide) els.qrSide.src = sideSrc;
    if (els.qrBig)  els.qrBig.src  = bigSrc;
    if (els.openLinkBtn) els.openLinkBtn.href = url;
  }

  els.copyLinkBtn.addEventListener("click", async () => {
    const url = window.location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Link copied");
    }
  });

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    renderQR();

    // Try geolocation first (silently), fall back to default after a timeout
    if (navigator.geolocation) {
      let settled = false;
      const fallback = setTimeout(() => {
        if (!settled) {
          settled = true;
          loadPlace(DEFAULT_PLACE);
        }
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(fallback);
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch(`${REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const d = await res.json();
            loadPlace({
              name: d.city || d.locality || d.principalSubdivision || "Your location",
              country: d.countryName || "",
              admin1: d.principalSubdivision || "",
              latitude,
              longitude,
              timezone: "auto"
            });
          } catch {
            loadPlace({
              name: "Your location",
              country: "",
              admin1: "",
              latitude,
              longitude,
              timezone: "auto"
            });
          }
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(fallback);
          loadPlace(DEFAULT_PLACE);
        },
        { timeout: 4500, maximumAge: 60000 }
      );
    } else {
      loadPlace(DEFAULT_PLACE);
    }
  }

  // Expose a tiny API for debugging
  window.AeroVita = { state, loadPlace, DEFAULT_PLACE };

  document.addEventListener("DOMContentLoaded", boot);
})();
