// sw.js

// [★ 중요] 파일 수정 사항이 있을 때마다 이 버전을 올려주세요 (예: v1 -> v2)
const CACHE_NAME = 'chinese-app-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './data/patterns.js',
  './js/main.js',
  './js/api.js',
  './js/dom.js',
  './js/state.js',
  './js/ui.js',
  './js/handlers.js',
  './js/features.js',
  './js/speech.js',
  './js/db.js',
  './js/events/practiceEvents.js',
  './js/events/chatEvents.js',
  './js/events/listeningEvents.js',
  './js/events/toolEvents.js',
  './js/events/uiEvents.js'
];

// 1. 설치 (Install) - 캐싱
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. 활성화 (Activate) - 구 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. 요청 (Fetch) - 캐시 우선, 네트워크 폴백 (API는 제외)
self.addEventListener('fetch', (event) => {
  // API 요청은 캐시하지 않음
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});