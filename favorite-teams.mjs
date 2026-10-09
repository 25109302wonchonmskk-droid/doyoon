import {parseFavoriteTeams} from './team-schedule.mjs';

export const SAVED_TEAMS_KEY='doyoon-score-saved-teams';
export const favoriteTeamKey=team=>`${team.sport}:${team.league}:${team.id}`;
export function parseSavedTeams(raw){
 const result={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const value of Object.values(raw).slice(0,200)){
  if(!value?.sport)continue;
  const team=parseFavoriteTeams({[value.sport]:value})[value.sport];
  if(team)result[favoriteTeamKey(team)]=team;
 }
 return result;
}
export function readSavedTeams(preferences={}){
 try{
  const value=localStorage.getItem(SAVED_TEAMS_KEY);
  return parseSavedTeams(value===null?preferences:JSON.parse(value));
 }catch{return parseSavedTeams(preferences);}
}
