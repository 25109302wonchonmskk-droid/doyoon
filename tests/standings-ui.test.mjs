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
 const result=(league,sport)=>({league,sport,season:{label:'2026',type:'정규시즌'},groups:[{id:'one',name:league,rows:[{rank:1,team:{name:'Team'},stats:{},losingStreak:league==='kbo'?3:2,recentForm:league==='kbo'?{played:10,wins:6,ties:1,losses:3,otLosses:0}:{played:4,wins:2,ties:0,losses:2,otLosses:0}}]}],columns:[],fetchedAt:'2026-10-05T03:00:00Z',source:'Test',sourceUrl:'https://www.espn.com/'});
 const first=panel.sync();sport='baseball';const second=panel.sync();
 assert.match(pending[0].url,/eng.1/);assert.match(pending[1].url,/kbo/);
 pending[1].resolve(Response.json(result('kbo','baseball')));await second;
 pending[0].resolve(Response.json(result('eng.1','soccer')));await first;
 assert.equal(node('#standings-league').value,'kbo');assert.match(node('#standings-foot').innerHTML,/Test/);
 assert.match(node('#standings-content').innerHTML,/class="rank-loss-streak"[^>]*>3연패</);
 assert.match(node('#standings-content').innerHTML,/최근 10경기/);assert.match(node('#standings-content').innerHTML,/6승 1무 3패/);
 selected='mlb';const third=panel.sync();pending[2].resolve(Response.json(result('mlb','baseball')));await third;
 assert.doesNotMatch(node('#standings-content').innerHTML,/rank-loss-streak/);
 assert.match(node('#standings-content').innerHTML,/2승 2패/);assert.match(node('#standings-content').innerHTML,/최근 4경기/);assert.doesNotMatch(node('#standings-content').innerHTML,/6승 1무 3패/);
 selected='kbo';await panel.sync();assert.equal(pending.length,3);assert.equal(node('#standings-league').value,'kbo');
 assert.match(node('#standings-content').innerHTML,/>3연패</);
});
