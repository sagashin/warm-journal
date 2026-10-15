/**
 * Service Worker for Warm Journal PWA
 * オフライン完全対応・キャッシュ管理
 */

const CACHE_NAME = 'warm-journal-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/editor.js',
  './js/timeline.js',
  './js/calendar.js',
  './js/gallery.js',
  './js/onThisDay.js',
  './js/stats.js',
  './js/lock.js',
  './js/ai.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// インストール時にコアアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// アクティベーション時に古いキャッシュを整理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ処理（Stale-While-Revalidate または Cache First）
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Google Fontsなどの外部CDNはNetwork優先・キャッシュフォールバック
  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // キャッシュを返しつつ、バックグラウンドで最新を取得してキャッシュ更新
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
  } else {
    // 外部リソース
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
