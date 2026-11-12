/* Офлайн-режим сайта «На пиво».
   Страница и prices.js: сначала сеть (чтобы прайс всегда был свежий), если сети нет или она слишком медленная, берётся сохранённая копия.
   Фото, иконки и шрифты: из сохранённой копии, в фоне обновляются.
   GitHub API и таблицу Google (правки прайса, синхронизация) не трогаем. */
var V = "napivo-v1";
var SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "prices.js"];

self.addEventListener("install", function(e){
  e.waitUntil((async function(){
    var c = await caches.open(V);
    await Promise.all(SHELL.map(function(u){ return c.add(new Request(u, {cache: "reload"})).catch(function(){}); }));
    try{
      /* фото берём из самого прайса: строки "## Линейка | крепость | цена | файл" */
      var t = await (await c.match("prices.js")).text(), names = {};
      t.split("\n").forEach(function(l){
        if(/^\s*##(?!#)/.test(l)){ var f = (l.replace(/^\s*##\s*/, "").split("|")[3] || "").trim(); if(f) names[f] = 1; }
      });
      await Promise.all(Object.keys(names).map(function(n){ return c.add("img/" + encodeURI(n)).catch(function(){}); }));
    }catch(err){}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== V; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

async function netFirst(q, u){
  var c = await caches.open(V), scope = self.registration.scope;
  var key = q.mode === "navigate" ? scope : new URL(u.pathname, u.origin).href;
  try{
    var r = await Promise.race([fetch(q), new Promise(function(_, no){ setTimeout(no, 4000); })]);
    if(r && r.ok) c.put(key, r.clone());
    return r;
  }catch(err){
    var m = await c.match(key);
    if(!m && q.mode === "navigate") m = await c.match(scope + "index.html");
    return m || Response.error();
  }
}

async function swr(q){
  var c = await caches.open(V), m = await c.match(q, {ignoreSearch: true});
  var n = fetch(q).then(function(r){ if(r && (r.ok || r.type === "opaque")) c.put(q, r.clone()); return r; }).catch(function(){ return null; });
  return m || (await n) || Response.error();
}

self.addEventListener("fetch", function(e){
  var q = e.request;
  if(q.method !== "GET") return;
  var u = new URL(q.url);
  var own = u.origin === self.location.origin, font = u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
  if(!own && !font) return;
  if(own && (q.mode === "navigate" || /\/(prices\.js|index\.html)$/.test(u.pathname))) e.respondWith(netFirst(q, u));
  else e.respondWith(swr(q));
});
