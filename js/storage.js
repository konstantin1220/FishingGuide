// Einfacher Wrapper um localStorage für die drei Kern-Datentypen.
const Storage = (() => {
  const KEYS = {
    gewaesser: 'fg_gewaesser',
    faenge: 'fg_faenge',
    koeder: 'fg_koeder',
  };

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

  function makeCrud(key) {
    return {
      list() {
        return readAll(key);
      },
      get(id) {
        return readAll(key).find(item => item.id === id);
      },
      add(data) {
        const items = readAll(key);
        const item = { id: uid(), ...data };
        items.push(item);
        writeAll(key, items);
        return item;
      },
      update(id, data) {
        const items = readAll(key);
        const idx = items.findIndex(item => item.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...data };
        writeAll(key, items);
        return items[idx];
      },
      remove(id) {
        writeAll(key, readAll(key).filter(item => item.id !== id));
      },
    };
  }

  function exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      gewaesser: readAll(KEYS.gewaesser),
      faenge: readAll(KEYS.faenge),
      koeder: readAll(KEYS.koeder),
    };
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Ungültiges Datenformat');
    if (Array.isArray(data.gewaesser)) writeAll(KEYS.gewaesser, data.gewaesser);
    if (Array.isArray(data.faenge)) writeAll(KEYS.faenge, data.faenge);
    if (Array.isArray(data.koeder)) writeAll(KEYS.koeder, data.koeder);
  }

  return {
    gewaesser: makeCrud(KEYS.gewaesser),
    faenge: makeCrud(KEYS.faenge),
    koeder: makeCrud(KEYS.koeder),
    exportAll,
    importAll,
  };
})();
