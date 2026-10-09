import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..'),modules={};
function collect(name){
 if(modules[name])return;
 const code=readFileSync(resolve(root,name),'utf8');modules[name]=code;
 for(const match of code.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))collect(match[1]);
}
collect('app.js');
const bootstrap=`const modules=${JSON.stringify(modules).replaceAll('<','\\u003c')};\nconst urls=new Map();\nfunction moduleURL(name){if(urls.has(name))return urls.get(name);const code=modules[name].replace(/from\\s+['"]\\.\\/([^'"]+)['"]/g,(_,dependency)=>'from '+JSON.stringify(moduleURL(dependency)));const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));urls.set(name,url);return url;}\nimport(moduleURL('app.js')).catch(()=>{document.querySelector('#results').textContent='화면을 열지 못했습니다. https://doyoon-tau.vercel.app에서 접속해 주세요.';});`;
let html=readFileSync(resolve(root,'index.html'),'utf8')
 .replace('<link rel="stylesheet" href="styles.css">',`<style>${readFileSync(resolve(root,'styles.css'),'utf8')}</style>`)
 .replace('<script type="module" src="app.js"></script>',`<script type="module">${bootstrap}</script>`)
 .replace('href="favicon.svg"',`href="data:image/svg+xml,${encodeURIComponent(readFileSync(resolve(root,'favicon.svg'),'utf8'))}"`);
const out=resolve(root,process.argv[2]||'downloads/index.html');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,html);console.log(out);
