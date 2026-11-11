// 도담 서비스 워커. sw.js의 캐시 로직을 바꿀 때만 VERSION을 올린다.
// 정적 파일 배포는 VERSION을 올리지 않아도 된다: index.html은 네트워크 우선이고, /assets/는 파일 이름에 해시가 붙는다.
const VERSION = 'dodam-v3';
const PRECACHE = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icon-192.png'];
const ASSET_LIMIT = 40; // 배포마다 쌓이는 옛 해시 파일 상한(현재 index.html이 쓰는 파일은 제외)
// SW가 처리하지 않고 브라우저가 바로 네트워크로 보내는 경로(API, 로그인 흐름)
const BYPASS = ['/api', '/oauth2', '/login', '/logout'];

// FCM data-only messages: one display path, no second Firebase worker/auto-display.
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  const data = payload?.data;
  if (data?.kind !== 'dodam-reminder' || !/^[0-9a-f-]{36}$/i.test(data.notificationId || '')) return;
  event.waitUntil(self.registration.showNotification('도담 알림', {
    body: '확인할 복약 또는 일정이 있어요. 도담에서 확인해주세요.',
    icon: '/icon-192.png', tag: `dodam-${data.notificationId}`,
    data: { url: '/?push=1' }
  }));
});
self.addEventListener('notificationclick', event => {
  if (event.notification.data?.url !== '/?push=1') return;
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { existing.postMessage({ type: 'DODAM_OPEN_NOTIFICATIONS' }); await existing.focus(); }
    else await self.clients.openWindow('/?push=1');
  })());
});

const warn = (what, error) => console.warn(`[sw] ${what}`, error?.message || error);

// HTML에서 같은 출처 /assets/ 경로(script src, link href)를 중복 없이 모은다.
const assetsIn = (html) => [...new Set([...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)]
  .map((m) => new URL(m[1], self.location.origin))
  .filter((u) => u.origin === self.location.origin && u.pathname.startsWith('/assets/'))
  .map((u) => u.pathname))];

// index.html 응답이 쓰는 자산 중 캐시에 없는 것만 받아 둔다. 하나라도 실패하면 reject(호출부가 warn).
const cacheAssetsOf = async (cache, indexResponse) => {
  const paths = assetsIn(await indexResponse.text());
  const missing = [];
  for (const path of paths) if (!(await cache.match(path))) missing.push(path);
  await cache.addAll(missing);
  return paths.length;
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(PRECACHE);
    try { await cacheAssetsOf(cache, await cache.match('/index.html')); }
    catch (error) { warn('install: 화면 자산 캐시 실패', error); }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const trimAssets = async (cache) => {
  const index = await cache.match('/index.html');
  const keep = new Set(index ? assetsIn(await index.text()) : []);
  const keys = (await cache.keys()).filter((req) => {
    const path = new URL(req.url).pathname;
    return path.startsWith('/assets/') && !keep.has(path);
  });
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ASSET_LIMIT)).map((req) => cache.delete(req)));
};

// 캐시된 index.html은 그 화면의 /assets/ 파일이 모두 캐시에 있을 때만 돌려준다(없으면 JS를 못 읽어 빈 화면).
const offlineFallback = async (cache) => {
  const index = await cache.match('/index.html');
  if (index) {
    const paths = assetsIn(await index.clone().text());
    const found = await Promise.all(paths.map((path) => cache.match(path)));
    if (paths.length && found.every(Boolean)) return index;
    warn('오프라인: 화면 자산이 캐시에 없어 offline.html을 보여줍니다', `${found.filter(Boolean).length}/${paths.length}`);
  }
  return (await cache.match('/offline.html')) || Response.error();
};

const navigate = async (event) => {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic' && !response.redirected && (response.headers.get('content-type') || '').includes('text/html')) {
      const forCache = response.clone();
      const forScan = response.clone();
      event.waitUntil(
        cache.put('/index.html', forCache)
          .then(() => cacheAssetsOf(cache, forScan))
          .then(() => trimAssets(cache))
          .catch((error) => warn('index.html·화면 자산 캐시 실패', error)),
      );
    }
    return response;
  } catch (error) {
    warn('오프라인: 캐시된 화면을 확인합니다', error);
    return offlineFallback(cache);
  }
};

const asset = async (request) => {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone()).then(() => trimAssets(cache)).catch((error) => warn('asset 캐시 실패', error));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return;
  if (request.mode === 'navigate') { event.respondWith(navigate(event)); return; }
  if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request));
});
