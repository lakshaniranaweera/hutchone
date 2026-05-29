/* =========================================================
   IMAGE CACHE SERVICE WORKER
   On first load, precaches all image assets into the browser.
   Serves them cache-first for fast loading; entries older than
   3 hours are re-fetched from the network and refreshed.
   ========================================================= */

const CACHE_NAME = 'hutch-img-v1';
const MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours
const STAMP_HEADER = 'sw-cached-at';

// All image assets to warm into the cache on first visit.
const PRECACHE_URLS = [
  'wheel-frame.gif',
  'circle.png',
  'logo.png',
  'logo1.png',
  '1.png',
  'background.png',
  'images/home-bg.jpg',
  'images/Cap.png',
  'images/Pen.png',
  'images/Rs500.png',
  'images/Mug.png',
  'images/mug.png',
  'images/try.png',
  'images/Key Tag.png',
  'images/winners/1.png',
  'images/winners/2.png',
  'images/winners/3.png',
  'images/winners/4.png',
  'images/winners/5.png',
  'images/winners/6.png'
];

// Wrap a network response with a timestamp header so we can expire it later.
async function stampResponse(response) {
  const body = await response.blob();
  const headers = new Headers(response.headers);
  headers.set(STAMP_HEADER, Date.now().toString());
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isImageRequest(request) {
  if (request.destination === 'image') return true;
  return /\.(png|jpe?g|gif|svg|webp)$/i.test(new URL(request.url).pathname);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const res = await fetch(url, { cache: 'reload' });
          if (res && res.ok) await cache.put(url, await stampResponse(res));
        })
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isImageRequest(request)) return;
  event.respondWith(handleImage(request));
});

async function handleImage(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    const cachedAt = Number(cached.headers.get(STAMP_HEADER) || 0);
    if (Date.now() - cachedAt < MAX_AGE_MS) return cached;
  }

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put(request, await stampResponse(fresh.clone()));
    }
    return fresh;
  } catch (err) {
    // Offline / network failure — fall back to whatever we have, even if stale.
    if (cached) return cached;
    throw err;
  }
}
