'use strict';

const cacheName = 'private-links-v9';
const shell = ['./', './index.html', './style.css', './app.js', './languages.js', './cleaner.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const shareEndpoint = new URL('./share', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key.startsWith('private-links-') && key !== cacheName).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method === 'POST' && request.url === shareEndpoint) {
    event.respondWith((async () => {
      try {
        const data = await request.formData();
        const input = ['url', 'text', 'title'].map(field => data.get(field))
          .filter(value => typeof value === 'string' && value).join('\n').slice(0, 32768);
        const html = await (await caches.match('./index.html')).text();
        const payload = JSON.stringify(input).replaceAll('<', '\\u003c');
        return new Response(html.replace('</body>',
          () => '<script id="shared-input" type="application/json">' + payload + '</script></body>'), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      } catch {
        return Response.redirect(new URL('./', self.registration.scope), 303);
      }
    })());
  } else if (request.method === 'GET' && shell.some(path =>
    request.url === new URL(path, self.registration.scope).href)) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
