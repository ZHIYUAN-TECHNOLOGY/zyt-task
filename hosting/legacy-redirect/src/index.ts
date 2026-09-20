// Replaces the old nct-customer-intake-sop.wilfred-c3a.workers.dev site, which
// moved to https://admin.zhiyuantech.ai. Every request is forwarded to the new
// address; screenshots keep their file names.
//
// /sw.js is answered, not redirected: browsers that installed the old web app
// fetch it to check for updates. The replacement worker clears the old caches,
// unregisters itself and sends open windows to the new site.

const TARGET = 'https://admin.zhiyuantech.ai';
const SOP_PATH = '/nct/customer-intake-sop/';

const RETIRE_WORKER = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach((w) => w.navigate('${TARGET}${SOP_PATH}'));
  })());
});
`;

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (url.pathname === '/sw.js') {
      return new Response(RETIRE_WORKER, {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    const shot = url.pathname.match(/^\/customer-intake-sop\/shots\/([\w.-]+)$/);
    const path = shot ? `${SOP_PATH}shots/${shot[1]}` : SOP_PATH;
    return Response.redirect(TARGET + path, 302);
  },
};
