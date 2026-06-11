const CACHE_NAME = "openai-cost-analyzer-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/vendor/chart.umd.min.js",
  "./js/vendor/dayjs.min.js",
  "./js/vendor/papaparse.min.js",
  "./js/helpers.js",
  "./js/pricing.js",
  "./js/parser.js",
  "./js/charts.js",
  "./js/app.js",
  "./config/pricing.json",
  "./config/reasoning_profiles.json",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
