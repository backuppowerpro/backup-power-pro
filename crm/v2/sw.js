/* BPP CRM v2 — service worker
 *
 * Strategy:
 *   - App shell (HTML/CSS/JSX) → cache-first, stale-while-revalidate.
 *   - Supabase REST + Edge Functions → network-only (never cache user data).
 *   - CDN deps (React, Babel, Supabase-js, Twilio, Google Fonts) → cache-first.
 *
 * Bumps CACHE_VERSION on any shell change so clients get the new files.
 */

// Brand-alignment cache bump — invalidates the old Minesweeper/pixel
// assets that Key's browser was still serving from SW cache.
const CACHE_VERSION = 'bpp-v2-2026-04-24-final';
const SHELL_FILES = [
  '/crm/v2/',
  '/crm/v2/index.html',
  '/crm/v2/tokens.css',
  '/crm/v2/app.jsx',
  '/crm/v2/shell.jsx',
  '/crm/v2/leads-list.jsx',
  '/crm/v2/leads-pipeline.jsx',
  '/crm/v2/contact-detail.jsx',
  '/crm/v2/messages-inbox.jsx',
  '/crm/v2/calendar.jsx',
  '/crm/v2/finance.jsx',
  '/crm/v2/leads-permits.jsx',
  '/crm/v2/leads-materials.jsx',
  '/crm/v2/sparky.jsx',
  '/crm/v2/briefing.jsx',
  '/crm/v2/command-palette.jsx',
  '/crm/v2/voice-call.jsx',
  '/crm/v2/compressed-list.jsx',
  '/crm/v2/design-canvas.jsx',
  '/crm/v2/design-system.html',
  '/crm/v2/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — always network.
  if (url.hostname.includes('supabase.co')) return;

  // Never cache Twilio media/signaling.
  if (url.hostname.includes('twilio.com')) return;

  // App shell + CDN deps → stale-while-revalidate.
  const isShell = url.pathname.startsWith('/crm/v2/') && !url.pathname.includes('.output');
  const isCdn =
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (!isShell && !isCdn) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async cache => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then(resp => {
          if (resp && resp.ok) cache.put(event.request, resp.clone());
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
