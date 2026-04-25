const VERSION = "habit-tracker-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_CACHE = `${VERSION}-offline`;
const OFFLINE_URL = "/offline";

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isServerDataRequest(request, url) {
  return (
    request.method !== "GET" ||
    request.headers.has("next-action") ||
    request.headers.get("rsc") === "1" ||
    request.headers.get("accept")?.includes("text/x-component") ||
    url.searchParams.has("_rsc")
  );
}

async function cacheOfflinePage() {
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.addAll([OFFLINE_URL, "/manifest.json"]);
}

async function cleanupCaches() {
  const allowedCaches = [PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE, OFFLINE_CACHE];
  const cacheKeys = await caches.keys();

  await Promise.all(
    cacheKeys
      .filter((key) => !allowedCaches.includes(key))
      .map((key) => caches.delete(key)),
  );
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    if (event) {
      event.waitUntil(networkPromise);
    }
    return cachedResponse;
  }

  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  throw new Error("Network unavailable and no cached response.");
}

async function staleWhileRevalidatePage(request, event) {
  const cache = await caches.open(PAGE_CACHE);
  const offlineCache = await caches.open(OFFLINE_CACHE);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(async () => {
      return (await offlineCache.match(OFFLINE_URL)) ?? Response.error();
    });

  if (cachedResponse) {
    if (event) {
      event.waitUntil(networkPromise);
    }
    return cachedResponse;
  }

  return networkPromise;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflinePage());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([cleanupCaches(), self.clients.claim()]));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (isApiRequest(url) || isServerDataRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(staleWhileRevalidatePage(request, event));
    return;
  }

  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "worker"
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, event));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
  }
});
