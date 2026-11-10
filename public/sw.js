// 도담 서비스 워커. sw.js의 캐시 로직을 바꿀 때만 VERSION을 올린다.
// 정적 파일 배포는 VERSION을 올리지 않아도 된다: index.html은 네트워크 우선이고, /assets/는 파일 이름에 해시가 붙는다.
const VERSION = 'dodam-v1';
const PRECACHE = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icon-192.png'];
const ASSET_LIMIT = 40; // 배포마다 쌓이는 옛 해시 파일 상한
// SW가 처리하지 않고 브라우저가 바로 네트워크로 보내는 경로(API, 로그인 흐름)
const BYPASS = ['/api', '/oauth2', '/login', '/logout'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const warn = (what, error) => console.warn(`[sw] ${what}`, error?.message || error);

const trimAssets = async (cache) => {
  const keys = (await cache.keys()).filter((req) => new URL(req.url).pathname.startsWith('/assets/'));
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ASSET_LIMIT)).map((req) => cache.delete(req)));
};

const navigate = async (request) => {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !response.redirected && (response.headers.get('content-type') || '').includes('text/html')) {
      cache.put('/index.html', response.clone()).catch((error) => warn('index.html 캐시 실패', error));
    }
    return response;
  } catch (error) {
    warn('오프라인: 캐시된 화면을 보여줍니다', error);
    return (await cache.match('/index.html')) || (await cache.match('/offline.html')) || Response.error();
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
  if (request.mode === 'navigate') { event.respondWith(navigate(request)); return; }
  if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request));
});
