(()=>{
"use strict";

function createRecommendationEngine(deps){
 const {
  getState,totals,health,mortgageData,goalProgress,goalForecast,
  futureValueMonthly,fmtNok,fmtPct
 }=deps;

 function approximateNok(value){
  const amount=Math.max(0,Number(value)||0);
  if(amount>=1000000)return `ca. ${(amount/1000000).toLocaleString("nb-NO",{minimumFractionDigits:1,maximumFractionDigits:1})} mill. kr`;
  const step=amount>=100000?10000:amount>=10000?1000:100;
  return `ca. ${fmtNok(Math.round(amount/step)*step)}`;
 }

 function context(){
  const state=getState(),t=totals(),h=health(),m=mortgageData(),income=Math.max(1,state.profile.netIncome),monthlyExpenses=Math.max(1,t.expenses);
  const bufferMonths=state.profile.buffer/monthlyExpenses,bufferTarget=Math.max(1,state.profile.goalBufferMonths),savingsRate=t.investment/income;
  const stage=t.remaining<0?"stabilize":bufferMonths<1||m.stressRemaining<0?"protect":bufferMonths<bufferTarget?"strengthen":"grow";
  return {state,t,h,m,income,monthlyExpenses,bufferMonths,bufferTarget,savingsRate,stage,goals:state.goals||[]};
 }

 function signature(id,...values){
  return [id,...values.map(value=>typeof value==="number"?Math.round(value):String(value))].join("|");
 }

 function goalBoost(rec,current){
  const metrics=new Set(current.goals.filter(goal=>goalProgress(goal)<100).map(goal=>goal.metric));
  const matches={cashflow:["buffer"],liquidity:["buffer"],growth:["portfolio","monthlyInvestment","netWorth","pension"],debt:["mortgage","debtReduction"],pension:["pension"],goal:["custom"]}[rec.dimension]||[];
  return matches.some(metric=>metrics.has(metric))?22:0;
 }

 function stageWeight(stage,dimension){
  const weights={
   stabilize:{cashflow:120,liquidity:55,debt:55,efficiency:55,growth:5,pension:15,goal:10},
   protect:{cashflow:90,liquidity:115,debt:105,efficiency:55,growth:15,pension:35,goal:25},
   strengthen:{cashflow:70,liquidity:105,debt:75,efficiency:60,growth:55,pension:50,goal:45},
   grow:{cashflow:55,liquidity:50,debt:65,efficiency:70,growth:110,pension:80,goal:85}
  };
  return weights[stage]?.[dimension]||40;
 }

 function suppressed(rec,current){
  const history=current.state.ui.recommendationState||{completed:[],dismissed:[]},now=Date.now();
  const same=entry=>entry.id===rec.id&&(!entry.signature||entry.signature===rec.signature);
  if((history.completed||[]).some(same))return true;
  return (history.dismissed||[]).some(entry=>same(entry)&&(!entry.until||Date.parse(entry.until)>now));
 }

 function rank(candidates,current){
  return candidates.map(rec=>{
   const alignment=goalBoost(rec,current),stageScore=stageWeight(current.stage,rec.dimension);
   const priority=stageScore+rec.urgency*.34+rec.impact*.28+rec.feasibility*.18+alignment-rec.effort*4;
   const priorityBand=priority>=175?"Viktigst nå":priority>=145?"Høy prioritet":"Neste mulighet";
   return {...rec,goalBoost:alignment,priority,priorityBand};
  }).filter(rec=>!suppressed(rec,current)).sort((a,b)=>b.priority-a.priority);
 }

 function futureMonthlyImpact(monthlyDelta,current){
  const years=Math.max(1,current.state.life.retireAge-current.state.life.startAge);
  return futureValueMonthly(monthlyDelta,current.state.life.retMid/100,years);
 }

 function recommendations(){
  const current=context(),{state,t,h,m,income,monthlyExpenses,bufferMonths,bufferTarget,savingsRate}=current;
  const bufferGap=Math.max(0,bufferTarget*monthlyExpenses-state.profile.buffer),recs=[];

  if(t.remaining<0){
   const cut=Math.ceil(Math.abs(t.remaining)/100)*100;
   recs.push({id:"balance_budget",signature:signature("balance_budget",cut),dimension:"cashflow",title:`Få budsjettet i balanse med ${fmtNok(cut)}`,description:"Utgiftene er høyere enn inntekten. Dette bør løses før nye sparetiltak vurderes.",whyNow:`Budsjettet mangler ${fmtNok(cut)} hver måned.`,effect:`${fmtNok(cut)} bedre månedlig kontantstrøm`,healthDelta:Math.max(2,Math.min(8,Math.round(cut/income*20))),effort:1,urgency:100,impact:100,feasibility:90,confidence:"Høy",cta:"Åpne budsjettet",action:{type:"budget",amount:cut}});
  }

  if(bufferGap>0&&t.remaining>0){
   const available=Math.max(100,Math.floor(t.remaining/100)*100),desired=Math.max(100,Math.ceil(bufferGap/12/100)*100),monthly=Math.min(available,desired);
   const months=Math.max(1,Math.ceil(bufferGap/monthly));
   recs.push({id:"build_buffer",signature:signature("build_buffer",bufferGap,monthly),dimension:"liquidity",title:`Bygg buffer med ${fmtNok(monthly)} per måned`,description:`Bufferen dekker ${bufferMonths.toFixed(1)} av målet på ${bufferTarget} måneder.`,whyNow:bufferMonths<1?"Mindre enn én måneds utgifter er tilgjengelig som reserve.":`Det gjenstår ${fmtNok(bufferGap)} til valgt buffermål.`,effect:`Målet kan nås på omtrent ${months} måneder`,healthDelta:Math.max(2,Math.min(8,20-h.dimensions.find(item=>item.name==="Likviditet").score)),effort:2,urgency:bufferMonths<1?98:78,impact:92,feasibility:Math.min(95,55+t.remaining/income*200),confidence:"Høy",cta:"Legg inn i budsjettet",action:{type:"buffer",amount:monthly}});
  }

  if(state.life.mortgage>0&&(m.maxRate<.075||m.stressRemaining<0)){
   const available=Math.max(0,Math.floor(t.remaining/500)*500),extra=Math.min(3000,available);
   recs.push({id:"reduce_mortgage_risk",signature:signature("reduce_mortgage_risk",m.maxRate,extra),dimension:"debt",title:extra>0?`Test ${fmtNok(extra)} i ekstra avdrag`:"Styrk rentetåligheten",description:`Budsjettet går omtrent i null ved ${fmtPct(m.maxRate)} rente.`,whyNow:m.stressRemaining<0?`Ved rentestress mangler budsjettet ${fmtNok(Math.abs(m.stressRemaining))}.`:"Rentemarginen er lavere enn anbefalt sikkerhetsnivå i modellen.",effect:extra>0?"Mulig lavere rente og kortere løpetid":"Bedre månedlig sikkerhetsmargin",healthDelta:Math.max(1,Math.min(6,20-h.dimensions.find(item=>item.name==="Gjeld").score)),effort:3,urgency:m.stressRemaining<0?96:68,impact:78,feasibility:extra>0?72:48,confidence:"Middels",cta:extra>0?"Prøv i simulatoren":"Se renteanalysen",action:extra>0?{type:"mortgage",amount:extra}:{type:"settings"}});
  }

  const targetRate=Math.max(.10,state.profile.goalInvestmentRate/100);
  if(t.remaining>=500&&bufferMonths>=1&&savingsRate<targetRate){
   const gap=Math.max(0,targetRate*income-t.investment),increase=Math.max(500,Math.min(Math.floor(t.remaining/500)*500,Math.ceil(gap/500)*500));
   if(increase>0)recs.push({id:"increase_investment",signature:signature("increase_investment",increase,state.life.retireAge-state.life.startAge),dimension:"growth",title:`Test ${fmtNok(increase)} mer i månedlig investering`,description:`Investeringsgraden er ${fmtPct(savingsRate)}, mot målet på ${fmtPct(targetRate)}.`,whyNow:`Budsjettet har ${fmtNok(t.remaining)} til overs uten å bli negativt.`,effect:`Omtrent +${approximateNok(futureMonthlyImpact(increase,current)).replace(/^ca\.\s*/,"")} ved pensjonsalder`,healthDelta:Math.max(1,Math.min(6,Math.round(increase/income*30))),effort:2,urgency:current.stage==="grow"?76:48,impact:94,feasibility:88,confidence:"Middels",cta:"Prøv i simulatoren",action:{type:"investment",amount:state.life.monthlyInvestment+increase}});
  }

  const subscriptions=state.budget.find(row=>row.id==="subscriptions");
  if(subscriptions&&subscriptions.amount>Math.max(800,income*.025)){
   const cut=Math.max(100,Math.min(500,Math.floor(subscriptions.amount*.2/100)*100));
   recs.push({id:"review_subscriptions",signature:signature("review_subscriptions",subscriptions.amount),dimension:"efficiency",title:`Vurder å redusere abonnement med ${fmtNok(cut)}`,description:"Dette er en gjentakende kostnad som ofte kan gjennomgås uten stor livsstilsendring.",whyNow:`Posten er ${fmtPct(subscriptions.amount/income)} av nettoinntekten.`,effect:`Kan frigjøre ${fmtNok(cut)} per måned`,healthDelta:1,effort:1,urgency:38,impact:58,feasibility:82,confidence:"Middels",cta:"Bruk forslaget",action:{type:"budgetRow",id:"subscriptions",amount:Math.max(0,subscriptions.amount-cut)}});
  }

  const insurance=state.budget.find(row=>row.id==="insurance");
  if(insurance&&insurance.amount>income*.06){
   const cut=Math.max(100,Math.min(700,Math.floor(insurance.amount*.12/100)*100));
   recs.push({id:"review_insurance",signature:signature("review_insurance",insurance.amount),dimension:"efficiency",title:"Sammenlign forsikringene dine",description:`Forsikring utgjør ${fmtPct(insurance.amount/income)} av nettoinntekten.`,whyNow:"Kostnaden ligger høyt relativt til inntekten i modellen.",effect:`Mulig reduksjon rundt ${fmtNok(cut)} per måned`,healthDelta:1,effort:2,urgency:32,impact:52,feasibility:62,confidence:"Lav",cta:"Se budsjettposten",action:{type:"budgetRow",id:"insurance",amount:Math.max(0,insurance.amount-cut)}});
  }

  if(state.life.otpRate<=0&&state.life.ipsAnnual<=0)recs.push({id:"pension_review",signature:signature("pension_review",state.life.otpRate,state.life.ipsAnnual),dimension:"pension",title:"Registrer eller vurder pensjonssparing",description:"Pensjonsdelen mangler et løpende innskudd i modellen.",whyNow:"Uten registrert pensjon blir fremtidsbildet mindre realistisk.",effect:"Mer troverdig pensjonsprognose",healthDelta:3,effort:2,urgency:50,impact:68,feasibility:78,confidence:"Høy",cta:"Åpne innstillinger",action:{type:"settings"}});

  current.goals.forEach(goal=>{
   const pct=goalProgress(goal);if(pct<=0||pct>=100)return;const forecast=goalForecast(goal);
   recs.push({id:"goal_"+goal.id,signature:signature("goal_"+goal.id,pct,goal.target),dimension:"goal",title:`Følg opp målet «${goal.name}»`,description:`Du er ${Math.round(pct)} % på vei.`,whyNow:forecast?`Dagens prognose peker mot ${forecast.year}.`:"Målet nås ikke i dagens prognose.",effect:forecast?`Forventet målår ${forecast.year}`:"Planen må justeres for å nå målet",healthDelta:0,effort:2,urgency:forecast?45:72,impact:66,feasibility:70,confidence:"Middels",cta:"Åpne målet",action:{type:"goal",id:goal.id}});
  });

  return rank(recs,current);
 }

 function editTarget(rec){
  const action=rec?.action||{};
  if(action.type==="buffer")return "liquidity";
  if(action.type==="investment")return "investment";
  if(action.type==="mortgage")return "mortgage";
  if(action.type==="goal"||action.type==="goals")return "goals";
  if(action.type==="settings")return "futureSettings";
  if(action.type==="budgetRow")return action.id==="subscriptions"?"subscriptions":action.id==="insurance"?"insurance":"budget";
  return "budget";
 }

 return {recommendations,context,editTarget};
}

globalThis.OFRecommendations=Object.freeze({createRecommendationEngine});
})();
