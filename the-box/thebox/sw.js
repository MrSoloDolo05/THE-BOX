const CACHE_PREFIX = "the-box-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = [
    "./index.html",
    "./css/style.css",
    "./manifest.webmanifest",
    "./js/state.js",
    "./js/events.js",
    "./js/database.js",
    "./js/crate.js",
    "./js/one-liners.js",
    "./js/import.js",
    "./js/red-room.js",
    "./js/sync.js",
    "./js/tools.js",
    "./js/app.js",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
    "./icons/favicon.svg",
    "./icons/icon-192-v2.png",
    "./icons/icon-192.png",
    "./icons/icon-512-v2.png",
    "./icons/icon-512.png",
    "./icons/maskable-512-v2.png",
    "./icons/maskable-512.png",
    "./icons/maskable-icon.svg",
    "./icons/the-box-icon.svg",
    "./icons/the-box-mark.svg"
];
const APP_SHELL_PATHS = new Set(
    APP_SHELL.map(path =>
        new URL(path, self.registration.scope).pathname
    )
);

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(names =>
                Promise.all(
                    names
                        .filter(name =>
                            name.startsWith(CACHE_PREFIX) &&
                            name !== CACHE_NAME
                        )
                        .map(name => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    const isNavigation =
        request.mode === "navigate";

    if (
        !isNavigation &&
        !APP_SHELL_PATHS.has(url.pathname)
    ) {
        return;
    }

    event.respondWith(
        (async () => {
            const cache =
                await caches.open(CACHE_NAME);

            try {
                const response =
                    await fetch(request, { cache: "no-cache" });

                if (response.ok) {
                    await cache.put(
                        request,
                        response.clone()
                    );
                }

                return response;
            } catch (error) {
                const cached =
                    await cache.match(request, { ignoreSearch: true }) ||
                    (
                        isNavigation
                            ? await cache.match("./index.html")
                            : null
                    );

                return cached || Response.error();
            }
        })()
    );
});
