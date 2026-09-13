// Navigation + Rendering der 4 Views. Kein Framework, direktes DOM-Rendering.
(() => {
  const viewEl = document.getElementById('view');
  const navButtons = document.querySelectorAll('.nav-btn');

  const VIEWS = {
    gewaesser: renderGewaesser,
    fanglog: renderFanglog,
    koeder: renderKoeder,
    wetter: renderWetter,
  };

  function navigate(name) {
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    location.hash = name;
    VIEWS[name]();
  }

  navButtons.forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));

  function fmtDate(iso) {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- Gewässer ----------
  function renderGewaesser() {
    const items = Storage.gewaesser.list();
    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Gewässer</h2>
        <form id="gewaesser-form" class="card-form">
          <input type="text" name="name" placeholder="Name (z.B. Vereinsteich Nord)" required>
          <div class="row">
            <input type="number" step="any" name="lat" placeholder="Breitengrad (lat)" required>
            <input type="number" step="any" name="lon" placeholder="Längengrad (lon)" required>
          </div>
          <button type="button" id="use-location">📍 Aktuellen Standort verwenden</button>
          <textarea name="notiz" placeholder="Notiz (optional)"></textarea>
          <button type="submit">Gewässer hinzufügen</button>
        </form>
        <ul class="list">
          ${items.map(g => `
            <li class="list-item">
              <div>
                <strong>${escapeHtml(g.name)}</strong>
                <div class="muted">${g.lat}, ${g.lon}</div>
                ${g.notiz ? `<div class="muted">${escapeHtml(g.notiz)}</div>` : ''}
              </div>
              <button class="delete-btn" data-id="${g.id}">🗑️</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Gewässer angelegt.</li>'}
        </ul>
      </section>
    `;

    document.getElementById('use-location').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Standortzugriff wird von diesem Browser nicht unterstützt.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.querySelector('[name="lat"]').value = pos.coords.latitude.toFixed(5);
          document.querySelector('[name="lon"]').value = pos.coords.longitude.toFixed(5);
        },
        () => alert('Standort konnte nicht ermittelt werden.')
      );
    });

    document.getElementById('gewaesser-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Storage.gewaesser.add({
        name: fd.get('name').trim(),
        lat: parseFloat(fd.get('lat')),
        lon: parseFloat(fd.get('lon')),
        notiz: fd.get('notiz').trim(),
      });
      renderGewaesser();
    });

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        Storage.gewaesser.remove(btn.dataset.id);
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

    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Fanglog</h2>
        ${gewaesser.length === 0 ? '<p class="muted">Erst unter „Gewässer" ein Gewässer anlegen, um Fänge zu erfassen.</p>' : `
        <form id="fang-form" class="card-form">
          <input type="text" name="art" placeholder="Fischart" required>
          <div class="row">
            <input type="number" step="any" name="laenge" placeholder="Länge (cm)">
            <input type="number" step="any" name="gewicht" placeholder="Gewicht (g)">
          </div>
          <select name="gewaesserId" required>
            <option value="" disabled selected>Gewässer wählen</option>
            ${gewaesser.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
          <select name="koederId">
            <option value="">Köder (optional)</option>
            ${koeder.map(k => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join('')}
          </select>
          <input type="datetime-local" name="datum" required>
          <textarea name="notiz" placeholder="Notiz (optional)"></textarea>
          <button type="submit">Fang eintragen</button>
        </form>
        `}
        <ul class="list">
          ${items.map(f => `
            <li class="list-item">
              <div>
                <strong>${escapeHtml(f.art)}</strong>
                ${f.laenge ? ` · ${f.laenge} cm` : ''}${f.gewicht ? ` · ${f.gewicht} g` : ''}
                <div class="muted">${fmtDate(f.datum)} · ${escapeHtml(gName(f.gewaesserId))}${f.koederId ? ' · ' + escapeHtml(kName(f.koederId)) : ''}</div>
                ${f.notiz ? `<div class="muted">${escapeHtml(f.notiz)}</div>` : ''}
              </div>
              <button class="delete-btn" data-id="${f.id}">🗑️</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Fänge erfasst.</li>'}
        </ul>
      </section>
    `;

    const form = document.getElementById('fang-form');
    if (form) {
      form.querySelector('[name="datum"]').value = new Date().toISOString().slice(0, 16);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        Storage.faenge.add({
          art: fd.get('art').trim(),
          laenge: fd.get('laenge') ? parseFloat(fd.get('laenge')) : null,
          gewicht: fd.get('gewicht') ? parseFloat(fd.get('gewicht')) : null,
          gewaesserId: fd.get('gewaesserId'),
          koederId: fd.get('koederId') || null,
          datum: new Date(fd.get('datum')).toISOString(),
          notiz: fd.get('notiz').trim(),
        });
        renderFanglog();
      });
    }

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        Storage.faenge.remove(btn.dataset.id);
        renderFanglog();
      })
    );
  }

  // ---------- Köder ----------
  function renderKoeder() {
    const items = Storage.koeder.list();
    viewEl.innerHTML = `
      <section class="view-section">
        <h2>Köder-Bestand</h2>
        <form id="koeder-form" class="card-form">
          <input type="text" name="name" placeholder="Name (z.B. Gummifisch Weiß 8cm)" required>
          <input type="text" name="kategorie" placeholder="Kategorie (z.B. Gummiköder, Wobbler, Spinner)">
          <input type="number" name="anzahl" placeholder="Anzahl im Bestand" min="0">
          <textarea name="notiz" placeholder="Notiz (optional)"></textarea>
          <button type="submit">Köder hinzufügen</button>
        </form>
        <ul class="list">
          ${items.map(k => `
            <li class="list-item">
              <div>
                <strong>${escapeHtml(k.name)}</strong>${k.kategorie ? ` · ${escapeHtml(k.kategorie)}` : ''}
                <div class="muted">Bestand: ${k.anzahl ?? '–'}</div>
                ${k.notiz ? `<div class="muted">${escapeHtml(k.notiz)}</div>` : ''}
              </div>
              <button class="delete-btn" data-id="${k.id}">🗑️</button>
            </li>
          `).join('') || '<li class="muted">Noch keine Köder angelegt.</li>'}
        </ul>
      </section>
    `;

    document.getElementById('koeder-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Storage.koeder.add({
        name: fd.get('name').trim(),
        kategorie: fd.get('kategorie').trim(),
        anzahl: fd.get('anzahl') ? parseInt(fd.get('anzahl'), 10) : null,
        notiz: fd.get('notiz').trim(),
      });
      renderKoeder();
    });

    viewEl.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        Storage.koeder.remove(btn.dataset.id);
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

  // ---------- Start ----------
  const initial = location.hash.replace('#', '') || 'wetter';
  navigate(VIEWS[initial] ? initial : 'wetter');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
