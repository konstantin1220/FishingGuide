// Cached die App-Shell, damit die App auch ohne Netzverbindung startet.
// Live-Wetterdaten (Open-Meteo) brauchen weiterhin eine Verbindung.
const CACHE_NAME = 'fishingguide-v14';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/icons.js',
  './js/storage.js',
  './js/weather.js',
  './js/tips.js',
  './js/koederPresets.js',
  './js/fuehrung.js',
  './js/supabaseClient.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // cache.addAll() nutzt intern fetch() mit normalem HTTP-Cache-Verhalten -
      // dadurch konnte die Service-Worker-Cache selbst bei neuer CACHE_NAME
      // versehentlich eine vom Browser bereits HTTP-gecachte, veraltete Datei
      // einfangen. { cache: 'reload' } erzwingt pro Datei einen echten
      // Netzwerk-Request unter Umgehung des HTTP-Caches.
      Promise.all(APP_SHELL.map(url =>
        fetch(url, { cache: 'reload' }).then(res => cache.put(url, res))
      ))
    )
  );
  // Neue Version sofort aktivieren statt zu warten, bis alle offenen Tabs
  // geschlossen wurden - sonst bekommen Nutzer Updates erst nach komplettem
  // Schließen der Seite zu sehen, ein Reload allein reicht dafür nicht.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Wetter-API, Kartenvorschau und Supabase (Gruppen/Leaderboard, Auth) immer
  // live abrufen, niemals aus dem Cache.
  if (
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('supabase.co')
  ) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
