// Service worker for the ZYT client-projects site (hub + client pages).
//
// Pages are fetched network-first, so an online user always gets the latest
// deploy; the last copy of each page is served when offline. Screenshots,
// icons and Google Fonts are served from cache and refreshed in the background.
//
// deploy-site.ps1 replaces __BUILD__ on every deploy, which retires old caches,
// and fills __SHOTS__ with every screenshot so pages work offline from the
// first visit.
const CACHE = 'zyt-admin-__BUILD__';
const PAGES = ['/', '/nct/customer-intake-sop/', '/nct/steps-1-3-runbook/', '/nct/steps-4-10-runbook/', '/nct/step-01-plan/', '/nct/step-02-plan/', '/nct/step-03-plan/', '/nct/step-04-plan/', '/nct/step-05-plan/', '/nct/step-06-plan/', '/nct/step-07-plan/', '/nct/step-08-plan/', '/nct/step-09-plan/', '/nct/step-10-plan/', '/nct/steps-4-10-crosscheck/', '/nct/steps-11-15-runbook/', '/nct/step-11-plan/', '/nct/step-12-plan/', '/nct/step-13-plan/', '/nct/step-14-plan/', '/nct/step-15-plan/', '/nct/steps-12-15-crosscheck/', '/nct/steps-16-19-runbook/', '/nct/step-16-plan/', '/nct/step-17-plan/', '/nct/step-18-plan/', '/nct/step-19-plan/', '/nct/steps-16-19-crosscheck/', '/nct/steps-20-26-runbook/', '/nct/step-20-plan/', '/nct/step-21-plan/', '/nct/step-22-plan/', '/nct/step-23-plan/', '/nct/step-24-plan/', '/nct/step-25-plan/', '/nct/step-26-plan/', '/nct/steps-20-26-crosscheck/', '/nct/step-27-runbook/', '/nct/step-27-plan/','/jwa/full-chain-sop/', '/harper/guest-concierge-sop/', '/harper/bot-answers/', '/zyt/commands/'];
const PRECACHE = [...PAGES, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/brand/logo-light-72.png', '/brand/logo-dark-72.png','/favicon.svg', /*__SHOTS__*/];

self.addEventListener('install', (event) => {
  // One by one, skipping failures: Cloudflare Access refuses a client the other companies' pages,
  // and addAll would then fail the whole install.
  event.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('zyt-admin-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// One cache entry per page, keyed by path, so /?tab=clients and / share a copy.
function pageKey(url) {
  const u = new URL(url);
  return u.origin + (u.pathname.endsWith('/') ? u.pathname : u.pathname + '/');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const key = pageKey(request.url);
  try {
    const fresh = await fetch(request);
    if (fresh.ok && !fresh.redirected) cache.put(key, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(key)) || (await cache.match(new URL('/', self.location.origin).href)) || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Golden-path recordings go straight to the network: a video is fetched in
  // Range requests, which a cached whole response answers wrongly, and the
  // verdict beside it must never be a stale copy.
  if (url.pathname.startsWith('/golden-paths/')) return;
  // Cloudflare Access (sign-in, sign-out, who is signed in) must never be answered from cache.
  if (url.pathname.startsWith('/cdn-cgi/')) return;

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Google Fonts and the pinned Convex browser bundle, so the dashboard opens offline
  // (read-only) with its fonts and scripts.
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isConvexBundle = url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/convex@');
  if (url.origin === self.location.origin || isFont || isConvexBundle) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
