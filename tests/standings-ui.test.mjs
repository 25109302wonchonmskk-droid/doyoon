import test from 'node:test';
import assert from 'node:assert/strict';
import {createStandingsPanel} from '../standings-ui.mjs';

test('standings controller discards stale sport responses and reuses league cache',async t=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',setAttribute(){},addEventListener(name,callback){this[name]=callback;}});return nodes.get(id);};
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 globalThis.document={querySelector:node};
 t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;globalThis.fetch=previousFetch;});
 const pending=[];globalThis.fetch=url=>new Promise(resolve=>pending.push({url,resolve}));
 let sport='soccer',selected='all';const panel=createStandingsPanel({getSport:()=>sport,getLeague:()=>selected,onLeagueChange:l=>{selected=l;panel.sync();},teamName:t=>t.name,logo:()=>'',esc:String,time:()=> '12:00'});
 const result=(league,sport)=>({league,sport,season:{label:'2026',type:'정규시즌'},groups:[{id:'one',name:league,rows:[]}],columns:[],fetchedAt:'2026-10-05T03:00:00Z',source:'Test',sourceUrl:'https://www.espn.com/'});
 const first=panel.sync();sport='baseball';const second=panel.sync();
 assert.match(pending[0].url,/eng.1/);assert.match(pending[1].url,/kbo/);
 pending[1].resolve(Response.json(result('kbo','baseball')));await second;
 pending[0].resolve(Response.json(result('eng.1','soccer')));await first;
 assert.equal(node('#standings-league').value,'kbo');assert.match(node('#standings-foot').innerHTML,/Test/);
 selected='mlb';const third=panel.sync();pending[2].resolve(Response.json(result('mlb','baseball')));await third;
 selected='kbo';await panel.sync();assert.equal(pending.length,3);assert.equal(node('#standings-league').value,'kbo');
});
