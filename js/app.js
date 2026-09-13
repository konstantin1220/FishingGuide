// Navigation + Rendering der Views. Kein Framework, direktes DOM-Rendering.
(() => {
  const viewEl = document.getElementById('view');
  const navButtons = document.querySelectorAll('.nav-btn');

  const VIEWS = {
    start: renderStart,
    gewaesser: renderGewaesser,
    fanglog: renderFanglog,
    koeder: renderKoeder,
    wetter: renderWetter,
    einstellungen: renderEinstellungen,
  };

  // Bearbeiten-Status je View (welcher Eintrag gerade im Formular bearbeitet wird)
  let gewaesserEditId = null;
  let fangEditId = null;
  let koederEditId = null;
  let koederExpandedId = null;

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

  // ---------- Start / Übersicht ----------
  function renderStart() {
    const faenge = Storage.faenge.list();
    const gewaesser = Storage.gewaesser.list();
    const koeder = Storage.koeder.list();
    const letzterFang = [...faenge].sort((a, b) => new Date(b.datum) - new Date(a.datum))[0];

    const cards = [
      {
        view: 'wetter', icon: '🌤️', title: 'Wetter-Tipps',
        subtitle: gewaesser.length ? 'Live-Tipps für deine Gewässer' : 'Erst ein Gewässer anlegen',
      },
      { view: 'fanglog', icon: '🐟', title: 'Fanglog', subtitle: `${faenge.length} Fänge erfasst` },
      { view: 'koeder', icon: '🪱', title: 'Köder', subtitle: `${koeder.length} im Bestand` },
      { view: 'gewaesser', icon: '📍', title: 'Gewässer', subtitle: `${gewaesser.length} angelegt` },
    ];

    viewEl.innerHTML = `
      <section class="view-section">
        <div class="hero">
          <h2>Willkommen zurück 👋</h2>
          <p class="muted">${letzterFang
            ? `Dein letzter Fang: ${escapeHtml(letzterFang.art)} · ${fmtDate(letzterFang.datum)}`
            : 'Noch keine Fänge erfasst – leg direkt los!'}</p>
        </div>
        <div class="dashboard-grid">
          ${cards.map(c => `
            <button class="dashboard-card" data-view="${c.view}">
              <span class="dashboard-icon">${c.icon}</span>
              <span class="dashboard-title">${c.title}</span>
              <span class="dashboard-subtitle">${escapeHtml(c.subtitle)}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;

    viewEl.querySelectorAll('.dashboard-card').forEach(btn =>
      btn.addEventListener('click', () => navigate(btn.dataset.view))
    );
  }

  // ---------- Gewässer ----------
  function updateMapPreview(container, lat, lon) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      container.innerHTML = '<p class="muted">Koordinaten eingeben, um eine Kartenvorschau zu sehen.</p>';
      return;
    }
    const d = 0.01;
    const bbox = `${lonNum - d}%2C${latNum - d}%2C${lonNum + d}%2C${latNum + d}`;
    container.innerHTML = `
      <iframe class="map-preview-frame" loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latNum}%2C${lonNum}">
      </iframe>
    `;
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
          <button type="button" id="use-location">📍 Aktuellen Standort verwenden</button>
          <div id="map-preview" class="map-preview"></div>
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
              <button class="delete-btn" data-id="${g.id}" data-label="${escapeHtml(g.name)}">🗑️</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Gewässer angelegt.</li>'}
        </ul>
      </section>
    `;

    const latInput = document.querySelector('[name="lat"]');
    const lonInput = document.querySelector('[name="lon"]');
    const mapPreview = document.getElementById('map-preview');
    updateMapPreview(mapPreview, latInput.value, lonInput.value);
    [latInput, lonInput].forEach(input =>
      input.addEventListener('change', () => updateMapPreview(mapPreview, latInput.value, lonInput.value))
    );

    document.getElementById('use-location').addEventListener('click', () => {
      if (!window.isSecureContext) {
        alert('Standortzugriff erfordert eine sichere Verbindung (HTTPS) oder localhost. Bitte Koordinaten manuell eingeben.');
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
          updateMapPreview(mapPreview, latInput.value, lonInput.value);
        },
        err => {
          const messages = {
            1: 'Standortzugriff wurde verweigert. Bitte in den Browser-/Systemeinstellungen erlauben oder Koordinaten manuell eingeben.',
            2: 'Standort konnte nicht ermittelt werden (kein Signal?). Bitte manuell eingeben.',
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

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Fanglog</h2>
        ${gewaesser.length === 0 ? '<p class="muted">Erst unter „Gewässer" ein Gewässer anlegen, um Fänge zu erfassen.</p>' : `
        <form id="fang-form" class="card-form">
          <input type="text" name="art" placeholder="Fischart" value="${editing ? escapeHtml(editing.art) : ''}" required>
          <div class="row">
            <input type="number" step="any" name="laenge" placeholder="Länge (cm)" value="${editing?.laenge ?? ''}">
            <input type="number" step="any" name="gewicht" placeholder="Gewicht (g)" value="${editing?.gewicht ?? ''}">
          </div>
          <select name="gewaesserId" required>
            <option value="" disabled ${editing ? '' : 'selected'}>Gewässer wählen</option>
            ${gewaesser.map(g => `<option value="${g.id}" ${editing?.gewaesserId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
          <select name="koederId">
            <option value="">Köder (optional)</option>
            ${koeder.map(k => `<option value="${k.id}" ${editing?.koederId === k.id ? 'selected' : ''}>${escapeHtml(k.name)}</option>`).join('')}
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
              <button class="delete-btn" data-id="${f.id}" data-label="${escapeHtml(f.art)}">🗑️</button>
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
          <input type="text" name="kategorie" placeholder="Kategorie (z.B. Gummiköder, Wobbler, Spinner)" value="${editing ? escapeHtml(editing.kategorie || '') : ''}">
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
                    🎣 ${koederExpandedId === k.id ? 'Führung ausblenden' : 'Wie führe ich das?'}
                  </button>
                  ${koederExpandedId === k.id ? Fuehrung.renderInfo(k.fuehrung) : ''}
                ` : ''}
              </div>
              <button class="delete-btn" data-id="${k.id}" data-label="${escapeHtml(k.name)}">🗑️</button>
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

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Wetter-Tipps</h2>
        <select id="wetter-gewaesser">
          ${gewaesser.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
        </select>
        <div id="wetter-result" class="wetter-result">
          <p class="muted">Lade Wetterdaten…</p>
        </div>
      </section>
    `;

    const select = document.getElementById('wetter-gewaesser');
    const loadFor = async id => {
      const g = gewaesser.find(x => x.id === id);
      const resultEl = document.getElementById('wetter-result');
      resultEl.innerHTML = '<p class="muted">Lade Wetterdaten…</p>';
      try {
        const w = await Weather.fetchCurrent(g.lat, g.lon);
        const tips = Tips.getTips(w);
        resultEl.innerHTML = `
          <div class="weather-card">
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
          <p class="muted">${gewaesser.length} Gewässer · ${faenge.length} Fänge · ${koeder.length} Köder — alle Daten liegen nur lokal auf diesem Gerät.</p>
          <button type="button" id="export-btn">⬇️ Daten exportieren (Backup)</button>
          <button type="button" id="import-btn" class="secondary-btn">⬆️ Daten importieren</button>
          <input type="file" id="import-file" accept="application/json" hidden>
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
  }

  // ---------- Start ----------
  const initial = location.hash.replace('#', '') || 'start';
  navigate(VIEWS[initial] ? initial : 'start');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
