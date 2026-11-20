// RunPace Pro — service worker (mode hors ligne)
// Pour publier une nouvelle version de l'appli : change simplement le numéro ci-dessous.
const VERSION = 'runpace-v3';

const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

// Ressources externes utilisées par la page (style Tailwind et polices) : mises en mémoire à l'installation
const EXTERNAL = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(VERSION);
        await cache.addAll(SHELL);
        await Promise.all(EXTERNAL.map(async (url) => {
            try { await cache.put(url, await fetch(new Request(url, { mode: 'no-cors' }))); } catch (e) { /* hors ligne à l'installation : on réessaiera au fil des visites */ }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Stratégie : on répond tout de suite avec la version en mémoire, et on la rafraîchit en arrière-plan.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    event.respondWith((async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        }).catch(() => null);
        if (cached) { event.waitUntil(network); return cached; }
        const res = await network;
        if (res) return res;
        if (req.mode === 'navigate') {
            const shell = await cache.match('index.html');
            if (shell) return shell;
        }
        return Response.error();
    })());
});
