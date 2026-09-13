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
    einstellungen: renderEinstellungen,
    impressum: () => renderImpressum(false),
  };

  // Bearbeiten-Status je View
  let gewaesserEditId = null;
  let fangEditId = null;
  let koederEditId = null;
  let koederExpandedId = null;
  let wetterPreselectId = null;
  let leafletMap = null;
  let leafletMarker = null;

  function navigate(name) {
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    location.hash = name;
    gewaesserEditId = null;
    fangEditId = null;
    koederEditId = null;
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

  function weatherIconFor(code) {
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
    if ([2, 3, 45, 48].includes(code)) return 'cloud';
    return 'weather';
  }

  // ---------- Login-Gate ----------
  function renderLogin() {
    viewEl.innerHTML = `
      <section class="login-screen">
        <div class="login-icon">${Icons.svg('lock', { size: 30 })}</div>
        <h2>FishingGuide</h2>
        <p class="muted">Diese App ist nur für einen ausgewählten Personenkreis. Bitte Zugangscode eingeben.</p>
        <form id="login-form" class="card-form">
          <input type="password" name="code" placeholder="Zugangscode" required autocomplete="off">
          <input type="text" name="name" placeholder="Dein Name" required autocomplete="off">
          <button type="submit">Anmelden</button>
          <p id="login-error" class="login-error" hidden>Falscher Zugangscode. Bitte erneut versuchen.</p>
        </form>
        <button type="button" id="login-impressum-link" class="link-btn">Impressum &amp; Datenschutz</button>
      </section>
    `;

    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ok = await Auth.checkCode(fd.get('code').trim());
      const errorEl = document.getElementById('login-error');
      if (ok) {
        Auth.login(fd.get('name').trim() || 'Angler');
        boot();
      } else {
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

    const wetterGewaesserId = localStorage.getItem('fg_last_wetter_gewaesser');
    const wetterGewaesser = gewaesser.find(g => g.id === wetterGewaesserId) || gewaesser[0];

    viewEl.innerHTML = `
      <section class="view-section">
        <div class="hero">
          <div class="hero-date">${fmtToday()}</div>
          <h2>Angemeldet als ${escapeHtml(Auth.currentUser())}</h2>
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
          <button class="dashboard-card dashboard-card-wide" data-view="gewaesser">
            <div class="dashboard-card-top">
              <span class="dashboard-icon">${Icons.svg('pin')}</span>
              <span class="dashboard-chevron">${Icons.svg('chevron', { size: 18 })}</span>
            </div>
            <span class="dashboard-title">Gewässer</span>
            <span class="dashboard-subtitle">${gewaesser.length
              ? `${gewaesser.length} angelegt · Hauptgewässer: ${escapeHtml(gewaesser[0].name)}`
              : 'Noch keine Gewässer angelegt'}</span>
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

    leafletMap = L.map(container).setView([startLat, startLon], editing ? 12 : 5.5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap Mitwirkende',
    }).addTo(leafletMap);

    setTimeout(() => leafletMap && leafletMap.invalidateSize(), 0);

    if (editing) placeMarker(editing.lat, editing.lon, latInput, lonInput);

    leafletMap.on('click', e => {
      latInput.value = e.latlng.lat.toFixed(5);
      lonInput.value = e.latlng.lng.toFixed(5);
      placeMarker(e.latlng.lat, e.latlng.lng, latInput, lonInput);
    });
  }

  function placeMarker(lat, lon, latInput, lonInput) {
    if (leafletMarker) {
      leafletMarker.setLatLng([lat, lon]);
    } else {
      leafletMarker = L.marker([lat, lon], { draggable: true }).addTo(leafletMap);
      leafletMarker.on('dragend', () => {
        const pos = leafletMarker.getLatLng();
        latInput.value = pos.lat.toFixed(5);
        lonInput.value = pos.lng.toFixed(5);
      });
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
          <div class="row">
            <input type="number" step="any" name="lat" placeholder="Breitengrad (lat)" value="${editing ? editing.lat : ''}" required>
            <input type="number" step="any" name="lon" placeholder="Längengrad (lon)" value="${editing ? editing.lon : ''}" required>
          </div>
          <button type="button" id="use-location">${Icons.svg('pin', { size: 18 })} Aktuellen Standort verwenden</button>
          <p class="muted map-hint">Oder direkt auf die Karte klicken, um den Punkt zu setzen.</p>
          <div id="map-live" class="map-live"></div>
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
    initMap(mapContainer, latInput, lonInput, editing);

    [latInput, lonInput].forEach(input =>
      input.addEventListener('change', () => {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
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
      renderGewaesser();
    });

    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { gewaesserEditId = null; renderGewaesser(); });

    viewEl.querySelectorAll('.list-item-summary').forEach(el =>
      el.addEventListener('click', () => { gewaesserEditId = el.dataset.id; renderGewaesser(); })
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

    const lastGewaesserId = !editing && localStorage.getItem('fg_last_gewaesser');
    const lastKoederId = !editing && localStorage.getItem('fg_last_koeder');
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
          localStorage.setItem('fg_last_gewaesser', data.gewaesserId);
          if (data.koederId) localStorage.setItem('fg_last_koeder', data.koederId);
        }
        fangEditId = null;
        renderFanglog();
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

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Wetter-Tipps</h2>
        <select id="wetter-gewaesser">
          ${gewaesser.map(g => `<option value="${g.id}" ${g.id === preselect ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
        <div id="wetter-result" class="wetter-result">
          <p class="muted">Lade Wetterdaten…</p>
        </div>
      </section>
    `;

    const select = document.getElementById('wetter-gewaesser');
    const loadFor = async id => {
      const g = gewaesser.find(x => x.id === id);
      localStorage.setItem('fg_last_wetter_gewaesser', id);
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
        `;
      } catch (err) {
        resultEl.innerHTML = `<p class="muted">Fehler beim Laden der Wetterdaten: ${escapeHtml(err.message)}</p>`;
      }
    };

    select.addEventListener('change', () => loadFor(select.value));
    loadFor(select.value);
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
          <p class="muted">Angemeldet als <strong>${escapeHtml(Auth.currentUser())}</strong></p>
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
    const initial = location.hash.replace('#', '') || 'start';
    navigate(VIEWS[initial] ? initial : 'start');

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  function init() {
    if (Auth.isLoggedIn()) {
      boot();
    } else {
      headerEl.hidden = true;
      navEl.hidden = true;
      renderLogin();
    }
  }

  init();
})();
