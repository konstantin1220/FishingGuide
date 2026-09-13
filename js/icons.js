// Einheitliches Linien-Icon-Set (Inline-SVG, 24x24, currentColor) statt Emojis.
const Icons = (() => {
  const PATHS = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
    weather: '<circle cx="9.5" cy="9.5" r="3.5"/><path d="M9.5 3.5v1.4M14.5 5.4l-1 1M4.5 5.4l1 1"/><path d="M8 20h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.2 15.06 3 3 0 0 0 8 20Z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 12.06 3.5 3.5 0 0 0 7 18Z"/>',
    rain: '<path d="M6.5 15h10a3.7 3.7 0 0 0 .5-7.36A5.2 5.2 0 0 0 6.6 9.1 3.3 3.3 0 0 0 6.5 15Z"/><path d="M8.5 18.5 7.7 20M12.5 18.5l-.8 1.5M16.5 18.5l-.8 1.5"/>',
    fish: '<path d="M3 12c3-4 8-6 12-6 3 0 5.5 2.5 6 6-.5 3.5-3 6-6 6-4 0-9-2-12-6Z"/><circle cx="16" cy="10.5" r=".8" fill="currentColor" stroke="none"/><path d="M21 12c1 1 1.5 2 1.5 2s-.5 1-1.5 2M3 12c-1-.8-2-1-2-1M3 12c-1 .8-2 1-2 1"/>',
    bait: '<path d="M12 3v7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 14.2c0 3-2.5 4.5-2.5 6.8a2.5 2.5 0 0 0 5 0c0-2.3-2.5-3.8-2.5-6.8Z"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.55 1.55M7.15 16.85 5.6 18.4M18.4 18.4l-1.55-1.55M7.15 7.15 5.6 5.6"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0-.7 12.1a2 2 0 0 1-2 1.9H10.7a2 2 0 0 1-2-1.9L8 7"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M5 19h14"/>',
    upload: '<path d="M12 20V9"/><path d="M7.5 13.5 12 9l4.5 4.5"/><path d="M5 19h14"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    logout: '<path d="M15 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"/><path d="M10 12h10m0 0-3-3m3 3-3 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="1.5"/><path d="M4 10h16M8 3.5v3M16 3.5v3"/><circle cx="8.3" cy="14" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="0.9" fill="currentColor" stroke="none"/>',
    users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 8.5a2.8 2.8 0 0 1 0 5.4M19.5 20a4.8 4.8 0 0 0-3.3-5.6"/>',
  };

  function svg(name, opts = {}) {
    const size = opts.size || 22;
    const cls = opts.class ? ` ${opts.class}` : '';
    const body = PATHS[name] || '';
    return `<svg class="icon${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  return { svg };
})();
