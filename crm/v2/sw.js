/* BPP CRM v2 — service worker KILL SWITCH (2026-05-02)
 *
 * v2 is retired. Any client that still has the old v2 service worker
 * registered will get this version on the next update check. It:
 *   1. Deletes every cache (clears the stale v2 shell + CDN caches).
 *   2. Self-unregisters so the next page load goes network-direct.
 *   3. Forces clients to /crm/v3/ on the next navigation request.
 *
 * Without this, dock shortcuts that ever touched /crm/v2/ keep
 * serving cached v2 HTML even after the file is updated server-side.
 */

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Claim all clients so we control them immediately.
    await self.clients.claim();
    // Wipe every cache this SW had ownership of.
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
    // Unregister self so the next page load is fully network-direct.
    await self.registration.unregister();
    // Bounce every controlled client to v3.
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) {
      try { c.navigate('/crm/v3/'); } catch {}
    }
  })());
});

self.addEventListener('fetch', event => {
  // Network-only while we're winding down — no cache reads.
  // Don't intercept; let the browser fetch normally.
});
