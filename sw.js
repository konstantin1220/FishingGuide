// Cached die App-Shell, damit die App auch ohne Netzverbindung startet.
// Live-Wetterdaten (Open-Meteo) brauchen weiterhin eine Verbindung.
const CACHE_NAME = 'fishingguide-v9';
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
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
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
