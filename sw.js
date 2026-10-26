// 离线缓存：核心文件按版本缓存（新版本自动替换），录音单独缓存（跨版本保留，不重复下载）。
const VERSION = 'fe10f8c3d8';
const CORE = ["./", ".nojekyll", "app.js", "audio.js", "audio/index.json", "curriculum.js", "data/hanzi.tsv.gz", "data/phrases.tsv.gz", "data/syllables.json", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "licenses/audio-cmn.txt", "licenses/jieba.txt", "licenses/phrase-pinyin-data.txt", "licenses/pinyin-data.txt", "manifest.webmanifest", "pinyin.js", "styles.css"];
const CORE_CACHE = 'zy-core-' + VERSION;
const AUDIO_CACHE = 'zy-audio-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('zy-core-') && k !== CORE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope);
  if (req.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html')) {
    // 打开 App 本身：先用缓存里的页面，断网也能开（其他页面，比如许可文件，按普通文件处理）
    event.respondWith(caches.match(new URL('index.html', scope).href, { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  if (url.pathname.endsWith('.m4a')) {
    event.respondWith(caches.open(AUDIO_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
