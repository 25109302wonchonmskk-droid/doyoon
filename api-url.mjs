// The downloadable HTML shares the hosted, read-only sports endpoints.
export function apiUrl(path){
 return globalThis.location?.protocol==='file:'?'https://doyoon-tau.vercel.app'+path:path;
}
export function routeParams(location){
 const hash=location.hash||'',query=hash.includes('?')?hash.slice(hash.indexOf('?')+1):'';
 return new URLSearchParams(location.search||query);
}
