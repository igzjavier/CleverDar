/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST as Parameters<typeof precacheAndRoute>[0]);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Fase 1: recibir notificaciones push y abrir la URL indicada al tocarlas.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'CleverDar', body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'CleverDar', {
      body: data.body,
      tag: data.tag,
      icon: 'icons/icon-192.png',
      data: { url: data.url ?? '#/hoy' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string) ?? '#/hoy', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(target).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
