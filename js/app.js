// Navigation + Rendering der Views. Kein Framework, direktes DOM-Rendering.
(() => {
  const viewEl = document.getElementById('view');
  const headerEl = document.getElementById('app-header');
  const navEl = document.getElementById('bottom-nav');
  const navButtons = document.querySelectorAll('.nav-btn');

  const FISCH_ARTEN = [
    'Hecht', 'Zander', 'Barsch', 'Karpfen', 'Schleie', 'Aal', 'Wels',
    'Bachforelle', 'Regenbogenforelle', 'Döbel', 'Rotauge', 'Rotfeder',
    'Brasse', 'Rapfen', 'Äsche',
  ];
  const KOEDER_KATEGORIEN = [
    'Kunstköder', 'Naturköder', 'Gummiköder', 'Wobbler', 'Blinker/Spoon',
    'Spinner', 'Jig', 'Popper/Topwater', 'Boilie',
  ];

  navButtons.forEach(btn => {
    const iconSpan = btn.querySelector('[data-icon]');
    iconSpan.innerHTML = Icons.svg(iconSpan.dataset.icon);
  });
  document.getElementById('settings-btn').innerHTML = Icons.svg('gear', { size: 20 });

  const VIEWS = {
    start: renderStart,
    gewaesser: renderGewaesser,
    fanglog: renderFanglog,
    koeder: renderKoeder,
    wetter: renderWetter,
    trips: renderTrips,
    gruppen: renderGruppen,
    einstellungen: renderEinstellungen,
    impressum: () => renderImpressum(false),
  };

  // Bearbeiten-Status je View
  let gewaesserEditId = null;
  let fangEditId = null;
  let koederEditId = null;
  let tripEditId = null;
  let koederExpandedId = null;
  let wetterPreselectId = null;
  let wetterForecastOpen = false;
  let mapExpanded = false;
  let leafletMap = null;
  let leafletMarker = null;
  let gruppenDetailId = null;
  let gruppenPrefillCode = null;
  let gruppenCache = [];

  function navigate(name) {
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    location.hash = name;
    gewaesserEditId = null;
    fangEditId = null;
    koederEditId = null;
    tripEditId = null;
    mapExpanded = false;
    gruppenDetailId = null;
    VIEWS[name]();
  }

  navButtons.forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  document.getElementById('settings-btn').addEventListener('click', () => navigate('einstellungen'));

  function fmtDate(iso) {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function fmtToday() {
    return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function toDatetimeLocalValue(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function confirmDelete(label) {
    return confirm(`„${label}" wirklich löschen?`);
  }

  // Pro-Konto-Präferenzen (zuletzt genutztes Gewässer/Köder etc.), getrennt
  // vom Storage-CRUD, daher eigene, mit dem Konto-Namen versehene Keys.
  function prefGet(key) {
    return localStorage.getItem(`fg_pref_${Auth.currentUsername()}_${key}`);
  }

  function prefSet(key, value) {
    localStorage.setItem(`fg_pref_${Auth.currentUsername()}_${key}`, value);
  }

  function weatherIconFor(code) {
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
    if ([2, 3, 45, 48].includes(code)) return 'cloud';
    return 'weather';
  }

  function fmtShortDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  function fmtDayMonth(dateStr) {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  function fmtStopRange(von, bis) {
    return von === bis ? fmtDayMonth(von) : `${fmtDayMonth(von)}–${fmtDayMonth(bis)}`;
  }

  // ---------- Trips: Datenmodell-Helfer (Multi-Stop) ----------
  function normalizeTrip(t) {
    if (Array.isArray(t.stops)) return t;
    return { ...t, stops: [{ gewaesserId: t.gewaesserId, von: t.datum, bis: t.datum }] };
  }

  function tripsNormalized() {
    return Storage.trips.list().map(normalizeTrip);
  }

  function tripStartDate(trip) {
    return trip.stops.reduce((min, s) => (s.von < min ? s.von : min), trip.stops[0].von);
  }

  function tripEndDate(trip) {
    return trip.stops.reduce((max, s) => (s.bis > max ? s.bis : max), trip.stops[0].bis);
  }

  function flattenUpcomingStops(heute) {
    const out = [];
    tripsNormalized().forEach(t => {
      t.stops.forEach(s => {
        if (s.bis >= heute) out.push({ tripId: t.id, tripName: t.name, gewaesserId: s.gewaesserId, von: s.von, bis: s.bis });
      });
    });
    return out.sort((a, b) => a.von.localeCompare(b.von));
  }

  function pseudoWeatherFromForecastDay(day) {
    return {
      temperature: (day.tempMax + day.tempMin) / 2,
      pressure: null,
      pressureTrend: { diff: 0, direction: 'stabil' },
      windSpeed: day.windSpeedMax ?? 0,
      cloudCover: null,
      weatherCode: day.weatherCode,
      weatherLabel: day.weatherLabel,
    };
  }

  // ---------- Login-Gate (eigenes Konto pro Nutzer) ----------
  function renderLogin() {
    let mode = 'login'; // 'login' | 'register'

    viewEl.innerHTML = `
      <section class="login-screen">
        <div class="login-icon">${Icons.svg('lock', { size: 30 })}</div>
        <h2>FishingGuide</h2>
        <p class="muted" id="login-subtitle">Melde dich mit deinem Namen und Passwort an.</p>
        <form id="login-form" class="card-form">
          <input type="text" name="username" placeholder="Name" required autocomplete="username">
          <input type="password" name="password" placeholder="Passwort" required autocomplete="current-password">
          <input type="password" name="password2" placeholder="Passwort wiederholen" autocomplete="new-password" hidden>
          <input type="text" name="invite" placeholder="Einladungscode" autocomplete="off" hidden>
          <button type="submit" id="login-submit-btn">Anmelden</button>
          <p id="login-error" class="login-error" hidden></p>
        </form>
        <button type="button" id="toggle-mode-btn" class="link-btn">Noch kein Konto? Registrieren</button>
        <button type="button" id="login-impressum-link" class="link-btn">Impressum &amp; Datenschutz</button>
      </section>
    `;

    const form = document.getElementById('login-form');
    const password2Input = form.querySelector('[name="password2"]');
    const inviteInput = form.querySelector('[name="invite"]');
    const submitBtn = document.getElementById('login-submit-btn');
    const subtitleEl = document.getElementById('login-subtitle');
    const toggleBtn = document.getElementById('toggle-mode-btn');
    const errorEl = document.getElementById('login-error');

    function applyMode() {
      const isRegister = mode === 'register';
      password2Input.hidden = !isRegister;
      password2Input.required = isRegister;
      inviteInput.hidden = !isRegister;
      inviteInput.required = isRegister;
      submitBtn.textContent = isRegister ? 'Konto erstellen' : 'Anmelden';
      subtitleEl.textContent = isRegister
        ? 'Neues Konto anlegen: Name, eigenes Passwort und Einladungscode.'
        : 'Melde dich mit deinem Namen und Passwort an.';
      toggleBtn.textContent = isRegister ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Registrieren';
      errorEl.hidden = true;
    }

    toggleBtn.addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      applyMode();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const username = fd.get('username').trim();
      const password = fd.get('password');
      errorEl.hidden = true;

      try {
        if (mode === 'register') {
          if (password !== fd.get('password2')) throw new Error('Passwörter stimmen nicht überein.');
          if (!(await Auth.checkInviteCode(fd.get('invite').trim()))) throw new Error('Falscher Einladungscode.');
          await Auth.register(username, password);
        } else {
          await Auth.login(username, password);
        }
        Storage.setNamespace(Auth.currentUsername());
        boot();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });

    document.getElementById('login-impressum-link').addEventListener('click', () => renderImpressum(true));
  }

  // ---------- Impressum ----------
  function renderImpressum(fromLogin) {
    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Impressum &amp; Datenschutz</h2>
        <div class="card-form impressum">
          <h3>Angaben gemäß § 5 DDG</h3>
          <p>[DEIN NAME]<br>[DEINE STRASSE UND HAUSNUMMER]<br>[PLZ UND ORT]</p>
          <p>Kontakt: [DEINE E-MAIL-ADRESSE]</p>
          <p class="muted">Diese App wird privat und nicht-kommerziell betrieben und ist nur für einen begrenzten,
            ausgewählten Personenkreis über einen Zugangscode erreichbar.</p>

          <h3>Datenschutz</h3>
          <p>Alle eingegebenen Daten (Gewässer, Fänge, Köder) werden ausschließlich lokal auf deinem Gerät
            (<code>localStorage</code> deines Browsers) gespeichert. Es gibt keinen Server, der diese Daten
            empfängt oder speichert.</p>
          <p>Für Wetterdaten wird die Koordinate des gewählten Gewässers an
            <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> übertragen, für die
            Kartenanzeige/-auswahl an <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">OpenStreetMap</a>.
            Beide erhalten dabei nur Koordinaten, keine Namen oder Kontaktdaten.</p>
          <p>Der Anzeigename beim Login wird ebenfalls nur lokal auf deinem Gerät gespeichert.</p>
          <p>Falls du der <strong>Gruppen-Funktion</strong> beitrittst: Dafür wird dein Anzeigename sowie eine
            zufällige, anonyme technische Kennung an <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a>
            (Auftragsverarbeiter, Serverstandort EU/Frankfurt) übertragen und dort gespeichert, solange du Mitglied
            einer Gruppe bist. Mit den anderen Mitgliedern deiner Gruppe(n) geteilt werden: dein Anzeigename, die
            Anzahl deiner erfassten Fänge und dein größter gefangener Fisch (Art + Länge) fürs Leaderboard.
            Einzelne Fangdatensätze, Gewässer-Standorte und Notizen werden <strong>nicht</strong> übertragen und
            bleiben ausschließlich lokal. Ohne Gruppen-Beitritt findet keine Übertragung an Supabase statt.</p>

          <button type="button" id="impressum-back">${fromLogin ? 'Zurück zum Login' : 'Zurück'}</button>
        </div>
      </section>
    `;

    document.getElementById('impressum-back').addEventListener('click', () => {
      if (fromLogin) renderLogin();
      else navigate('einstellungen');
    });
  }

  // ---------- Start / Übersicht ----------
  function renderStart() {
    const faenge = Storage.faenge.list();
    const gewaesser = Storage.gewaesser.list();
    const koeder = Storage.koeder.list();
    const letzterFang = [...faenge].sort((a, b) => new Date(b.datum) - new Date(a.datum))[0];
    const letzterKoeder = koeder[koeder.length - 1];
    const heute = new Date().toISOString().slice(0, 10);
    const naechsterStop = flattenUpcomingStops(heute)[0];

    const wetterGewaesserId = prefGet('wetter_gewaesser');
    const wetterGewaesser = gewaesser.find(g => g.id === wetterGewaesserId) || gewaesser[0];

    viewEl.innerHTML = `
      <section class="view-section">
        <div class="hero">
          <div class="hero-date">${fmtToday()}</div>
          <h2>Angemeldet als ${escapeHtml(Auth.currentDisplayName())}</h2>
        </div>

        <div id="dash-weather" class="dash-weather-card">
          ${wetterGewaesser
            ? '<p class="muted">Lade Wetterdaten…</p>'
            : `<div class="dash-weather-empty"><div>${Icons.svg('weather', { size: 26 })}</div>
               <p>Noch kein Gewässer angelegt – lege eins an, um Live-Wetter-Tipps zu sehen.</p></div>`}
        </div>

        <div class="dashboard-grid">
          <button class="dashboard-card" data-view="fanglog">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('fish')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Fanglog</span>
            <span class="dashboard-subtitle">${letzterFang
              ? `Zuletzt: ${escapeHtml(letzterFang.art)} · ${fmtDate(letzterFang.datum)}`
              : `${faenge.length} Fänge erfasst`}</span>
          </button>
          <button class="dashboard-card" data-view="koeder">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('bait')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Köder</span>
            <span class="dashboard-subtitle">${letzterKoeder
              ? `${koeder.length} im Bestand · zuletzt ${escapeHtml(letzterKoeder.name)}`
              : 'Noch keine Köder angelegt'}</span>
          </button>
          <button class="dashboard-card" data-view="trips">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('calendar')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Trips</span>
            <span class="dashboard-subtitle">${naechsterStop
              ? `Nächster: ${fmtStopRange(naechsterStop.von, naechsterStop.bis)} · ${escapeHtml(gewaesser.find(g => g.id === naechsterStop.gewaesserId)?.name || '–')}`
              : 'Noch kein Trip geplant'}</span>
          </button>
          <button class="dashboard-card" data-view="gewaesser">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('pin')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Gewässer</span>
            <span class="dashboard-subtitle">${gewaesser.length
              ? `${gewaesser.length} angelegt · Hauptgewässer: ${escapeHtml(gewaesser[0].name)}`
              : 'Noch keine Gewässer angelegt'}</span>
          </button>
          <button class="dashboard-card dashboard-card-wide" data-view="gruppen">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('users')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Gruppen</span>
            <span class="dashboard-subtitle">Mit Freunden verknüpfen, gemeinsames Leaderboard</span>
          </button>
        </div>
      </section>
    `;

    viewEl.querySelectorAll('.dashboard-card').forEach(btn =>
      btn.addEventListener('click', () => navigate(btn.dataset.view))
    );

    if (wetterGewaesser) {
      Weather.fetchCurrent(wetterGewaesser.lat, wetterGewaesser.lon).then(w => {
        const el = document.getElementById('dash-weather');
        if (!el) return;
        el.innerHTML = `
          <button type="button" class="dash-weather-inner" id="dash-weather-btn">
            <span class="dash-weather-icon">${Icons.svg(weatherIconFor(w.weatherCode), { size: 30 })}</span>
            <span class="dash-weather-main">
              <span class="dash-weather-temp">${Math.round(w.temperature)}°C</span>
              <span class="dash-weather-label">${w.weatherLabel} · ${escapeHtml(wetterGewaesser.name)}</span>
              <span class="dash-weather-sub">Luftdruck ${w.pressureTrend.direction} · Wind ${Math.round(w.windSpeed)} km/h</span>
            </span>
            <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
          </button>
        `;
        document.getElementById('dash-weather-btn').addEventListener('click', () => {
          wetterPreselectId = wetterGewaesser.id;
          navigate('wetter');
        });
      }).catch(() => {
        const el = document.getElementById('dash-weather');
        if (el) el.innerHTML = '<p class="muted">Wetterdaten aktuell nicht verfügbar.</p>';
      });
    }
  }

  // ---------- Gewässer (mit interaktiver Leaflet-Karte) ----------
  function initMap(container, latInput, lonInput, editing) {
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      leafletMarker = null;
    }

    const startLat = editing ? editing.lat : 51.1657;
    const startLon = editing ? editing.lon : 10.4515;

    leafletMap = L.map(container, { scrollWheelZoom: false }).setView([startLat, startLon], editing ? 12 : 5.5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap Mitwirkende',
    }).addTo(leafletMap);

    setTimeout(() => leafletMap && leafletMap.invalidateSize(), 0);

    // Mausrad-Zoom erst nach Klick in die Karte aktivieren, sonst hijackt die
    // Karte beim Seiten-Scrollen versehentlich das Mausrad.
    leafletMap.on('click', () => leafletMap.scrollWheelZoom.enable());
    leafletMap.on('mouseout', () => leafletMap.scrollWheelZoom.disable());

    if (editing) placeMarker(editing.lat, editing.lon, latInput, lonInput, { suggestName: false });

    leafletMap.on('click', e => {
      latInput.value = e.latlng.lat.toFixed(5);
      lonInput.value = e.latlng.lng.toFixed(5);
      placeMarker(e.latlng.lat, e.latlng.lng, latInput, lonInput);
    });
  }

  function placeMarker(lat, lon, latInput, lonInput, opts = {}) {
    if (leafletMarker) {
      leafletMarker.setLatLng([lat, lon]);
    } else {
      leafletMarker = L.marker([lat, lon], { draggable: true }).addTo(leafletMap);
      leafletMarker.on('dragend', () => {
        const pos = leafletMarker.getLatLng();
        latInput.value = pos.lat.toFixed(5);
        lonInput.value = pos.lng.toFixed(5);
        scheduleNameSuggestion(pos.lat, pos.lng);
      });
    }
    if (opts.suggestName !== false) scheduleNameSuggestion(lat, lon);
  }

  // ---------- Namensvorschlag per Reverse-Geocoding (Nominatim/OSM) ----------
  let geocodeTimer = null;

  function scheduleNameSuggestion(lat, lon) {
    const hintEl = document.getElementById('name-suggestion');
    if (hintEl) hintEl.hidden = true;
    clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => fetchNameSuggestion(lat, lon), 600);
  }

  function buildNameSuggestion(data) {
    const addr = data.address || {};
    const water = (data.namedetails && data.namedetails.name) || addr.water || addr.natural || null;
    const ort = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet || null;
    if (water && ort) return `${water} · ${ort}`;
    if (water) return water;
    if (ort) return ort;
    if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',').trim();
    return null;
  }

  async function fetchNameSuggestion(lat, lon) {
    const nameInput = document.querySelector('#gewaesser-form [name="name"]');
    const hintEl = document.getElementById('name-suggestion');
    if (!nameInput) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
      if (!res.ok) return;
      const data = await res.json();
      const suggestion = buildNameSuggestion(data);
      if (!suggestion) return;
      if (!nameInput.value.trim()) {
        nameInput.value = suggestion;
      } else if (hintEl) {
        hintEl.dataset.value = suggestion;
        hintEl.querySelector('.suggestion-text').textContent = suggestion;
        hintEl.hidden = false;
      }
    } catch {
      // Kein Netz/Nominatim nicht erreichbar - Namensvorschlag einfach auslassen.
    }
  }

  function renderGewaesser() {
    const items = Storage.gewaesser.list();
    const editing = gewaesserEditId ? items.find(g => g.id === gewaesserEditId) : null;

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Gewässer</h2>
        <form id="gewaesser-form" class="card-form">
          <input type="text" name="name" placeholder="Name (z.B. Vereinsteich Nord)" value="${editing ? escapeHtml(editing.name) : ''}" required>
          <p id="name-suggestion" class="muted name-suggestion" hidden>
            Vorschlag: <span class="suggestion-text"></span>
            <button type="button" id="use-suggestion" class="link-btn">übernehmen</button>
          </p>
          <div class="row">
            <input type="number" step="any" name="lat" placeholder="Breitengrad (lat)" value="${editing ? editing.lat : ''}" required>
            <input type="number" step="any" name="lon" placeholder="Längengrad (lon)" value="${editing ? editing.lon : ''}" required>
          </div>
          <button type="button" id="use-location">${Icons.svg('pin', { size: 18 })} Aktuellen Standort verwenden</button>
          <button type="button" id="map-toggle" class="link-btn">
            <span id="map-toggle-icon">${Icons.svg('chevron', { size: 14, class: mapExpanded ? 'chevron-open' : '' })}</span>
            <span id="map-toggle-label">${mapExpanded ? 'Karte ausblenden' : 'Karte anzeigen (Punkt per Klick setzen)'}</span>
          </button>
          <div id="map-collapse" ${mapExpanded ? '' : 'hidden'}>
            <p class="muted map-hint">Direkt auf die Karte klicken, um den Punkt zu setzen.</p>
            <div id="map-live" class="map-live"></div>
          </div>
          <textarea name="notiz" placeholder="Notiz (optional)">${editing ? escapeHtml(editing.notiz || '') : ''}</textarea>
          <div class="row">
            <button type="submit">${editing ? 'Speichern' : 'Gewässer hinzufügen'}</button>
            ${editing ? '<button type="button" id="cancel-edit" class="secondary-btn">Abbrechen</button>' : ''}
          </div>
        </form>
        <ul class="list">
          ${items.map(g => `
            <li class="list-item">
              <div class="list-item-summary" data-id="${g.id}">
                <strong>${escapeHtml(g.name)}</strong>
                <div class="muted">${g.lat}, ${g.lon}</div>
                ${g.notiz ? `<div class="muted">${escapeHtml(g.notiz)}</div>` : ''}
              </div>
              <button class="delete-btn" data-id="${g.id}" data-label="${escapeHtml(g.name)}">${Icons.svg('trash', { size: 18 })}</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Gewässer angelegt.</li>'}
        </ul>
      </section>
    `;

    const latInput = document.querySelector('[name="lat"]');
    const lonInput = document.querySelector('[name="lon"]');
    const mapContainer = document.getElementById('map-live');
    const mapCollapse = document.getElementById('map-collapse');
    const mapToggle = document.getElementById('map-toggle');
    let mapInitialized = false;

    function ensureMapInit() {
      if (!mapInitialized) {
        initMap(mapContainer, latInput, lonInput, editing);
        mapInitialized = true;
      } else if (leafletMap) {
        leafletMap.invalidateSize();
      }
    }

    if (mapExpanded) ensureMapInit();

    mapToggle.addEventListener('click', () => {
      mapExpanded = !mapExpanded;
      mapCollapse.hidden = !mapExpanded;
      document.getElementById('map-toggle-label').textContent = mapExpanded ? 'Karte ausblenden' : 'Karte anzeigen (Punkt per Klick setzen)';
      document.getElementById('map-toggle-icon').innerHTML = Icons.svg('chevron', { size: 14, class: mapExpanded ? 'chevron-open' : '' });
      if (mapExpanded) ensureMapInit();
    });

    document.getElementById('use-suggestion').addEventListener('click', () => {
      const hintEl = document.getElementById('name-suggestion');
      document.querySelector('[name="name"]').value = hintEl.dataset.value || '';
      hintEl.hidden = true;
    });

    [latInput, lonInput].forEach(input =>
      input.addEventListener('change', () => {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          if (!mapExpanded) { mapExpanded = true; mapCollapse.hidden = false; }
          ensureMapInit();
          placeMarker(lat, lon, latInput, lonInput);
          leafletMap.setView([lat, lon], Math.max(leafletMap.getZoom(), 12));
        }
      })
    );

    document.getElementById('use-location').addEventListener('click', () => {
      if (!window.isSecureContext) {
        alert('Standortzugriff erfordert eine sichere Verbindung (HTTPS) oder localhost. Bitte Koordinaten manuell eingeben oder auf der Karte klicken.');
        return;
      }
      if (!navigator.geolocation) {
        alert('Standortzugriff wird von diesem Browser nicht unterstützt.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          latInput.value = pos.coords.latitude.toFixed(5);
          lonInput.value = pos.coords.longitude.toFixed(5);
          if (!mapExpanded) { mapExpanded = true; mapCollapse.hidden = false; }
          ensureMapInit();
          placeMarker(pos.coords.latitude, pos.coords.longitude, latInput, lonInput);
          leafletMap.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        err => {
          const messages = {
            1: 'Standortzugriff wurde verweigert. Bitte in den Browser-/Systemeinstellungen erlauben, Koordinaten manuell eingeben oder auf der Karte klicken.',
            2: 'Standort konnte nicht ermittelt werden (kein Signal?). Bitte manuell eingeben oder auf der Karte klicken.',
            3: 'Zeitüberschreitung bei der Standortermittlung. Bitte erneut versuchen.',
          };
          alert(messages[err.code] || 'Unbekannter Fehler bei der Standortermittlung.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    document.getElementById('gewaesser-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get('name').trim(),
        lat: parseFloat(fd.get('lat')),
        lon: parseFloat(fd.get('lon')),
        notiz: fd.get('notiz').trim(),
      };
      if (gewaesserEditId) {
        Storage.gewaesser.update(gewaesserEditId, data);
      } else {
        Storage.gewaesser.add(data);
      }
      gewaesserEditId = null;
      mapExpanded = false;
      renderGewaesser();
    });

    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { gewaesserEditId = null; mapExpanded = false; renderGewaesser(); });

    viewEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { gewaesserEditId = el.dataset.id; mapExpanded = true; renderGewaesser(); })
    );

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmDelete(btn.dataset.label)) return;
        Storage.gewaesser.remove(btn.dataset.id);
        if (gewaesserEditId === btn.dataset.id) gewaesserEditId = null;
        renderGewaesser();
      })
    );
  }

  // ---------- Fanglog ----------
  function renderFanglog() {
    const items = Storage.faenge.list().sort((a, b) => new Date(b.datum) - new Date(a.datum));
    const gewaesser = Storage.gewaesser.list();
    const koeder = Storage.koeder.list();
    const gName = id => gewaesser.find(g => g.id === id)?.name || '–';
    const kName = id => koeder.find(k => k.id === id)?.name || '–';
    const editing = fangEditId ? items.find(f => f.id === fangEditId) : null;

    const lastGewaesserId = !editing && prefGet('last_gewaesser');
    const lastKoederId = !editing && prefGet('last_koeder');
    const defaultGewaesserId = editing?.gewaesserId ?? (gewaesser.some(g => g.id === lastGewaesserId) ? lastGewaesserId : '');
    const defaultKoederId = editing?.koederId ?? (koeder.some(k => k.id === lastKoederId) ? lastKoederId : '');

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Fanglog</h2>
        ${gewaesser.length === 0 ? '<p class="muted">Erst unter „Gewässer" ein Gewässer anlegen, um Fänge zu erfassen.</p>' : `
        <form id="fang-form" class="card-form">
          <input type="text" name="art" list="fischarten-liste" placeholder="Fischart" value="${editing ? escapeHtml(editing.art) : ''}" required>
          <datalist id="fischarten-liste">
            ${FISCH_ARTEN.map(a => `<option value="${a}">`).join('')}
          </datalist>
          <div class="row">
            <input type="number" step="any" min="0" name="laenge" placeholder="Länge (cm)" value="${editing?.laenge ?? ''}">
            <input type="number" step="any" min="0" name="gewicht" placeholder="Gewicht (g)" value="${editing?.gewicht ?? ''}">
          </div>
          <select name="gewaesserId" required>
            <option value="" disabled ${defaultGewaesserId ? '' : 'selected'}>Gewässer wählen</option>
            ${gewaesser.map(g => `<option value="${g.id}" ${defaultGewaesserId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
          <select name="koederId">
            <option value="">Köder (optional)</option>
            ${koeder.map(k => `<option value="${k.id}" ${defaultKoederId === k.id ? 'selected' : ''}>${escapeHtml(k.name)}</option>`).join('')}
          </select>
          <input type="datetime-local" name="datum" required>
          <textarea name="notiz" placeholder="Notiz (optional)">${editing ? escapeHtml(editing.notiz || '') : ''}</textarea>
          <div class="row">
            <button type="submit">${editing ? 'Speichern' : 'Fang eintragen'}</button>
            ${editing ? '<button type="button" id="cancel-edit" class="secondary-btn">Abbrechen</button>' : ''}
          </div>
        </form>
        `}
        <ul class="list">
          ${items.map(f => `
            <li class="list-item">
              <div class="list-item-summary" data-id="${f.id}">
                <strong>${escapeHtml(f.art)}</strong>
                ${f.laenge ? ` · ${f.laenge} cm` : ''}${f.gewicht ? ` · ${f.gewicht} g` : ''}
                <div class="muted">${fmtDate(f.datum)} · ${escapeHtml(gName(f.gewaesserId))}${f.koederId ? ' · ' + escapeHtml(kName(f.koederId)) : ''}</div>
                ${f.notiz ? `<div class="muted">${escapeHtml(f.notiz)}</div>` : ''}
              </div>
              <button class="delete-btn" data-id="${f.id}" data-label="${escapeHtml(f.art)}">${Icons.svg('trash', { size: 18 })}</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Fänge erfasst.</li>'}
        </ul>
      </section>
    `;

    const form = document.getElementById('fang-form');
    if (form) {
      form.querySelector('[name="datum"]').value = toDatetimeLocalValue(editing ? new Date(editing.datum) : new Date());

      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
          art: fd.get('art').trim(),
          laenge: fd.get('laenge') ? parseFloat(fd.get('laenge')) : null,
          gewicht: fd.get('gewicht') ? parseFloat(fd.get('gewicht')) : null,
          gewaesserId: fd.get('gewaesserId'),
          koederId: fd.get('koederId') || null,
          datum: new Date(fd.get('datum')).toISOString(),
          notiz: fd.get('notiz').trim(),
        };
        if (fangEditId) {
          Storage.faenge.update(fangEditId, data);
        } else {
          Storage.faenge.add(data);
          prefSet('last_gewaesser', data.gewaesserId);
          if (data.koederId) prefSet('last_koeder', data.koederId);
        }
        fangEditId = null;
        renderFanglog();
        syncStatsToAllGroups();
      });

      const cancelBtn = document.getElementById('cancel-edit');
      if (cancelBtn) cancelBtn.addEventListener('click', () => { fangEditId = null; renderFanglog(); });
    }

    viewEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { fangEditId = el.dataset.id; renderFanglog(); })
    );

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmDelete(btn.dataset.label)) return;
        Storage.faenge.remove(btn.dataset.id);
        if (fangEditId === btn.dataset.id) fangEditId = null;
        renderFanglog();
        syncStatsToAllGroups();
      })
    );
  }

  // ---------- Köder ----------
  function renderKoeder() {
    const items = Storage.koeder.list();
    const editing = koederEditId ? items.find(k => k.id === koederEditId) : null;
    const techniken = Fuehrung.TECHNIKEN;

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Köder-Bestand</h2>
        <form id="koeder-form" class="card-form">
          ${editing ? '' : `
          <select id="koeder-vorlage">
            <option value="">— Vorlage wählen (optional) —</option>
            ${KOEDER_PRESETS.map((p, i) => `<option value="${i}">${escapeHtml(p.name)} (${escapeHtml(p.kategorie)})</option>`).join('')}
          </select>
          `}
          <input type="text" name="name" placeholder="Name (z.B. Gummifisch Weiß 8cm)" value="${editing ? escapeHtml(editing.name) : ''}" required>
          <input type="text" name="kategorie" list="koeder-kategorien" placeholder="Kategorie (z.B. Gummiköder, Wobbler, Spinner)" value="${editing ? escapeHtml(editing.kategorie || '') : ''}">
          <datalist id="koeder-kategorien">
            ${KOEDER_KATEGORIEN.map(k => `<option value="${k}">`).join('')}
          </datalist>
          <select name="fuehrung">
            <option value="">Führungstechnik (optional)</option>
            ${Object.entries(techniken).map(([key, t]) => `<option value="${key}" ${editing?.fuehrung === key ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
          </select>
          <input type="number" name="anzahl" placeholder="Anzahl im Bestand" min="0" value="${editing?.anzahl ?? ''}">
          <textarea name="notiz" placeholder="Notiz (optional)">${editing ? escapeHtml(editing.notiz || '') : ''}</textarea>
          <div class="row">
            <button type="submit">${editing ? 'Speichern' : 'Köder hinzufügen'}</button>
            ${editing ? '<button type="button" id="cancel-edit" class="secondary-btn">Abbrechen</button>' : ''}
          </div>
        </form>
        <ul class="list">
          ${items.map(k => `
            <li class="list-item">
              <div class="list-item-body">
                <div class="list-item-summary" data-id="${k.id}">
                  <strong>${escapeHtml(k.name)}</strong>${k.kategorie ? ` · ${escapeHtml(k.kategorie)}` : ''}
                  <div class="muted">Bestand: ${k.anzahl ?? '–'}${k.fuehrung && techniken[k.fuehrung] ? ' · ' + escapeHtml(techniken[k.fuehrung].label) : ''}</div>
                  ${k.notiz ? `<div class="muted">${escapeHtml(k.notiz)}</div>` : ''}
                </div>
                ${k.fuehrung && techniken[k.fuehrung] ? `
                  <button type="button" class="link-btn toggle-fuehrung" data-id="${k.id}">
                    ${Icons.svg('chevron', { size: 14, class: koederExpandedId === k.id ? 'chevron-open' : '' })}
                    ${koederExpandedId === k.id ? 'Führung ausblenden' : 'Wie führe ich das?'}
                  </button>
                  ${koederExpandedId === k.id ? Fuehrung.renderInfo(k.fuehrung) : ''}
                ` : ''}
              </div>
              <button class="delete-btn" data-id="${k.id}" data-label="${escapeHtml(k.name)}">${Icons.svg('trash', { size: 18 })}</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Köder angelegt.</li>'}
        </ul>
      </section>
    `;

    const vorlageSelect = document.getElementById('koeder-vorlage');
    if (vorlageSelect) {
      vorlageSelect.addEventListener('change', () => {
        if (vorlageSelect.value === '') return;
        const preset = KOEDER_PRESETS[parseInt(vorlageSelect.value, 10)];
        document.querySelector('#koeder-form [name="name"]').value = preset.name;
        document.querySelector('#koeder-form [name="kategorie"]').value = preset.kategorie;
        document.querySelector('#koeder-form [name="fuehrung"]').value = preset.fuehrung;
      });
    }

    document.getElementById('koeder-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get('name').trim(),
        kategorie: fd.get('kategorie').trim(),
        fuehrung: fd.get('fuehrung') || null,
        anzahl: fd.get('anzahl') ? parseInt(fd.get('anzahl'), 10) : null,
        notiz: fd.get('notiz').trim(),
      };
      if (koederEditId) {
        Storage.koeder.update(koederEditId, data);
      } else {
        Storage.koeder.add(data);
      }
      koederEditId = null;
      renderKoeder();
    });

    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { koederEditId = null; renderKoeder(); });

    viewEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { koederEditId = el.dataset.id; renderKoeder(); })
    );

    viewEl.querySelectorAll('.toggle-fuehrung').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        koederExpandedId = koederExpandedId === btn.dataset.id ? null : btn.dataset.id;
        renderKoeder();
      })
    );

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmDelete(btn.dataset.label)) return;
        Storage.koeder.remove(btn.dataset.id);
        if (koederEditId === btn.dataset.id) koederEditId = null;
        if (koederExpandedId === btn.dataset.id) koederExpandedId = null;
        renderKoeder();
      })
    );
  }

  // ---------- Wetter-Tipps ----------
  async function loadStopPreview(stop, gewaesserList, cardSelector) {
    const card = document.querySelector(cardSelector);
    if (!card) return;
    const g = gewaesserList.find(x => x.id === stop.gewaesserId);
    if (!g) {
      card.innerHTML = '<p class="muted">Gewässer nicht gefunden.</p>';
      return;
    }
    try {
      const w = await Weather.fetchCurrent(g.lat, g.lon);
      const day = w.forecast.find(d => d.date === stop.von);
      if (!day) {
        card.innerHTML = `
          <div class="trip-mini-head"><strong>${escapeHtml(stop.tripName || g.name)}</strong><span class="muted">${fmtStopRange(stop.von, stop.bis)}</span></div>
          <p class="muted">Prognose noch nicht verfügbar (zu weit in der Zukunft).</p>
        `;
        return;
      }
      const pseudo = pseudoWeatherFromForecastDay(day);
      const tips = Tips.getTips(pseudo);
      card.innerHTML = `
        <div class="trip-mini-head">
          <strong>${escapeHtml(stop.tripName || g.name)}</strong>
          <span class="muted">${fmtStopRange(stop.von, stop.bis)} · ${escapeHtml(g.name)}</span>
        </div>
        <div class="trip-mini-weather">
          ${Icons.svg(weatherIconFor(day.weatherCode), { size: 22 })}
          <span>${Math.round(day.tempMin)}–${Math.round(day.tempMax)}°C · ${escapeHtml(day.weatherLabel)}</span>
        </div>
        ${tips[0] ? `<p class="trip-mini-tip"><span class="tip-kategorie">${escapeHtml(tips[0].kategorie)}</span> ${escapeHtml(tips[0].text)}</p>` : ''}
      `;
    } catch {
      card.innerHTML = '<p class="muted">Wetterdaten aktuell nicht verfügbar.</p>';
    }
  }

  function renderWetter() {
    const gewaesser = Storage.gewaesser.list();

    if (gewaesser.length === 0) {
      viewEl.innerHTML = `
        <section class="view-section">
          <h2>Wetter-Tipps</h2>
          <p class="muted">Erst unter „Gewässer" ein Gewässer anlegen, um Wetter-Tipps zu erhalten.</p>
        </section>
      `;
      return;
    }

    const preselect = wetterPreselectId && gewaesser.some(g => g.id === wetterPreselectId) ? wetterPreselectId : gewaesser[0].id;
    wetterPreselectId = null;

    const heute = new Date().toISOString().slice(0, 10);
    const kommendeStops = flattenUpcomingStops(heute).slice(0, 2);

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Wetter-Tipps</h2>
        <select id="wetter-gewaesser">
          ${gewaesser.map(g => `<option value="${g.id}" ${g.id === preselect ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
        <div id="wetter-result" class="wetter-result">
          <p class="muted">Lade Wetterdaten…</p>
        </div>
        ${kommendeStops.length ? `
          <h3 class="trips-widget-title">Anstehende Trips</h3>
          <div id="trips-widget" class="trips-widget">
            ${kommendeStops.map((s, i) => `<div class="trip-mini-card" data-key="w${i}"><p class="muted">Lade Prognose…</p></div>`).join('')}
          </div>
        ` : ''}
      </section>
    `;

    const tripsWidget = document.getElementById('trips-widget');
    if (tripsWidget) {
      tripsWidget.addEventListener('click', () => navigate('trips'));
      kommendeStops.forEach((s, i) => loadStopPreview(s, gewaesser, `.trip-mini-card[data-key="w${i}"]`));
    }

    const select = document.getElementById('wetter-gewaesser');
    const loadFor = async id => {
      const g = gewaesser.find(x => x.id === id);
      prefSet('wetter_gewaesser', id);
      const resultEl = document.getElementById('wetter-result');
      resultEl.innerHTML = '<p class="muted">Lade Wetterdaten…</p>';
      try {
        const w = await Weather.fetchCurrent(g.lat, g.lon);
        const tips = Tips.getTips(w);
        resultEl.innerHTML = `
          <div class="weather-card">
            <span class="weather-card-icon">${Icons.svg(weatherIconFor(w.weatherCode), { size: 32 })}</span>
            <div class="weather-main">${w.weatherLabel} · ${Math.round(w.temperature)}°C</div>
            <div class="muted">
              Luftdruck: ${w.pressure} hPa (${w.pressureTrend.direction}, ${w.pressureTrend.diff > 0 ? '+' : ''}${w.pressureTrend.diff} hPa/3h)
              · Wind: ${Math.round(w.windSpeed)} km/h · Bewölkung: ${w.cloudCover}%
            </div>
          </div>
          <h3>Tipps für „${escapeHtml(g.name)}"</h3>
          <ul class="tips-list">
            ${tips.map(t => `
              <li class="tip-item">
                <span class="tip-kategorie">${escapeHtml(t.kategorie)}</span>
                <p>${escapeHtml(t.text)}</p>
              </li>
            `).join('') || '<li class="muted">Aktuell keine besonderen Tipps.</li>'}
          </ul>
          <button type="button" id="forecast-toggle" class="link-btn">
            <span id="forecast-toggle-icon">${Icons.svg('chevron', { size: 14, class: wetterForecastOpen ? 'chevron-open' : '' })}</span>
            <span id="forecast-toggle-label">${wetterForecastOpen ? '7-Tage-Vorschau ausblenden' : '7-Tage-Vorschau anzeigen'}</span>
          </button>
          <div id="forecast-collapse" class="forecast-list" ${wetterForecastOpen ? '' : 'hidden'}>
            ${w.forecast.map(d => `
              <div class="forecast-day">
                <span class="forecast-day-label">${fmtShortDate(d.date)}</span>
                ${Icons.svg(weatherIconFor(d.weatherCode), { size: 20 })}
                <span class="forecast-day-temp">${Math.round(d.tempMin)}° / ${Math.round(d.tempMax)}°</span>
                <span class="forecast-day-precip">${d.precipProb != null ? d.precipProb + '%' : '–'}</span>
              </div>
            `).join('')}
          </div>
        `;

        document.getElementById('forecast-toggle').addEventListener('click', () => {
          wetterForecastOpen = !wetterForecastOpen;
          document.getElementById('forecast-collapse').hidden = !wetterForecastOpen;
          document.getElementById('forecast-toggle-label').textContent = wetterForecastOpen ? '7-Tage-Vorschau ausblenden' : '7-Tage-Vorschau anzeigen';
          document.getElementById('forecast-toggle-icon').innerHTML = Icons.svg('chevron', { size: 14, class: wetterForecastOpen ? 'chevron-open' : '' });
        });
      } catch (err) {
        resultEl.innerHTML = `<p class="muted">Fehler beim Laden der Wetterdaten: ${escapeHtml(err.message)}</p>`;
      }
    };

    select.addEventListener('change', () => loadFor(select.value));
    loadFor(select.value);
  }

  // ---------- Trips (Multi-Stop) ----------
  function renderTrips() {
    const gewaesser = Storage.gewaesser.list();
    const gName = id => gewaesser.find(g => g.id === id)?.name || '–';
    const items = tripsNormalized().sort((a, b) => tripStartDate(a).localeCompare(tripStartDate(b)));
    const editing = tripEditId ? items.find(t => t.id === tripEditId) : null;
    const heute = new Date().toISOString().slice(0, 10);

    // Lokaler, veränderlicher Stop-Zustand fürs Formular (nur der Stop-Container
    // wird bei Änderungen neu gerendert, damit Name/Notiz nicht verloren gehen).
    const stops = editing ? editing.stops.map(s => ({ ...s })) : [{ gewaesserId: '', von: '', bis: '' }];

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Angeltrips</h2>
        <p class="muted">Persönliche Trip-Planung mit Wetterprognose. Freunde einladen, gemeinsames Leaderboard
          und eine geteilte Spot-Karte sind als nächstes großes Vorhaben geplant (braucht ein Cloud-Backend).</p>
        ${gewaesser.length === 0 ? '<p class="muted">Erst unter „Gewässer" ein Gewässer anlegen, um einen Trip zu planen.</p>' : `
        <form id="trip-form" class="card-form">
          <input type="text" name="name" placeholder="Name (optional, z.B. Herbsttour)" value="${editing ? escapeHtml(editing.name || '') : ''}">
          <div id="stops-container" class="stops-container"></div>
          <button type="button" id="add-stop" class="secondary-btn">+ Ort hinzufügen</button>
          <textarea name="notiz" placeholder="Notiz (optional)">${editing ? escapeHtml(editing.notiz || '') : ''}</textarea>
          <div class="row">
            <button type="submit">${editing ? 'Speichern' : 'Trip anlegen'}</button>
            ${editing ? '<button type="button" id="cancel-edit" class="secondary-btn">Abbrechen</button>' : ''}
          </div>
        </form>
        `}
        <ul class="list">
          ${items.map(t => `
            <li class="list-item">
              <div class="list-item-body">
                <div class="list-item-summary" data-id="${t.id}">
                  <strong>${escapeHtml(t.name || `Trip ${fmtStopRange(tripStartDate(t), tripEndDate(t))}`)}</strong>
                  <div class="muted">${fmtStopRange(tripStartDate(t), tripEndDate(t))}</div>
                  ${t.notiz ? `<div class="muted">${escapeHtml(t.notiz)}</div>` : ''}
                </div>
                <div class="trip-stops-list">
                  ${t.stops.map((s, i) => `
                    <div class="trip-stop-row">
                      <span>${escapeHtml(gName(s.gewaesserId))}</span>
                      <span class="muted">${fmtStopRange(s.von, s.bis)}</span>
                    </div>
                    ${s.bis >= heute ? `<div class="trip-mini-card" data-key="${t.id}-${i}"><p class="muted">Lade Prognose…</p></div>` : ''}
                  `).join('')}
                </div>
              </div>
              <button class="delete-btn" data-id="${t.id}" data-label="${escapeHtml(t.name || gName(t.stops[0].gewaesserId))}">${Icons.svg('trash', { size: 18 })}</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Trips geplant.</li>'}
        </ul>
      </section>
    `;

    items.forEach(t => t.stops.forEach((s, i) => {
      if (s.bis >= heute) {
        loadStopPreview(
          { tripId: t.id, tripName: t.name, gewaesserId: s.gewaesserId, von: s.von, bis: s.bis },
          gewaesser,
          `.trip-mini-card[data-key="${t.id}-${i}"]`
        );
      }
    }));

    const stopsContainer = document.getElementById('stops-container');

    function renderStopsRows() {
      if (!stopsContainer) return;
      stopsContainer.innerHTML = stops.map((s, i) => `
        <div class="stop-row" data-idx="${i}">
          <select data-field="gewaesserId">
            <option value="" disabled ${s.gewaesserId ? '' : 'selected'}>Gewässer</option>
            ${gewaesser.map(g => `<option value="${g.id}" ${s.gewaesserId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
          <div class="stop-row-dates">
            <input type="date" data-field="von" value="${s.von}" placeholder="Von">
            <input type="date" data-field="bis" value="${s.bis}" placeholder="Bis">
            ${stops.length > 1 ? `<button type="button" class="remove-stop-btn" data-idx="${i}" aria-label="Ort entfernen">${Icons.svg('close', { size: 16 })}</button>` : ''}
          </div>
        </div>
      `).join('');

      stopsContainer.querySelectorAll('.stop-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        row.querySelectorAll('[data-field]').forEach(field => {
          field.addEventListener('change', () => {
            stops[idx][field.dataset.field] = field.value;
            if (field.dataset.field === 'von' && !stops[idx].bis) stops[idx].bis = field.value;
          });
        });
      });
      stopsContainer.querySelectorAll('.remove-stop-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          stops.splice(parseInt(btn.dataset.idx, 10), 1);
          renderStopsRows();
        })
      );
    }
    renderStopsRows();

    const addStopBtn = document.getElementById('add-stop');
    if (addStopBtn) addStopBtn.addEventListener('click', () => {
      stops.push({ gewaesserId: '', von: '', bis: '' });
      renderStopsRows();
    });

    const form = document.getElementById('trip-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const validStops = stops
          .filter(s => s.gewaesserId && s.von)
          .map(s => ({ gewaesserId: s.gewaesserId, von: s.von, bis: s.bis && s.bis >= s.von ? s.bis : s.von }));
        if (validStops.length === 0) {
          alert('Bitte mindestens einen Ort mit Gewässer und Datum angeben.');
          return;
        }
        const data = {
          name: fd.get('name').trim(),
          notiz: fd.get('notiz').trim(),
          stops: validStops,
        };
        if (tripEditId) {
          Storage.trips.update(tripEditId, data);
        } else {
          Storage.trips.add(data);
        }
        tripEditId = null;
        renderTrips();
      });

      const cancelBtn = document.getElementById('cancel-edit');
      if (cancelBtn) cancelBtn.addEventListener('click', () => { tripEditId = null; renderTrips(); });
    }

    viewEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { tripEditId = el.dataset.id; renderTrips(); })
    );

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmDelete(btn.dataset.label)) return;
        Storage.trips.remove(btn.dataset.id);
        if (tripEditId === btn.dataset.id) tripEditId = null;
        renderTrips();
      })
    );
  }

  // ---------- Gruppen (Supabase: Gruppen, Mitglieder, Leaderboard) ----------
  function extractInviteCode(raw) {
    const match = raw.match(/[?&]join=([^&\s]+)/);
    return (match ? decodeURIComponent(match[1]) : raw).trim();
  }

  function computeMyStats() {
    const faenge = Storage.faenge.list();
    let biggestArt = null;
    let biggestLaenge = null;
    faenge.forEach(f => {
      if (f.laenge != null && (biggestLaenge === null || f.laenge > biggestLaenge)) {
        biggestLaenge = f.laenge;
        biggestArt = f.art;
      }
    });
    return { total: faenge.length, biggestArt, biggestLaenge };
  }

  async function syncStatsToAllGroups() {
    if (localStorage.getItem('fg_gruppen_used') !== '1') return;
    try {
      const { total, biggestArt, biggestLaenge } = computeMyStats();
      const groups = await SB.listMyGroups();
      await Promise.all(groups.map(g => SB.syncStats(g.id, total, biggestArt, biggestLaenge).catch(() => {})));
    } catch {
      // Supabase gerade nicht erreichbar (z.B. offline) - stiller Fehlschlag, blockiert die App nicht.
    }
  }

  async function renderGruppen() {
    localStorage.setItem('fg_gruppen_used', '1');
    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Gruppen</h2>
        <p class="muted">Mit Freunden verknüpft: gemeinsames Leaderboard (Anzahl Fänge, größter Fisch). Einzelne
          Fangdatensätze und Gewässer-Standorte bleiben privat, nur diese aggregierten Werte werden geteilt.</p>
        <div id="gruppen-content"><p class="muted">Lade Gruppen…</p></div>
      </section>
    `;
    const contentEl = document.getElementById('gruppen-content');
    try {
      await SB.ensureSession();
      if (gruppenDetailId) {
        await renderGruppenDetail(contentEl, gruppenDetailId);
      } else {
        await renderGruppenList(contentEl);
      }
    } catch (err) {
      contentEl.innerHTML = `<p class="muted">Gruppen aktuell nicht erreichbar (${escapeHtml(err.message)}). Bitte später erneut versuchen.</p>`;
    }
  }

  async function renderGruppenList(contentEl) {
    const groups = await SB.listMyGroups();
    gruppenCache = groups;

    contentEl.innerHTML = `
      <form id="create-group-form" class="card-form">
        <input type="text" name="name" placeholder="Neue Gruppe (Name)" required>
        <button type="submit">Gruppe erstellen</button>
      </form>
      <form id="join-group-form" class="card-form">
        <input type="text" name="code" placeholder="Einladungscode oder -link" value="${gruppenPrefillCode ? escapeHtml(gruppenPrefillCode) : ''}" required>
        <button type="submit">Gruppe beitreten</button>
        <p id="join-error" class="login-error" hidden></p>
      </form>
      <ul class="list">
        ${groups.map(g => `
          <li class="list-item">
            <div class="list-item-summary" data-id="${g.id}" style="width:100%">
              <strong>${escapeHtml(g.name)}</strong>
            </div>
          </li>
        `).join('') || '<li class="muted">Noch in keiner Gruppe.</li>'}
      </ul>
    `;
    gruppenPrefillCode = null;

    document.getElementById('create-group-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const group = await SB.createGroup(fd.get('name').trim(), Auth.currentDisplayName());
        gruppenCache = [group, ...gruppenCache.filter(g => g.id !== group.id)];
        gruppenDetailId = group.id;
        renderGruppen();
      } catch (err) {
        alert('Gruppe konnte nicht erstellt werden: ' + err.message);
      }
    });

    document.getElementById('join-group-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const code = extractInviteCode(fd.get('code'));
      const errorEl = document.getElementById('join-error');
      errorEl.hidden = true;
      try {
        const group = await SB.joinGroup(code, Auth.currentDisplayName());
        gruppenCache = [group, ...gruppenCache.filter(g => g.id !== group.id)];
        gruppenDetailId = group.id;
        renderGruppen();
        syncStatsToAllGroups();
      } catch (err) {
        errorEl.textContent = err.message === 'invalid_code' ? 'Ungültiger Einladungscode.' : 'Beitreten fehlgeschlagen.';
        errorEl.hidden = false;
      }
    });

    contentEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { gruppenDetailId = el.dataset.id; renderGruppen(); })
    );
  }

  async function renderGruppenDetail(contentEl, groupId) {
    let group = gruppenCache.find(g => g.id === groupId);
    if (!group) {
      gruppenCache = await SB.listMyGroups();
      group = gruppenCache.find(g => g.id === groupId);
    }
    if (!group) {
      contentEl.innerHTML = '<p class="muted">Gruppe nicht gefunden.</p>';
      return;
    }

    contentEl.innerHTML = '<p class="muted">Lade Mitglieder & Leaderboard…</p>';
    const [members, leaderboard] = await Promise.all([SB.listMembers(groupId), SB.listLeaderboard(groupId)]);
    const inviteLink = `${location.origin}${location.pathname}?join=${group.invite_code}`;

    contentEl.innerHTML = `
      <button type="button" id="back-to-groups" class="link-btn">
        ${Icons.svg('chevron', { size: 14, class: 'chevron-back' })} Alle Gruppen
      </button>
      <h3>${escapeHtml(group.name)}</h3>
      <div class="card-form">
        <p class="muted">Einladungslink zum Teilen:</p>
        <div class="invite-link-row">
          <input type="text" readonly value="${escapeHtml(inviteLink)}" id="invite-link-input">
          <button type="button" id="copy-invite-btn" class="secondary-btn">Kopieren</button>
        </div>
      </div>

      <h3>Mitglieder (${members.length})</h3>
      <ul class="list">
        ${members.map(m => `<li class="list-item"><div><strong>${escapeHtml(m.displayName)}</strong></div></li>`).join('')}
      </ul>

      <h3>Leaderboard</h3>
      <ul class="list">
        ${leaderboard.map((s, i) => `
          <li class="list-item leaderboard-item">
            <span class="leaderboard-rank">${i + 1}.</span>
            <div class="list-item-body">
              <strong>${escapeHtml(s.displayName)}</strong>
              <div class="muted">${s.totalFaenge} Fänge${s.biggestFishArt ? ` · Größter: ${escapeHtml(s.biggestFishArt)} (${s.biggestFishLaenge} cm)` : ''}</div>
            </div>
          </li>
        `).join('') || '<li class="muted">Noch keine Statistik vorhanden.</li>'}
      </ul>
    `;

    document.getElementById('back-to-groups').addEventListener('click', () => { gruppenDetailId = null; renderGruppen(); });
    document.getElementById('copy-invite-btn').addEventListener('click', () => {
      const input = document.getElementById('invite-link-input');
      input.select();
      const btn = document.getElementById('copy-invite-btn');
      navigator.clipboard?.writeText(inviteLink)
        .then(() => { btn.textContent = 'Kopiert!'; setTimeout(() => { btn.textContent = 'Kopieren'; }, 1500); })
        .catch(() => {});
    });
  }

  // ---------- Einstellungen ----------
  function renderEinstellungen() {
    const gewaesser = Storage.gewaesser.list();
    const faenge = Storage.faenge.list();
    const koeder = Storage.koeder.list();

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Einstellungen</h2>
        <div class="card-form">
          <p class="muted">Angemeldet als <strong>${escapeHtml(Auth.currentDisplayName())}</strong></p>
          <p class="muted">${gewaesser.length} Gewässer · ${faenge.length} Fänge · ${koeder.length} Köder — alle Daten liegen nur lokal auf diesem Gerät.</p>
          <button type="button" id="export-btn">${Icons.svg('download', { size: 18 })} Daten exportieren (Backup)</button>
          <button type="button" id="import-btn" class="secondary-btn">${Icons.svg('upload', { size: 18 })} Daten importieren</button>
          <input type="file" id="import-file" accept="application/json" hidden>
          <button type="button" id="impressum-btn" class="secondary-btn">${Icons.svg('info', { size: 18 })} Impressum &amp; Datenschutz</button>
          <button type="button" id="logout-btn" class="secondary-btn">${Icons.svg('logout', { size: 18 })} Abmelden</button>
        </div>
      </section>
    `;

    document.getElementById('export-btn').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fishingguide-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    const importFile = document.getElementById('import-file');
    document.getElementById('import-btn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Import überschreibt alle aktuellen Daten in dieser App. Fortfahren?')) {
        e.target.value = '';
        return;
      }
      try {
        const data = JSON.parse(await file.text());
        Storage.importAll(data);
        alert('Daten erfolgreich importiert.');
        renderEinstellungen();
      } catch (err) {
        alert('Import fehlgeschlagen: ' + err.message);
      }
      e.target.value = '';
    });

    document.getElementById('impressum-btn').addEventListener('click', () => navigate('impressum'));

    document.getElementById('logout-btn').addEventListener('click', () => {
      if (!confirm('Wirklich abmelden?')) return;
      Auth.logout();
      location.reload();
    });
  }

  // ---------- Boot ----------
  function boot() {
    headerEl.hidden = false;
    navEl.hidden = false;

    const joinCode = new URLSearchParams(location.search).get('join');
    if (joinCode) {
      gruppenPrefillCode = joinCode;
      history.replaceState(null, '', location.pathname + location.hash);
      navigate('gruppen');
    } else {
      const initial = location.hash.replace('#', '') || 'start';
      navigate(VIEWS[initial] ? initial : 'start');
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  function init() {
    if (Auth.isLoggedIn()) {
      Storage.setNamespace(Auth.currentUsername());
      boot();
    } else {
      headerEl.hidden = true;
      navEl.hidden = true;
      renderLogin();
    }
  }

  init();
})();
