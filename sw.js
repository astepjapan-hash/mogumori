/* ============================================================
   モグもり Service Worker
   ------------------------------------------------------------
   アプリの基本ファイルだけを端末に保存(キャッシュ)して、
   2回目以降の起動を速く・オフラインでも開けるようにします。
   AI判定(api.anthropic.com)とFirebaseの通信はキャッシュしません。
   ※アプリを更新したときは、下の CACHE_VERSION の数字を1つ
     上げると、全員のスマホに新しいファイルが行き渡ります。
   ============================================================ */
const CACHE_VERSION = "mogumori-v2";

// キャッシュするのはアプリの基本ファイルだけ(判定APIはキャッシュしない)
const APP_FILES = [
  "./",
  "./index.html",
  "./additives.json",
  "./manifest.json"
];

// インストール時:基本ファイルを保存する
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// 有効化時:古いバージョンのキャッシュを掃除する
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 通信のたびに呼ばれる:基本ファイルはキャッシュ優先、それ以外は普通に通信
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // AI判定・Firebase・その他の外部通信には一切関与しない
  if (url.origin !== self.location.origin) return;

  // GET以外(データ送信など)にも関与しない
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      // 画面を開く通信(ページ表示)は、オフラインなら保存済みのindex.htmlで開く
      if (!cached && event.request.mode === "navigate") {
        return fetch(event.request).catch(() => caches.match("./index.html"));
      }
      // ネットにつながるなら最新を取りに行き、キャッシュも更新する
      const fetched = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached); // オフラインならキャッシュを返す
      return cached || fetched;
    })
  );
});
