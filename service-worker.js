/**
 * Service Worker for Warm Journal PWA
 * オフライン完全対応・キャッシュ管理
 * Safari / iOS "Response served by service worker has redirections" 対策済み
 */

const CACHE_NAME = 'warm-journal-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/dateUtils.js',
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

/**
 * Safari (WebKit) の不具合・仕様制限対策:
 * リダイレクト履歴を持つ Response (response.redirected === true) を
 * respondWith() に渡すと "Response served by service worker has redirections" エラーになるため、
 * 新しい Response オブジェクトとして再構築してリダイレクトフラグを除去する。
 */
function cleanResponse(response) {
  if (!response || !response.redirected) {
    return response;
  }
  const status = (response.status >= 200 && response.status <= 599) ? response.status : 200;
  const body = (status === 204 || status === 304) ? null : response.body;
  return new Response(body, {
    status: status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// インストール時にコアアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS_TO_CACHE.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(asset, cleanResponse(response));
            }
          } catch (err) {
            console.warn('Precache failed for:', asset, err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// アクティベーション時に古いキャッシュ（v1等）を破棄
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

// フェッチ処理（Stale-While-Revalidate + Safariリダイレクト保護）
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    event.respondWith(
      (async () => {
        try {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            // キャッシュを即座に返しつつ、バックグラウンドで最新を取得してキャッシュ更新
            fetch(event.request).then(async (networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, cleanResponse(networkResponse));
              }
            }).catch(() => {});

            return cleanResponse(cachedResponse);
          }

          // キャッシュになければネットワークから取得
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, cleanResponse(networkResponse.clone()));
          }
          return cleanResponse(networkResponse);
        } catch (err) {
          // オフライン時のナビゲーションフォールバック
          if (event.request.mode === 'navigate') {
            const fallback = await caches.match('./') || await caches.match('./index.html');
            if (fallback) {
              return cleanResponse(fallback);
            }
          }
          throw err;
        }
      })()
    );
  } else {
    // 外部リソース（Google Fonts 等）
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached ? cleanResponse(cached) : Promise.reject('offline');
      })
    );
  }
});
