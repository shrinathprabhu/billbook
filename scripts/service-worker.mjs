export function serviceWorkerSource(urls, version) {
  return `const PREFIX='billbook-root-v1-';
const CACHE=PREFIX+${JSON.stringify(version)};
const ASSETS=${JSON.stringify(urls)};
const KNOWN=new Set(ASSETS);
const OWN_PREFIXES=[PREFIX,'billbook-app-v1-','billbook-standalone-v1-'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>OWN_PREFIXES.some(prefix=>k.startsWith(prefix))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const home=url.pathname==='/'||url.pathname==='/index.html';
 if(!home&&!KNOWN.has(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const match=await cache.match(home?'/':request,{ignoreSearch:true});
  if(match)return match;
  return fetch(request);
 }));
});\n`;
}
