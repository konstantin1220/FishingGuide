// Wrapper um localStorage für die Kern-Datentypen. Daten werden pro
// eingeloggtem Konto getrennt gespeichert (siehe setNamespace) - jedes
// Konto sieht nur seine eigenen Gewässer/Fänge/Köder/Trips.
const Storage = (() => {
  const BASE_KEYS = { gewaesser: 'gewaesser', faenge: 'faenge', koeder: 'koeder', trips: 'trips' };
  let namespace = '';

  function setNamespace(ns) {
    namespace = ns || '';
  }

  function keyFor(base) {
    return namespace ? `fg_u_${namespace}_${base}` : `fg_${base}`;
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function readAll(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function writeAll(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function makeCrud(base) {
    return {
      list() {
        return readAll(keyFor(base));
      },
      get(id) {
        return readAll(keyFor(base)).find(item => item.id === id);
      },
      add(data) {
        const key = keyFor(base);
        const items = readAll(key);
        const item = { id: uid(), ...data };
        items.push(item);
        writeAll(key, items);
        return item;
      },
      update(id, data) {
        const key = keyFor(base);
        const items = readAll(key);
        const idx = items.findIndex(item => item.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        writeAll(key, items);
        return items[idx];
      },
      remove(id) {
        const key = keyFor(base);
        writeAll(key, readAll(key).filter(item => item.id !== id));
      },
    };
  }

  function exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      gewaesser: readAll(keyFor(BASE_KEYS.gewaesser)),
      faenge: readAll(keyFor(BASE_KEYS.faenge)),
      koeder: readAll(keyFor(BASE_KEYS.koeder)),
      trips: readAll(keyFor(BASE_KEYS.trips)),
    };
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Ungültiges Datenformat');
    if (Array.isArray(data.gewaesser)) writeAll(keyFor(BASE_KEYS.gewaesser), data.gewaesser);
    if (Array.isArray(data.faenge)) writeAll(keyFor(BASE_KEYS.faenge), data.faenge);
    if (Array.isArray(data.koeder)) writeAll(keyFor(BASE_KEYS.koeder), data.koeder);
    if (Array.isArray(data.trips)) writeAll(keyFor(BASE_KEYS.trips), data.trips);
  }

  // Übernimmt Daten aus den alten, ungetrennten Keys (vor Mehrbenutzer-Login)
  // einmalig ins Konto des ersten registrierten Nutzers.
  function migrateLegacyInto(ns) {
    const prevNamespace = namespace;
    namespace = ns;
    let migrated = false;
    Object.values(BASE_KEYS).forEach(base => {
      const legacyKey = `fg_${base}`;
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        localStorage.setItem(keyFor(base), legacyRaw);
        localStorage.removeItem(legacyKey);
        migrated = true;
      }
    });
    namespace = prevNamespace;
    return migrated;
  }

  return {
    gewaesser: makeCrud(BASE_KEYS.gewaesser),
    faenge: makeCrud(BASE_KEYS.faenge),
    koeder: makeCrud(BASE_KEYS.koeder),
    trips: makeCrud(BASE_KEYS.trips),
    exportAll,
    importAll,
    setNamespace,
    migrateLegacyInto,
  };
})();
