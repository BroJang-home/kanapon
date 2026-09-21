/* KanaApp 서비스 워커: 앱 셸 프리캐시 + cache-first */
var CACHE_VERSION = 'kanaapp-cache-v5';

var PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './css/fonts.css',
  './js/core.js',
  './js/intro.js',
  './js/strokes-player.js',
  './js/trainer.js',
  './js/views/home.js',
  './js/views/chart.js',
  './js/views/flash.js',
  './js/views/words.js',
  './js/views/sentences.js',
  './js/views/settings.js',
  './js/views/about.js',
  './js/data/kana.js',
  './js/data/words.js',
  './js/data/sentences.js',
  './js/data/strokes.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './fonts/pretendard-400.subset.woff2',
  './fonts/pretendard-500.subset.woff2',
  './fonts/pretendard-700.subset.woff2',
  './fonts/zen-maru-gothic-54-500-normal.woff2',
  './fonts/zen-maru-gothic-54-700-normal.woff2',
  './fonts/zen-maru-gothic-54-900-normal.woff2',
  './fonts/zen-maru-gothic-61-500-normal.woff2',
  './fonts/zen-maru-gothic-61-700-normal.woff2',
  './fonts/zen-maru-gothic-61-900-normal.woff2',
  './fonts/zen-maru-gothic-65-500-normal.woff2',
  './fonts/zen-maru-gothic-65-700-normal.woff2',
  './fonts/zen-maru-gothic-65-900-normal.woff2',
  './fonts/zen-maru-gothic-77-500-normal.woff2',
  './fonts/zen-maru-gothic-77-700-normal.woff2',
  './fonts/zen-maru-gothic-77-900-normal.woff2',
  './fonts/zen-maru-gothic-79-500-normal.woff2',
  './fonts/zen-maru-gothic-79-700-normal.woff2',
  './fonts/zen-maru-gothic-79-900-normal.woff2',
  './fonts/zen-maru-gothic-106-500-normal.woff2',
  './fonts/zen-maru-gothic-106-700-normal.woff2',
  './fonts/zen-maru-gothic-106-900-normal.woff2',
  './fonts/zen-maru-gothic-115-500-normal.woff2',
  './fonts/zen-maru-gothic-115-700-normal.woff2',
  './fonts/zen-maru-gothic-115-900-normal.woff2',
  './fonts/zen-maru-gothic-116-500-normal.woff2',
  './fonts/zen-maru-gothic-116-700-normal.woff2',
  './fonts/zen-maru-gothic-116-900-normal.woff2',
  './fonts/zen-maru-gothic-117-500-normal.woff2',
  './fonts/zen-maru-gothic-117-700-normal.woff2',
  './fonts/zen-maru-gothic-117-900-normal.woff2',
  './fonts/zen-maru-gothic-119-500-normal.woff2',
  './fonts/zen-maru-gothic-119-700-normal.woff2',
  './fonts/zen-maru-gothic-119-900-normal.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return fetch(url).then(function (resp) {
          if (resp && resp.ok) return cache.put(url, resp);
        }).catch(function () { /* 개별 자산 실패는 무시 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
        }
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
