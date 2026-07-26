/* ============================================================
   モグもり Service Worker
   ------------------------------------------------------------
   アプリの基本ファイルを端末に保存(キャッシュ)して、
   オフラインでも開けるようにします。
   AI判定(api.anthropic.com)とFirebaseの通信はキャッシュしません。

   【保存の方針】ネット優先(network-first)
     ・通信できるとき  → 必ず最新を表示し、保存も新しく更新する
     ・通信できないとき → 保存済みのファイルで開く
   これにより「更新したのに古い画面のまま」が起きにくくなります。

   ※アプリを更新したときは、下の CACHE_VERSION の数字を1つ
     上げると、全員のスマホに新しいファイルが行き渡ります。
   ============================================================ */
const CACHE_VERSION = "mogumori-v8";

// キャッシュするのはアプリの基本ファイルだけ(判定APIはキャッシュしない)
const APP_FILES = [
  "./",
  "./index.html",
  "./additives.json",
  "./manifest.json"
];

// 画面側から「すぐ新しい版に切り替えて」と言われたら従う
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// インストール時:基本ファイルを保存し、すぐ新しい版に切り替える
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// 有効化時:古いバージョンのキャッシュを掃除し、開いている画面をこの版に引き継ぐ
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 通信のたびに呼ばれる
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // AI判定・Firebase・その他の外部通信には一切関与しない
  if (url.origin !== self.location.origin) return;

  // GET以外(データ送信など)にも関与しない
  if (event.request.method !== "GET") return;

  // ネット優先:まず最新を取りに行き、成功したら保存も更新する。
  // 通信できないときだけ、保存済みのファイルで開く。
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true })
          .then((cached) => {
            if (cached) return cached;
            // ページ表示の通信で保存が無ければ、保存済みのindex.htmlで開く
            if (event.request.mode === "navigate") return caches.match("./index.html");
            return Response.error();
          })
      )
  );
});
