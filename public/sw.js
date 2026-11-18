const VERSION='rotas-vivas-v07-guide';const ASSETS=['/','/index.html','/styles.css','/app.js','/isometric.js','/guide-v7.css','/guide-v7.js','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname==='/socket')return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
