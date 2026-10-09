import test from 'node:test';
import assert from 'node:assert/strict';
import {favoriteTeamKey,parseSavedTeams,readSavedTeams,SAVED_TEAMS_KEY} from '../favorite-teams.mjs';
import {routeParams,apiUrl} from '../api-url.mjs';
test('saved teams preserve multiple leagues and migrate without resurrecting removed favorites',t=>{
 const old=globalThis.localStorage;t.after(()=>{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;});
 const lg={sport:'baseball',league:'kbo',id:'LG',name:'LG'},kt={sport:'baseball',league:'kbo',id:'KT',name:'KT'},soccer={sport:'soccer',league:'eng.1',id:'1',name:'Soccer'};
 let value=null;globalThis.localStorage={getItem:key=>{assert.equal(key,SAVED_TEAMS_KEY);return value;}};
 assert.equal(readSavedTeams({baseball:lg})[favoriteTeamKey(lg)].name,'LG');
 value='{}';assert.deepEqual(readSavedTeams({baseball:lg}),{});
 const saved=parseSavedTeams({lg,kt,soccer,invalid:{...lg,id:'../../other'},wrong:{...lg,sport:'soccer'}});
 assert.equal(Object.keys(saved).length,3);assert.equal(saved[favoriteTeamKey(kt)].name,'KT');
 value=JSON.stringify(saved);assert.deepEqual(readSavedTeams(),saved);
});
test('downloaded HTML reads hash parameters and sends only file pages to the hosted API',t=>{
 const old=globalThis.location;t.after(()=>{if(old===undefined)delete globalThis.location;else globalThis.location=old;});
 const params=routeParams({search:'',hash:'#/?sport=baseball&league=kbo&date=2026-10-09'});
 assert.equal(params.get('league'),'kbo');assert.equal(params.get('date'),'2026-10-09');
 assert.equal(routeParams({search:'?sport=soccer',hash:'#/?sport=baseball'}).get('sport'),'soccer');
 globalThis.location={protocol:'file:'};assert.equal(apiUrl('/api/team-schedule'),'https://doyoon-tau.vercel.app/api/team-schedule');
 globalThis.location={protocol:'https:'};assert.equal(apiUrl('/api/scores'),'/api/scores');
});
