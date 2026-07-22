(()=>{
"use strict";

/* Grunnverdier, lagring og datamodell */
const fmtNok=n=>new Intl.NumberFormat("nb-NO",{style:"currency",currency:"NOK",maximumFractionDigits:0}).format(Number(n)||0);
const fmtPct=n=>new Intl.NumberFormat("nb-NO",{style:"percent",maximumFractionDigits:1}).format(Number(n)||0);
const clone=o=>JSON.parse(JSON.stringify(o));
const SCHEMA_VERSION=5;
const STORAGE="okonomiskFremtid_v2";
const LEGACY_STORAGE="okonomiskFremtidPWA_v1";
const VALID_PAGES=new Set(["dashboard","budget","future","decisions","goals","settings"]);
window.__runtimeErrors=[];

const defaultState={
 version:SCHEMA_VERSION,
 ui:{theme:"light",page:"dashboard",budgetMode:"budget",referenceMode:true,onboarded:false,appGuideSeen:false,goalsGuideSeen:false,goalSuggestionsDismissed:false,recommendationState:{completed:[],dismissed:[]}},
 life:{
  startAge:42,retireAge:67,startYear:2026,salary:744840,salaryGrowth:3,raiseShare:4.2,
  monthlyInvestment:2505,bonus:0,ipsAnnual:0,otpRate:4,
  portfolioStart:91000,ipsStart:0,otpStart:0,
  includeHome:true,homeValue:4576100,mortgage:2071800,homeGrowth:2,annualPrincipal:44000,
  mortgageRate:5.08,loanYears:25,loanType:"annuity",
  inflation:2,retLow:7,retMid:9,retHigh:11
 },
 profile:{netIncome:59650,buffer:53266,adults:2,children:0,ownsHome:true,hasCar:true,goalBufferMonths:3,goalInvestmentRate:15},
 annual:{travel:0,gifts:0,health:0,maintenance:0},
 goals:[],
 budgetTargets:{target:null,snapshots:[]},
 accounting:{activeMonth:new Date().toISOString().slice(0,7),months:{}},
 history:[],
 budget:[
  {id:"housing",name:"Bolig / husleie",amount:15000,reference2026:15000,type:"fixed"},
  {id:"common",name:"Felleskostnader og kommunale avgifter",amount:2200,reference2026:2200,type:"fixed"},
  {id:"electricity",name:"Strøm og brensel",amount:1592,reference2026:1592,type:"fixed"},
  {id:"groceries",name:"Dagligvarer",amount:6315,reference2026:6315,type:"variable"},
  {id:"alcohol",name:"Alkohol og tobakk",amount:1169,reference2026:1169,type:"variable"},
  {id:"clothing",name:"Klær og sko",amount:1900,reference2026:1900,type:"variable"},
  {id:"homeMaintenance",name:"Boligvedlikehold og innbo",amount:1200,reference2026:1200,type:"variable"},
  {id:"electronics",name:"Elektronikk og husholdningsutstyr",amount:600,reference2026:600,type:"variable"},
  {id:"householdOther",name:"Andre husholdningsartikler",amount:916,reference2026:916,type:"variable"},
  {id:"health",name:"Helse og tannlege",amount:1205,reference2026:1205,type:"variable"},
  {id:"transport",name:"Kollektiv, drivstoff og bom",amount:3500,reference2026:3500,type:"variable"},
  {id:"vehicle",name:"Bilhold og transportutstyr",amount:4202,reference2026:4202,type:"variable"},
  {id:"subscriptions",name:"Telefon, internett og abonnement",amount:2415,reference2026:2415,type:"fixed"},
  {id:"leisure",name:"Fritid, sport og kultur",amount:2794,reference2026:2794,type:"variable"},
  {id:"travel",name:"Ferie og reise",amount:1500,reference2026:1500,type:"variable"},
  {id:"education",name:"Utdanning og kurs",amount:324,reference2026:324,type:"variable"},
  {id:"restaurant",name:"Restaurant og overnatting",amount:2296,reference2026:2296,type:"variable"},
  {id:"insurance",name:"Forsikring og finansielle tjenester",amount:2198,reference2026:2198,type:"fixed"},
  {id:"personalCare",name:"Personlig pleie",amount:800,reference2026:800,type:"variable"},
  {id:"gifts",name:"Gaver og høytider",amount:700,reference2026:700,type:"variable"},
  {id:"misc",name:"Andre varer og tjenester",amount:440,reference2026:440,type:"variable"},
  {id:"studentLoan",name:"Studielån",amount:0,reference2026:0,type:"fixed"},
  {id:"investment",name:"Investering",amount:2505,reference2026:2505,type:"saving",linked:true},
  {id:"bufferSaving",name:"Buffersparing",amount:0,reference2026:0,type:"saving"}
 ]
};
let state=loadState();
let projections={};
const renderMetrics=Object.fromEntries([...VALID_PAGES].map(page=>[page,0]));


function completeOnboarding(){
 const income=Math.max(0,Number(document.getElementById("onboardIncome").value)||0);
 const investment=Math.max(0,Number(document.getElementById("onboardInvestment").value)||0);
 const age=Math.max(18,Number(document.getElementById("onboardAge").value)||30);
 const retire=Math.max(age+1,Number(document.getElementById("onboardRetire").value)||67);
 state.profile.netIncome=income;
 state.life.monthlyInvestment=investment;
 state.life.startAge=age;
 state.life.retireAge=retire;
 state.ui.referenceMode=income===defaultState.profile.netIncome&&investment===defaultState.life.monthlyInvestment&&age===defaultState.life.startAge&&retire===defaultState.life.retireAge;
 const inv=state.budget.find(x=>x.linked);if(inv)inv.amount=state.life.monthlyInvestment;
 state.ui.onboarded=true;closeModal("onboardingModal");renderAll();saveState();setTimeout(startAppGuide,320);
}


function closeOnboardingAndGuide(){
 state.ui.onboarded=true;
 closeModal("onboardingModal");
 saveState();
 toast("Du kan åpne omvisningen fra «Om verktøyet» når du vil.")
}

function finiteNumber(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
function safeText(value,fallback=""){return typeof value==="string"?value:fallback}
function normalizeBudget(rows){
 const input=Array.isArray(rows)?rows:[];
 const byId=new Map(input.filter(row=>row&&typeof row==="object"&&row.id).map(row=>[String(row.id),row]));
 const merged=defaultState.budget.map(base=>{
  const saved=byId.get(base.id)||{};
  return {...base,...saved,id:base.id,name:safeText(saved.name,base.name),amount:Math.max(0,finiteNumber(saved.amount,base.amount)),reference2026:Math.max(0,finiteNumber(saved.reference2026,base.reference2026)),type:["fixed","variable","saving"].includes(saved.type)?saved.type:base.type,linked:Boolean(base.linked)};
 });
 const known=new Set(defaultState.budget.map(row=>row.id));
 input.forEach((row,index)=>{
  if(!row||known.has(String(row.id)))return;
  merged.splice(Math.max(0,merged.length-1),0,{id:safeText(row.id,"custom_"+index),name:safeText(row.name,"Egen post"),amount:Math.max(0,finiteNumber(row.amount)),reference2026:Math.max(0,finiteNumber(row.reference2026)),type:["fixed","variable","saving"].includes(row.type)?row.type:"variable"});
 });
 return merged;
}
function normalizeAccounting(input){
 const source=input&&typeof input==="object"?input:{};
 const activeMonth=/^\d{4}-\d{2}$/.test(source.activeMonth||"")?source.activeMonth:new Date().toISOString().slice(0,7);
 const months={};
 if(source.months&&typeof source.months==="object"){
  Object.entries(source.months).forEach(([month,record])=>{
   if(!/^\d{4}-\d{2}$/.test(month)||!record||typeof record!=="object")return;
   const rows={};
   if(record.rows&&typeof record.rows==="object")Object.entries(record.rows).forEach(([id,value])=>{rows[id]=value===null||value===""||typeof value==="undefined"?null:Math.max(0,finiteNumber(value))});
   months[month]={actualIncome:record.actualIncome===null||record.actualIncome===""||typeof record.actualIncome==="undefined"?null:Math.max(0,finiteNumber(record.actualIncome)),rows,updatedAt:safeText(record.updatedAt,"")};
  });
 }
 return {activeMonth,months};
}
function normalizeState(raw){
 const source=raw&&typeof raw==="object"?raw:{};
 const sourceVersion=finiteNumber(source.version,1);
 const normalized={
  ...clone(defaultState),...source,version:SCHEMA_VERSION,
  ui:{...clone(defaultState.ui),...(source.ui||{}),page:VALID_PAGES.has(source.ui?.page)?source.ui.page:"dashboard",budgetMode:source.ui?.budgetMode==="accounting"?"accounting":"budget",theme:source.ui?.theme==="dark"?"dark":"light",recommendationState:{completed:Array.isArray(source.ui?.recommendationState?.completed)?source.ui.recommendationState.completed.filter(x=>typeof x==="string"):[],dismissed:Array.isArray(source.ui?.recommendationState?.dismissed)?source.ui.recommendationState.dismissed.filter(x=>typeof x==="string"):[]}},
  life:{...clone(defaultState.life),...(source.life||{})},
  profile:{...clone(defaultState.profile),...(source.profile||{})},
  annual:{...clone(defaultState.annual),...(source.annual||{})},
  goals:Array.isArray(source.goals)?source.goals.filter(goal=>goal&&typeof goal==="object"):[],
  budgetTargets:{target:source.budgetTargets?.target&&typeof source.budgetTargets.target==="object"?source.budgetTargets.target:null,snapshots:Array.isArray(source.budgetTargets?.snapshots)?source.budgetTargets.snapshots.filter(item=>item&&typeof item==="object"):[]},
  accounting:normalizeAccounting(source.accounting),
  history:Array.isArray(source.history)?source.history:[],
  budget:normalizeBudget(source.budget)
 };
 Object.keys(defaultState.life).forEach(key=>{if(typeof defaultState.life[key]==="number")normalized.life[key]=finiteNumber(normalized.life[key],defaultState.life[key])});
 Object.keys(defaultState.profile).forEach(key=>{if(typeof defaultState.profile[key]==="number")normalized.profile[key]=finiteNumber(normalized.profile[key],defaultState.profile[key])});
 Object.keys(defaultState.annual).forEach(key=>normalized.annual[key]=Math.max(0,finiteNumber(normalized.annual[key],defaultState.annual[key])));
 if(sourceVersion<3&&normalized.ui.referenceMode){
  const savedBudget=Array.isArray(source.budget)?source.budget:[];
  const budgetWasEdited=savedBudget.some(row=>row&&finiteNumber(row.reference2026,0)>0&&Math.abs(finiteNumber(row.amount)-finiteNumber(row.reference2026))>1);
  const onboardingWasEdited=finiteNumber(source.profile?.netIncome,59650)!==59650||finiteNumber(source.life?.monthlyInvestment,3103)!==3103||finiteNumber(source.life?.startAge,42)!==42||finiteNumber(source.life?.retireAge,67)!==67;
  if(budgetWasEdited||onboardingWasEdited){
   normalized.ui.referenceMode=false;
  }else{
   normalized.life=clone(defaultState.life);
   normalized.profile=clone(defaultState.profile);
   normalized.annual=clone(defaultState.annual);
   normalized.budget=clone(defaultState.budget);
  }
 }
 normalized.life.startAge=Math.max(18,normalized.life.startAge);
 normalized.life.retireAge=Math.max(normalized.life.startAge+1,normalized.life.retireAge);
 normalized.life.monthlyInvestment=Math.max(0,normalized.life.monthlyInvestment);
 const investmentRow=normalized.budget.find(row=>row.linked);
 if(investmentRow)investmentRow.amount=normalized.life.monthlyInvestment;
 return normalized;
}
function loadState(){
 try{
  const raw=localStorage.getItem(STORAGE)||localStorage.getItem(LEGACY_STORAGE);
  if(raw)return normalizeState(JSON.parse(raw));
 }catch(error){recordRuntimeError("Lagring",error)}
 return clone(defaultState);
}
let saveTimer;
function saveState(){
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{
  try{
   localStorage.setItem(STORAGE,JSON.stringify(state));
   const status=document.getElementById("saveStatus");
   if(status)status.textContent="Lagret "+new Date().toLocaleTimeString("nb-NO",{hour:"2-digit",minute:"2-digit"});
  }catch(error){recordRuntimeError("Lagring",error)}
 },180);
}
function recordRuntimeError(area,error){
 const entry={area,message:error?.message||String(error),time:new Date().toISOString()};
 window.__runtimeErrors.push(entry);console.error(`[${area}]`,error);
 const notice=document.getElementById("appNotice");
 if(notice){notice.classList.add("visible");notice.innerHTML=`<strong>${escapeHtml(area)} kunne ikke oppdateres.</strong><span>Resten av verktøyet virker fortsatt. Last siden på nytt hvis problemet vedvarer.</span>`}
}
function clearRuntimeNotice(){const notice=document.getElementById("appNotice");if(notice){notice.classList.remove("visible");notice.textContent=""}}
function toast(msg){const e=document.getElementById("toast");if(!e)return;e.textContent=msg;e.style.display="block";setTimeout(()=>e.style.display="none",1800)}
function openModal(id){document.getElementById(id)?.classList.add("open")}
function closeModal(id){document.getElementById(id)?.classList.remove("open")}
function toggleTheme(){state.ui.theme=state.ui.theme==="dark"?"light":"dark";applyTheme();saveState();renderAll()}
function applyTheme(){document.body.classList.toggle("dark",state.ui.theme==="dark")}




function annualMonthly(){return (state.annual.travel+state.annual.gifts+state.annual.health+state.annual.maintenance)/12}
function totals(){
 const investment=state.budget.filter(x=>x.linked).reduce((s,x)=>s+x.amount,0);
 const otherSaving=state.budget.filter(x=>!x.linked&&x.type==="saving").reduce((s,x)=>s+x.amount,0);
 const fixed=state.budget.filter(x=>x.type==="fixed").reduce((s,x)=>s+x.amount,0);
 const variable=state.budget.filter(x=>x.type==="variable").reduce((s,x)=>s+x.amount,0);
 const annual=annualMonthly(),expenses=fixed+variable+annual,total=expenses+investment+otherSaving;
 return {investment,otherSaving,fixed,variable,annual,expenses,total,remaining:state.profile.netIncome-total}
}
function mortgagePayment(balance,annualRate,years,type){
 balance=Math.max(0,balance);const r=Math.max(0,annualRate)/12,n=Math.max(1,years*12);
 if(!balance)return 0;if(type==="interestOnly")return balance*r;if(type==="serial")return balance/n+balance*r;if(!r)return balance/n;
 return balance*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)
}
function mortgageData(){
 const l=state.life,t=totals(),entered=(state.budget.find(x=>x.id==="mortgage")||state.budget.find(x=>x.id==="housing"))?.amount||0;
 const currentRate=l.mortgageRate/100,stressRate=Math.max(.07,currentRate+.03);
 const current=mortgagePayment(l.mortgage,currentRate,l.loanYears,l.loanType);
 const stress=mortgagePayment(l.mortgage,stressRate,l.loanYears,l.loanType);
 const stressRemaining=t.remaining+entered-stress;
 let lo=0,hi=.30,available=t.remaining+entered;
 for(let i=0;i<65;i++){const m=(lo+hi)/2;if(mortgagePayment(l.mortgage,m,l.loanYears,l.loanType)<=available)lo=m;else hi=m}
 return {currentRate,stressRate,current,stress,stressRemaining,maxRate:lo,entered}
}
function simulateLoan(extraMonthly=0){
 const l=state.life,balanceStart=Math.max(0,l.mortgage),rate=Math.max(0,l.mortgageRate/100/12),maxMonths=Math.max(1,Math.round(l.loanYears*12));
 const run=extra=>{
  let balance=balanceStart,interest=0,months=0;
  const annuity=mortgagePayment(balanceStart,l.mortgageRate/100,l.loanYears,"annuity");
  const serialPrincipal=balanceStart/maxMonths;
  while(balance>0.01&&months<maxMonths*2){
   const monthInterest=balance*rate;interest+=monthInterest;
   let payment=l.loanType==="interestOnly"?monthInterest: l.loanType==="serial"?serialPrincipal+monthInterest:annuity;
   payment+=Math.max(0,extra);
   const principal=Math.max(0,payment-monthInterest);
   if(principal<=0&&extra<=0){months=maxMonths;break}
   balance=Math.max(0,balance-principal);months++;
  }
  return {months,interest,balance};
 };
 const baseline=run(0),accelerated=run(extraMonthly);
 return {baseline,accelerated,monthsSaved:Math.max(0,baseline.months-accelerated.months),interestSaved:Math.max(0,baseline.interest-accelerated.interest)};
}
function project(rate){
 const l=state.life,rows=[];let salary=l.salary,monthly=l.monthlyInvestment,bonus=l.bonus,port=l.portfolioStart,ips=l.ipsStart,otp=l.otpStart;
 let home=l.includeHome?l.homeValue:0,loan=l.includeHome?l.mortgage:0,price=1;
 for(let i=0;i<=l.retireAge-l.startAge;i++){
  const ordinary=monthly*12,otpIn=salary*l.otpRate/100;
  port=(port+ordinary+bonus)*(1+rate);ips=(ips+l.ipsAnnual)*(1+rate);otp=(otp+otpIn)*(1+rate);
  if(l.includeHome){home*=1+l.homeGrowth/100;loan=Math.max(0,loan-l.annualPrincipal)}
  price*=1+l.inflation/100;
  const equity=l.includeHome?home-loan:0,net=state.profile.buffer+port+ips+otp+equity;
  rows.push({year:l.startYear+i,age:l.startAge+i,salary,monthly,port,ips,otp,pension:ips+otp,home,loan,equity,net,real:net/price});
  const raise=salary*l.salaryGrowth/100;salary+=raise;monthly+=raise*l.raiseShare/100/12;bonus+=bonus*l.salaryGrowth/100*l.raiseShare/100;
 }
 return rows
}
/* Beregninger og økonomisk helse */
function recalc(){
 projections.low=project(state.life.retLow/100);
 projections.mid=project(state.life.retMid/100);
 projections.high=project(state.life.retHigh/100);
}
function nowNetWorth(){const l=state.life;return state.profile.buffer+l.portfolioStart+l.ipsStart+l.otpStart+(l.includeHome?l.homeValue-l.mortgage:0)}
function health(){
 const t=totals(),m=mortgageData(),income=Math.max(1,state.profile.netIncome);
 const monthlyExpenses=Math.max(1,t.expenses);
 const bufferMonths=state.profile.buffer/monthlyExpenses;
 const savingsRate=(t.investment+t.otherSaving)/income;
 const annualGross=Math.max(1,state.life.salary);
 const debtRatio=state.life.mortgage/annualGross;
 const paymentBurden=m.current/income;

 const liquidity=Math.round(Math.max(0,Math.min(20,bufferMonths>=6?20:bufferMonths>=3?16:bufferMonths>=1?8+bufferMonths*2.5:bufferMonths*6)));
 const saving=Math.round(Math.max(0,Math.min(20,savingsRate>=.25?20:savingsRate/.25*20)));

 let debt=20;
 if(state.life.mortgage>0){
   debt=20;
   if(debtRatio>5)debt-=8;else if(debtRatio>4)debt-=5;else if(debtRatio>3)debt-=2;
   if(paymentBurden>.40)debt-=7;else if(paymentBurden>.30)debt-=4;else if(paymentBurden>.22)debt-=2;
   if(m.stressRemaining<0)debt-=5;
   debt=Math.max(0,Math.min(20,Math.round(debt)));
 }

 let robustness=0;
 if(state.life.otpRate>0)robustness+=5;
 if(state.life.ipsAnnual>0||state.life.ipsStart>0)robustness+=3;
 if((state.budget.find(x=>x.id==="insurance")?.amount||0)>0)robustness+=4;
 if(t.remaining>=0)robustness+=3;
 robustness=Math.min(20,robustness);

 const final=projections.mid?.at(-1);
 let future=0;
 if(final){
   const realGrowth=final.real-nowNetWorth();
   if(realGrowth>0)future+=8;
   if(state.life.monthlyInvestment>0)future+=5;
   if(state.life.salaryGrowth>state.life.inflation)future+=3;
   if(final.pension>0)future+=4;
 }
 future=Math.min(20,future);

 const score=liquidity+saving+debt+robustness+future;
 const dimensions=[
  {name:"Likviditet",score:liquidity},
  {name:"Sparing",score:saving},
  {name:"Gjeld",score:debt},
  {name:"Robusthet",score:robustness},
  {name:"Fremtid",score:future}
 ];

 const lowest=[...dimensions].sort((a,b)=>a.score-b.score)[0];
 const adviceMap={
  "Likviditet":"Bygg buffer til minst tre måneders løpende utgifter.",
  "Sparing":"Øk sparingen gradvis mot minst 10–15 % av nettoinntekten.",
  "Gjeld":"Reduser gjeldsbelastningen eller øk månedlig margin.",
  "Robusthet":"Styrk buffer, forsikring eller pensjonssparing.",
  "Fremtid":"Sørg for positiv realvekst gjennom jevn investering."
 };

 const issues=dimensions.map(d=>[
  d.score>=15?"good":d.score>=10?"warn":"bad",
  d.name,
  `${d.score} av 20 poeng`
 ]);

 return {score,dimensions,issues,advice:adviceMap[lowest.name],lowest:lowest.name};
}
function healthRowsHtml(h){
 return h.dimensions.map(d=>`<button type="button" class="health-row actionable" data-edit-target="${healthEditTarget(d.name)}" aria-label="Endre grunnlaget for ${escapeHtml(d.name)}"><span>${d.name}</span><span class="progress"><span style="width:${d.score/20*100}%"></span></span><strong>${d.score}/20</strong></button>`).join("");
}
function healthEditTarget(name){return {"Likviditet":"liquidity","Sparing":"investment","Gjeld":"mortgage","Robusthet":"robustness","Fremtid":"futureSettings"}[name]||"budget"}
function healthIssuesHtml(){return health().issues.slice(0,6).map(x=>`<button type="button" class="insight ${x[0]} actionable" data-edit-target="${healthEditTarget(x[1])}"><strong>${x[0]==="good"?"✓":x[0]==="warn"?"!":"⚠"} ${x[1]}</strong><span class="sub">${x[2]}</span></button>`).join("")}
function openHealthInfo(){
 const h=health();
 document.getElementById("healthModalBreakdown").innerHTML=healthRowsHtml(h)+`<div class="health-explain"><strong>Størst forbedringsmulighet:</strong><div class="sub">${h.advice}</div></div><div class="sub" style="margin-top:10px">Referansevisningen bruker én måneds løpende utgifter som en nøytral likviditetsantakelse. Scoren er ikke en offentlig standard.</div>`;
 openModal("healthModal");
}
function openPulseInfo(){openModal("pulseModal")}
function renderEconomicPulse(){
 const element=document.getElementById("economicPulse");if(!element)return;
 const t=totals(),m=mortgageData(),monthlyExpenses=Math.max(1,t.expenses),bufferMonths=state.profile.buffer/monthlyExpenses,savingsRate=t.investment/Math.max(1,state.profile.netIncome);
 const signals=[
  t.remaining>=0?{tone:"good",target:"budget",title:"Kontantstrøm i balanse",text:`${fmtNok(t.remaining)} er igjen etter registrerte poster.`}:{tone:"bad",target:"budget",title:"Negativ kontantstrøm",text:`Budsjettet mangler ${fmtNok(Math.abs(t.remaining))} per måned.`},
  bufferMonths>=3?{tone:"good",target:"liquidity",title:"Solid buffer",text:`Bufferen dekker omtrent ${bufferMonths.toFixed(1)} måneder.`}:bufferMonths>=1?{tone:"warn",target:"liquidity",title:"Buffer under målet",text:`Bufferen dekker omtrent ${bufferMonths.toFixed(1)} måneder.`}:{tone:"bad",target:"liquidity",title:"Lav likviditet",text:"Bufferen dekker mindre enn én måned."},
  state.life.mortgage>0?(m.stressRemaining>=0?{tone:"good",target:"mortgage",title:"Tåler rentestress",text:`Omtrent ${fmtNok(m.stressRemaining)} er igjen ved ${fmtPct(m.stressRate)} rente.`}:{tone:"bad",target:"mortgage",title:"Sårbar for renteøkning",text:`Budsjettet mangler ${fmtNok(Math.abs(m.stressRemaining))} ved ${fmtPct(m.stressRate)} rente.`}):(savingsRate>=.10?{tone:"good",target:"investment",title:"God investeringsgrad",text:`${fmtPct(savingsRate)} av nettoinntekten investeres.`}:{tone:"warn",target:"investment",title:"Moderat investeringsgrad",text:`${fmtPct(savingsRate)} av nettoinntekten investeres.`})
 ];
 element.innerHTML=signals.slice(0,3).map(signal=>`<button type="button" class="pulse-item ${signal.tone} actionable" data-edit-target="${signal.target}"><span class="pulse-label"><span class="pulse-dot"></span>${signal.title}</span><span class="sub">${signal.text}</span></button>`).join("");
}

/* Prioriterte anbefalinger */
function recommendationState(){
 if(!state.ui.recommendationState)state.ui.recommendationState={completed:[],dismissed:[]};
 return state.ui.recommendationState
}
function futureMonthlyImpact(monthlyDelta){
 const years=Math.max(1,state.life.retireAge-state.life.startAge);
 return futureValueMonthly(monthlyDelta,state.life.retMid/100,years)
}
function healthImpactPreview(mutator){
 const before=health().score;
 const snapshot=clone(state);
 try{
   mutator();
   recalc();
   const after=health().score;
   state=snapshot;
   recalc();
   return after-before
 }catch(e){
   state=snapshot;
   recalc();
   return 0
 }
}
function generateRecommendations(){
 const t=totals(),h=health(),m=mortgageData(),income=Math.max(1,state.profile.netIncome);
 const monthlyExpenses=Math.max(1,t.expenses),bufferGap=Math.max(0,state.profile.goalBufferMonths*monthlyExpenses-state.profile.buffer);
 const recs=[];

 if(t.remaining<0){
   const cut=Math.ceil(Math.abs(t.remaining)/100)*100;
   recs.push({
     id:"balance_budget",
     title:`Få budsjettet i balanse med ${fmtNok(cut)}`,
     description:"Negativ kontantstrøm bør løses før sparingen økes.",
     effect:`${fmtNok(cut)} bedre kontantstrøm`,
     healthDelta:Math.max(2,Math.min(8,Math.round(cut/income*20))),
     effort:1,urgency:100,impact:100,
     action:{type:"budget",amount:cut}
   });
 }

 if(bufferGap>0){
   const monthly=Math.max(500,Math.min(Math.max(0,t.remaining),Math.ceil(bufferGap/12/100)*100||500));
   recs.push({
     id:"build_buffer",
     title:`Bygg buffer med ${fmtNok(monthly)} per måned`,
     description:`Du mangler ${fmtNok(bufferGap)} for å nå målet på ${state.profile.goalBufferMonths} måneders utgifter.`,
     effect:`Mål på ca. ${Math.max(1,Math.ceil(bufferGap/monthly))} måneder`,
     healthDelta:Math.max(2,Math.min(8,20-h.dimensions.find(x=>x.name==="Likviditet").score)),
     effort:2,urgency:bufferGap>monthlyExpenses*2?90:70,impact:90,
     action:{type:"buffer",amount:monthly}
   });
 }

 const savingsRate=t.investment/income;
 const targetRate=Math.max(.10,state.profile.goalInvestmentRate/100);
 if(t.remaining>500 && savingsRate<targetRate){
   const increase=Math.max(500,Math.min(Math.floor(t.remaining/500)*500,Math.ceil((targetRate*income-t.investment)/500)*500));
   if(increase>0){
     recs.push({
       id:"increase_investment",
       title:`Øk månedlig investering med ${fmtNok(increase)}`,
       description:"Dette bruker deler av dagens positive kontantstrøm uten å gjøre budsjettet negativt.",
       effect:`+${fmtNok(futureMonthlyImpact(increase))} ved pensjonsalder`,
       healthDelta:Math.max(1,Math.min(6,Math.round(increase/income*30))),
       effort:2,urgency:55,impact:95,
       action:{type:"investment",amount:state.life.monthlyInvestment+increase}
     });
   }
 }

 if(state.life.mortgage>0 && (m.maxRate<.075 || m.stressRemaining<0)){
   const extra=Math.max(500,Math.min(3000,Math.floor(Math.max(0,t.remaining)/500)*500||500));
   recs.push({
     id:"reduce_mortgage_risk",
     title:`Reduser gjeldsrisikoen med ${fmtNok(extra)} ekstra avdrag`,
     description:`Budsjettet går omtrent i null ved ${fmtPct(m.maxRate)} rente.`,
     effect:`Lavere rente- og likviditetsrisiko`,
     healthDelta:Math.max(2,Math.min(6,20-h.dimensions.find(x=>x.name==="Gjeld").score)),
     effort:3,urgency:m.stressRemaining<0?95:65,impact:75,
     action:{type:"mortgage",amount:extra}
   });
 }

 const subscriptions=state.budget.find(x=>x.id==="subscriptions");
 if(subscriptions && subscriptions.amount>Math.max(800,income*.025)){
   const cut=Math.min(500,Math.floor(subscriptions.amount*.2/100)*100);
   recs.push({
     id:"review_subscriptions",
     title:`Reduser abonnement med omtrent ${fmtNok(cut)}`,
     description:"Dette er en gjentakende kostnad som ofte kan reduseres uten stor livsstilsendring.",
     effect:`+${fmtNok(futureMonthlyImpact(cut))} ved pensjonsalder hvis det investeres`,
     healthDelta:1,effort:1,urgency:35,impact:55,
     action:{type:"budgetRow",id:"subscriptions",amount:Math.max(0,subscriptions.amount-cut)}
   });
 }

 const insurance=state.budget.find(x=>x.id==="insurance");
 if(insurance && insurance.amount>income*.06){
   const cut=Math.min(700,Math.floor(insurance.amount*.12/100)*100);
   recs.push({
     id:"review_insurance",
     title:"Sammenlign forsikringene dine",
     description:`Forsikring utgjør ${fmtPct(insurance.amount/income)} av nettoinntekten.`,
     effect:`Mulig reduksjon rundt ${fmtNok(cut)}/mnd`,
     healthDelta:1,effort:2,urgency:30,impact:50,
     action:{type:"budgetRow",id:"insurance",amount:Math.max(0,insurance.amount-cut)}
   });
 }

 if(state.life.otpRate<=0 && state.life.ipsAnnual<=0){
   recs.push({
     id:"pension_review",
     title:"Registrer eller vurder pensjonssparing",
     description:"Pensjonsdelen mangler et tydelig løpende innskudd i modellen.",
     effect:"Mer realistisk fremtidsbilde",
     healthDelta:3,effort:2,urgency:45,impact:65,
     action:{type:"settings"}
   });
 }

 const goals=state.goals||[];
 goals.forEach(g=>{
  const pct=goalProgress(g);
  if(pct<100 && pct>0){
   const forecast=goalForecast(g);
   recs.push({
       id:"goal_"+g.id,
       title:`Prioriter målet «${g.name}»`,
       description:`Du er ${Math.round(pct)} % på vei.`,
     effect:forecast?`Forventet ${forecast.year}`:"Ikke nådd i dagens prognose",
       healthDelta:0,effort:2,urgency:40,impact:60,
       action:{type:"goal",id:g.id}
     });
   }
 });

 const rs=recommendationState();
 return recs
   .filter(r=>!rs.completed.includes(r.id)&&!rs.dismissed.includes(r.id))
   .map(r=>({...r,priority:r.impact*.55+r.urgency*.35-r.effort*5}))
   .sort((a,b)=>b.priority-a.priority);
}
function applyRecommendation(rec){
 if(!rec)return;
 const a=rec.action||{};
 if(a.type==="investment"){
   state.life.monthlyInvestment=a.amount;
   const row=state.budget.find(x=>x.linked);if(row)row.amount=a.amount;
   showPage("decisions");
   document.getElementById("decisionInvestment").value=a.amount;
   document.getElementById("decisionInvestmentRange").value=a.amount;
   renderDecisions();
   toast("Forslaget er lagt inn i simulatoren");
 }else if(a.type==="buffer"){
   showPage("budget");
   const existing=state.budget.find(x=>x.id==="bufferSaving");
   if(existing)existing.amount=a.amount;
   renderBudget();
   toast("Bufferforslaget er lagt inn i budsjettet");
 }else if(a.type==="budgetRow"){
   const row=state.budget.find(x=>x.id===a.id);if(row)row.amount=a.amount;
   showPage("budget");renderBudget();toast("Forslaget er lagt inn i budsjettet");
 }else if(a.type==="mortgage"){
  showPage("decisions");
  const extra=document.getElementById("decisionExtraPrincipal");if(extra)extra.value=a.amount;
  renderDecisions();
  toast("Beløpet er lagt inn for vurdering");
 }else if(a.type==="goal"){
   showPage("goals");
 }else if(a.type==="settings"){
  showPage("settings");
 }else if(a.type==="goals"){
  showPage("goals");
 }else{
   showPage("budget");
 }
 saveState();
 renderAll();
}
let recommendationCache=new Map();
function applyRecommendationById(id){applyRecommendation(recommendationCache.get(id))}
function completeRecommendation(id){
 const rs=recommendationState();
 if(!rs.completed.includes(id))rs.completed.push(id);
 renderRecommendations();saveState();toast("Anbefalingen er markert som fullført");
}
function dismissRecommendation(id){
 const rs=recommendationState();
 if(!rs.dismissed.includes(id))rs.dismissed.push(id);
 renderRecommendations();saveState();toast("Anbefalingen skjules foreløpig");
}
function renderRecommendations(){
 const recs=generateRecommendations();
 const focusCard=document.getElementById("monthlyFocusCard");
 const rs=recommendationState();
 const steadyHidden=rs.completed.includes("steady_plan")||rs.dismissed.includes("steady_plan");
 if(!recs.length&&steadyHidden){
  recommendationCache=new Map();
  if(focusCard)focusCard.style.display="none";
  const secondaryElement=document.getElementById("secondaryRecommendations");
  if(secondaryElement)secondaryElement.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><strong>Ingen nye anbefalinger akkurat nå.</strong><div class="sub">Du kan fortsatt utforske tiltak i Plan og Beslutninger.</div></div>`;
  return;
 }
 const main=recs[0]||{
   id:"steady_plan",title:"Fortsett planen",description:"Økonomien er i balanse. Det viktigste nå er å følge planen over tid.",
   effect:"Stabil fremdrift",healthDelta:0,effort:1,action:{type:"goals"}
 };
 recommendationCache=new Map([main,...recs].map(item=>[item.id,item]));
 if(focusCard)focusCard.style.display="block";
 const title=document.getElementById("focusTitle");
 if(!title)return;
 title.textContent=main.title;
 document.getElementById("focusDescription").textContent=main.description;
 document.getElementById("focusImpact").innerHTML=`
   <div class="focus-impact-item"><span>Forventet effekt</span><strong>${escapeHtml(main.effect)}</strong></div>
   <div class="focus-impact-item"><span>Økonomisk helse</span><strong>${main.healthDelta>0?`+${main.healthDelta} poeng`:"Bevarer nivået"}</strong></div>
   <div class="focus-impact-item"><span>Gjennomføring</span><strong>${main.effort<=1?"Enkel":main.effort===2?"Moderat":"Krever planlegging"}</strong></div>`;
 document.getElementById("focusTryButton").onclick=()=>applyRecommendation(main);
 document.getElementById("focusCompleteButton").onclick=()=>completeRecommendation(main.id);
 document.getElementById("focusDismissButton").onclick=()=>dismissRecommendation(main.id);

 const secondary=recs.slice(1,3);
 document.getElementById("secondaryRecommendations").innerHTML=secondary.length?secondary.map((r,i)=>`
   <div class="recommendation-card">
     <div class="recommendation-rank">${i+2}</div>
     <h3>${escapeHtml(r.title)}</h3>
     <div class="sub">${escapeHtml(r.description)}</div>
     <div class="recommendation-meta"><span>${escapeHtml(r.effect)}</span><span>${r.healthDelta>0?`+${r.healthDelta} helsepoeng`:"Målrettet tiltak"}</span></div>
     <div class="recommendation-actions">
       <button class="primary" data-action="apply-recommendation" data-recommendation-id="${escapeHtml(r.id)}">Prøv</button>
       <button class="secondary" data-action="complete-recommendation" data-recommendation-id="${escapeHtml(r.id)}">Fullført</button>
       <button class="secondary" data-action="dismiss-recommendation" data-recommendation-id="${escapeHtml(r.id)}">Skjul</button>
     </div>
   </div>`).join(""):`<div class="empty-state" style="grid-column:1/-1"><strong>Ingen andre anbefalinger akkurat nå.</strong><div class="sub">Planen ser balansert ut.</div></div>`;
}

function prioritizedActions(){
 const t=totals(),h=health(),actions=[];
 if(t.remaining<0)actions.push(["Få budsjettet i balanse",`Reduser kostnader eller investering med minst ${fmtNok(Math.abs(t.remaining))}.`,fmtNok(Math.abs(t.remaining))+"/mnd","budget"]);
 const bufferGap=state.profile.goalBufferMonths*t.expenses-state.profile.buffer;
 if(bufferGap>0)actions.push(["Bygg buffer",`Prioriter buffer til målet på ${state.profile.goalBufferMonths} måneders utgifter.`,fmtNok(bufferGap),"liquidity"]);
 const subs=state.budget.find(x=>x.id==="subscriptions")?.amount||0;
 if(subs>state.profile.netIncome*.03)actions.push(["Gå gjennom abonnement",`Abonnement utgjør ${fmtPct(subs/state.profile.netIncome)} av inntekten.`,"200–600 kr","subscriptions"]);
 const ins=state.budget.find(x=>x.id==="insurance")?.amount||0;
 if(ins>state.profile.netIncome*.08)actions.push(["Sammenlign forsikring",`Forsikring utgjør ${fmtPct(ins/state.profile.netIncome)} av nettoinntekten.`,"Mulig kutt","insurance"]);
 if(t.remaining>0 && t.investment/state.profile.netIncome<state.profile.goalInvestmentRate/100)actions.push(["Øk investeringen gradvis",`Du har ${fmtNok(t.remaining)} udisponert.`,fmtNok(Math.min(t.remaining,state.profile.netIncome*state.profile.goalInvestmentRate/100-t.investment)),"investment"]);
 if(!actions.length)actions.push(["Automatiser planen","Budsjettet er robust. Automatiser investering og årlige avsetninger.","Bevar planen","investment"]);
 return actions.slice(0,3)
}

const LEGACY_GOAL_NAMES=new Set([
 "1 million investert","5 millioner investert","10 millioner nettoformue","Boliglån under 2 millioner"
]);

function migrateLegacyGoals(){
 if(!Array.isArray(state.goals))state.goals=[];
 const legacyOnly=state.goals.length>0&&state.goals.every(g=>LEGACY_GOAL_NAMES.has(g.name));
 if(legacyOnly)state.goals=[];
}
function referenceGoalSuggestions(){
 const monthlyExpenses=Math.max(1,totals().expenses);
 const annualInvestment=Math.max(0,state.life.monthlyInvestment*12);
 const mortgage=state.life.mortgage||0;
 const suggestions=[
  {id:"suggest_buffer",name:"Buffer på 3 måneders utgifter",metric:"buffer",target:Math.round(monthlyExpenses*3/1000)*1000,icon:"🛡️"},
  {id:"suggest_invest",name:"Invester 100 000 kr",metric:"portfolio",target:100000,icon:"📈"},
  {id:"suggest_rate",name:"Spar 10 % av nettoinntekten",metric:"savingsRate",target:10,icon:"🌱"}
 ];
 if(mortgage>0){
  suggestions.push({id:"suggest_debt",name:"Betal ned 100 000 kr på boliglånet",metric:"debtReduction",target:100000,icon:"🏠"});
 }
 suggestions.push({id:"suggest_pension",name:"Pensjonskapital på 500 000 kr",metric:"pension",target:500000,icon:"🎯"});
 return suggestions;
}
function applySuggestedGoals(){
 const selected=[...document.querySelectorAll('[data-suggest-goal]:checked')].map(x=>x.value);
 const suggestions=referenceGoalSuggestions().filter(x=>selected.includes(x.id));
 state.goals=suggestions.map(x=>({...x,id:"goal_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)}));
 state.ui.goalSuggestionsDismissed=true;
 renderAll();
 toast("Forslagene er lagt til som redigerbare mål");
}
function dismissGoalSuggestions(){
 state.ui.goalSuggestionsDismissed=true;
 renderGoals();
 saveState();
}

function metricCurrent(metric){
 const l=state.life;
 if(metric==="buffer")return state.profile.buffer;
 if(metric==="portfolio")return l.portfolioStart;
 if(metric==="pension")return l.ipsStart+l.otpStart;
 if(metric==="netWorth")return nowNetWorth();
 if(metric==="mortgage")return l.mortgage;
 if(metric==="monthlyInvestment")return l.monthlyInvestment;
 if(metric==="savingsRate")return totals().investment/Math.max(1,state.profile.netIncome)*100;
 if(metric==="debtReduction")return 0;
 return 0
}
function metricFromRow(metric,row){
 if(metric==="portfolio")return row.port;
 if(metric==="pension")return row.pension;
 if(metric==="netWorth")return row.net;
 if(metric==="mortgage")return row.loan;
 if(metric==="monthlyInvestment")return row.monthly;
 if(metric==="savingsRate")return row.monthly/Math.max(1,row.salary/12)*100;
 if(metric==="debtReduction")return Math.max(0,state.life.mortgage-row.loan);
 if(metric==="buffer"){
  const monthly=state.budget.find(item=>item.id==="bufferSaving")?.amount||0;
  return state.profile.buffer+Math.max(0,row.year-state.life.startYear)*12*monthly;
 }
 return 0
}
function goalProgress(goal){
 const current=metricCurrent(goal.metric),target=Math.max(1,Number(goal.target)||1),inverse=goal.metric==="mortgage";
 if(inverse){
   const start=Math.max(target,state.life.mortgage||target);
   return Math.max(0,Math.min(100,(start-current)/Math.max(1,start-target)*100))
 }
 return Math.max(0,Math.min(100,current/target*100))
}
function goalForecast(goal){
 if(goal.metric==="buffer"){
  if(metricCurrent("buffer")>=goal.target)return projections.mid[0];
  const monthlyBuffer=state.budget.find(item=>item.id==="bufferSaving")?.amount||0;
  const illustrativeMonthly=goal.example&&state.ui.referenceMode?Math.max(0,totals().remaining):0;
  const monthly=Math.max(0,monthlyBuffer,illustrativeMonthly);
  if(monthly<=0)return null;
  const months=Math.ceil((goal.target-metricCurrent("buffer"))/monthly);
  return projections.mid[Math.min(projections.mid.length-1,Math.ceil(months/12))]||null;
 }
 return projections.mid.find(row=>goal.metric==="mortgage"?metricFromRow(goal.metric,row)<=goal.target:metricFromRow(goal.metric,row)>=goal.target)
}
function milestones(){
 const hasOwnGoals=state.goals.length>0;
 const source=hasOwnGoals
  ?state.goals
  :referenceGoalSuggestions().filter(goal=>["buffer","portfolio","pension"].includes(goal.metric)).map(goal=>({...goal,example:true}));
 return source.map(goal=>({...goal,pct:goalProgress(goal),row:goalForecast(goal)}))
}
function futureValueMonthly(pmt,rate,years){const rm=Math.pow(1+rate,1/12)-1,n=years*12;return rm?pmt*(Math.pow(1+rm,n)-1)/rm:pmt*n}


function goalMetricLabel(metric){
 return {buffer:"Disponibel buffer",portfolio:"Investeringsportefølje",pension:"Pensjonskapital",netWorth:"Nettoformue",mortgage:"Boliglån under",monthlyInvestment:"Månedlig investering",savingsRate:"Sparerate",debtReduction:"Nedbetaling av gjeld"}[metric]||metric
}

function goalTargetDisplay(goal){
 if(goal.metric==="savingsRate")return `${Number(goal.target).toFixed(0)} %`;
 return fmtNok(goal.target);
}

function renderGoals(){
 migrateLegacyGoals();

 const list=document.getElementById("goalsList");
 const suggestions=document.getElementById("goalSuggestions");
 if(!list||!suggestions)return;

 document.getElementById("goalCountBadge").textContent=`${state.goals.length} mål`;

 if(!state.goals.length&&!state.ui.goalSuggestionsDismissed){
   const sg=referenceGoalSuggestions();
   suggestions.style.display="block";
   suggestions.innerHTML=`
    <div class="empty-state" style="padding:22px">
      <div style="font-size:32px">◎</div>
      <h3>Ingen egne mål ennå</h3>
      <div class="sub">Her er eksempler basert på referansebudsjettet. Velg dem du vil bruke – alt kan redigeres etterpå.</div>
      <div class="suggestion-grid">
        ${sg.map(x=>`<label class="suggestion-card"><input type="checkbox" data-suggest-goal value="${x.id}" checked><strong>${x.icon} ${escapeHtml(x.name)}</strong><div class="sub">${goalMetricLabel(x.metric)} · ${goalTargetDisplay(x)}</div></label>`).join("")}
      </div>
      <div class="small-actions" style="margin-top:14px;justify-content:center">
        <button class="primary" data-action="apply-suggested-goals">Bruk valgte forslag</button>
        <button class="secondary" data-action="open-goal-editor">Lag eget mål</button>
        <button class="secondary" data-action="dismiss-goal-suggestions">Ikke vis forslag</button>
      </div>
    </div>`;
   list.innerHTML="";
 }else{
   suggestions.style.display="none";
   if(!state.goals.length){
     list.innerHTML=`<div class="empty-state"><div style="font-size:34px">◎</div><h3>Ingen mål er satt</h3><div class="sub">Lag et mål som passer livet og prioriteringene dine.</div><button class="primary" style="margin-top:15px" data-action="open-goal-editor">Opprett mål</button></div>`;
   }else{
     list.innerHTML=state.goals.map(g=>{
       const row=goalForecast(g),pct=goalProgress(g);
       const status=row?`Forventet ${row.year} · ${row.age} år`:(pct>=100?"Målet er nådd":"Ikke nådd i dagens prognose");
       return `<div class="goal-card">
        <div class="goal-icon">${g.icon||"🎯"}</div>
        <div><strong>${escapeHtml(g.name)}</strong><div class="sub">${goalMetricLabel(g.metric)} · ${goalTargetDisplay(g)}</div>
          <div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div>
          <div class="sub" style="margin-top:6px">${Math.round(pct)} % · ${status}</div>
        </div>
        <div class="goal-actions"><button class="secondary" data-action="open-goal-editor" data-goal-id="${escapeHtml(g.id)}">Rediger</button><button class="danger" data-action="delete-goal" data-goal-id="${escapeHtml(g.id)}">×</button></div>
       </div>`
     }).join("");
   }
 }

 renderPlanActions();
 renderPlanMilestones();
}
function renderPlanActions(){
 const e=document.getElementById("planActions");if(!e)return;
 e.innerHTML=prioritizedActions().map((a,i)=>`<div class="action actionable" data-edit-target="${a[3]||"budget"}" role="button" tabindex="0" aria-label="Åpne og juster: ${escapeHtml(a[0])}"><div class="step">${i+1}</div><div><strong>${a[0]}</strong><div class="sub">${a[1]} · Klikk for å justere</div></div><div class="good" style="font-weight:850">${a[2]}</div></div>`).join("");
}
function renderPlanMilestones(){
 const e=document.getElementById("planMilestones");if(!e)return;
 const subtitle=document.getElementById("planMilestonesSubtitle");
 if(subtitle)subtitle.textContent=state.goals.length?"De nærmeste målene du faktisk har valgt":"Illustrative eksempler basert på norsk referansehusholdning 2026";
 const ms=milestones().sort((a,b)=>{
   const ay=a.row?.year??9999,by=b.row?.year??9999;
   return ay-by||b.pct-a.pct;
 }).slice(0,5);
 if(!ms.length){
   e.innerHTML=`<div class="empty-state" style="padding:24px"><strong>Ingen mål opprettet.</strong><div class="sub">Lag egne mål eller bruk forslagene over.</div></div>`;
   return;
 }
 e.innerHTML=ms.map(x=>`<div class="milestone"><div class="micon">${escapeHtml(x.icon||"🎯")}</div><div><strong>${escapeHtml(x.name)}${x.example?` <span class="badge">Eksempel</span>`:""}</strong><div class="progress" style="margin-top:7px"><span style="width:${x.pct}%"></span></div><div class="sub" style="margin-top:5px">${x.row?`Forventet ${x.row.year} · ${x.row.age} år`:(x.pct>=100?"Målet er nådd":"Ikke nådd i modellen")}</div></div><span class="badge">${Math.round(x.pct)}%</span></div>`).join("");
}
function openGoalEditor(id=""){
 const g=state.goals.find(x=>x.id===id);
 document.getElementById("goalModalTitle").textContent=g?"Rediger mål":"Nytt mål";
 document.getElementById("goalEditId").value=g?.id||"";
 document.getElementById("goalName").value=g?.name||"";
 document.getElementById("goalMetric").value=g?.metric||"buffer";
 document.getElementById("goalTarget").value=g?.target||"";
 document.getElementById("goalIcon").value=g?.icon||"🎯";
 updateGoalPreview();openModal("goalModal")
}
function updateGoalPreview(){
 const metric=document.getElementById("goalMetric")?.value||"buffer";
 const target=Number(document.getElementById("goalTarget")?.value)||0;
 const current=metricCurrent(metric);
 const text=metric==="mortgage"
   ?`Dagens verdi er ${fmtNok(current)}. Målet nås når lånet er ${fmtNok(target)} eller lavere.`
   :metric==="savingsRate"
   ?`Dagens sparerate er ${current.toFixed(1)} %. Målet er ${target.toFixed(0)} %.`
   :`Dagens verdi er ${fmtNok(current)}. Målbeløpet er ${fmtNok(target)}.`;
 const e=document.getElementById("goalPreview");if(e)e.innerHTML=`<strong>Forhåndsvisning</strong><div class="sub">${text}</div>`
}
function saveGoal(){
 const id=document.getElementById("goalEditId").value;
 const name=document.getElementById("goalName").value.trim();
 const metric=document.getElementById("goalMetric").value;
 const target=Math.max(0,Number(document.getElementById("goalTarget").value)||0);
 const icon=document.getElementById("goalIcon").value;
 if(!name||target<=0){toast("Skriv inn navn og målbeløp");return}
 const goal={id:id||"goal_"+Date.now(),name,metric,target,icon};
 const index=state.goals.findIndex(x=>x.id===id);
 if(index>=0)state.goals[index]=goal;else state.goals.push(goal);
 closeModal("goalModal");renderAll();toast(index>=0?"Målet er oppdatert":"Målet er opprettet")
}
function deleteGoal(id){
 const g=state.goals.find(x=>x.id===id);if(!g||!confirm(`Slette målet «${g.name}»?`))return;
 state.goals=state.goals.filter(x=>x.id!==id);renderAll()
}

/* Isolert rendering: bare aktiv fane oppdateres */
function renderSafely(area,renderer){try{renderer();return true}catch(error){recordRuntimeError(area,error);return false}}
const PAGE_RENDERERS={
 dashboard:()=>{renderDashboard();renderRecommendations()},
 budget:renderBudget,
 future:renderFuture,
 decisions:renderDecisions,
 goals:renderGoals,
 settings:renderSettings
};
const PAGE_LABELS={dashboard:"Dashboard",budget:"Budsjett",future:"Fremtid",decisions:"Beslutninger",goals:"Plan",settings:"Innstillinger"};
function renderPageContent(page=state.ui.page){
 const safePage=VALID_PAGES.has(page)?page:"dashboard";
 renderMetrics[safePage]=(renderMetrics[safePage]||0)+1;
 return renderSafely(PAGE_LABELS[safePage],PAGE_RENDERERS[safePage]);
}
function renderAll(){
 clearRuntimeNotice();
 renderSafely("Beregning",recalc);
 renderPageContent(state.ui.page);
 saveState()
}
function renderDashboard(){
 migrateLegacyGoals();
 renderReferenceMode();
 
 const last=projections.mid.at(-1),h=health(),t=totals(),m=mortgageData(),nw=nowNetWorth();
 document.getElementById("heroFuture").textContent=fmtNok(last.net);
 document.getElementById("heroReal").textContent=fmtNok(last.real)+" i dagens kroner";
 const firstMilestone=milestones()[0];
 document.getElementById("heroProgress").style.width=(firstMilestone?.pct||0)+"%";
 document.getElementById("heroProgressLabel").textContent=state.goals.length?"Fremdrift mot ditt første valgte mål":"Fremdrift mot et illustrativt eksempel-mål";
 document.getElementById("healthScore").textContent=h.score+"/100";document.getElementById("healthProgress").style.width=h.score+"%";
 document.getElementById("healthText").textContent=h.score>=90?"Svært robust":h.score>=75?"God":h.score>=60?"Stabil, med forbedringspunkter":h.score>=40?"Sårbar":"Kritisk";
 document.getElementById("healthBreakdown").innerHTML=healthRowsHtml(h);
 const topAdvice=document.getElementById("topAdvice");
 topAdvice.innerHTML=`<strong>Raskeste vei videre</strong><div class="sub">${h.advice}</div><div class="sub" style="margin-top:5px;color:var(--brand);font-weight:800">Klikk for å justere</div>`;
 topAdvice.classList.add("actionable");topAdvice.dataset.editTarget=healthEditTarget(h.lowest);topAdvice.setAttribute("role","button");topAdvice.tabIndex=0;
 document.getElementById("kpiNetWorth").textContent=fmtNok(nw);document.getElementById("kpiInvestment").textContent=fmtNok(t.investment);
 document.getElementById("kpiCashflow").textContent=fmtNok(t.remaining);document.getElementById("kpiCashflow").className="value "+(t.remaining>=0?"good":"bad");
 document.getElementById("kpiRateTolerance").textContent=fmtPct(m.maxRate);
 drawLineChart("dashboardChart",[{name:"Nettoformue",data:projections.mid.map(x=>x.net),color:"#14b8a6"}],projections.mid.map(x=>x.age));
 const ms=milestones();
 document.getElementById("milestones").innerHTML=ms.map(x=>`<div class="milestone"><div class="micon">${escapeHtml(x.icon||"🎯")}</div><div><strong>${escapeHtml(x.name)}${x.example?` <span class="badge">Eksempel</span>`:""}</strong><div class="progress" style="margin-top:7px"><span style="width:${x.pct}%"></span></div><div class="sub" style="margin-top:5px">${x.row?`Forventet ${x.row.year} · ${x.row.age} år`:(x.pct>=100?"Målet er nådd":"Ikke nådd i modellen")}</div></div><span class="badge">${Math.round(x.pct)}%</span></div>`).join("");
 renderEconomicPulse();
}
function renderBudget(){
 const t=totals();
 document.getElementById("bIncome").textContent=fmtNok(state.profile.netIncome);document.getElementById("bExpenses").textContent=fmtNok(t.expenses);
 document.getElementById("bInvestment").textContent=fmtNok(t.investment);document.getElementById("bRemaining").textContent=fmtNok(t.remaining);
 document.getElementById("bRemaining").className="value "+(t.remaining>=0?"good":"bad");
 setVal("netIncome",state.profile.netIncome);setVal("buffer",state.profile.buffer);setVal("adults",state.profile.adults);setVal("children",state.profile.children);
 setVal("hasCar",state.profile.hasCar?"yes":"no");setVal("ownsHome",state.profile.ownsHome?"yes":"no");
 setVal("annualTravel",state.annual.travel);setVal("annualGifts",state.annual.gifts);setVal("annualHealth",state.annual.health);setVal("annualMaintenance",state.annual.maintenance);
 document.getElementById("annualMonthly").textContent="Månedlig avsetning: "+fmtNok(t.annual);
 renderBudgetTable();drawBudgetChart();renderBudgetComparison();
 document.getElementById("budgetInsights").innerHTML=healthIssuesHtml();renderBudgetMode()
}

function referenceDeltaHtml(row){
 const ref=Number(row.reference2026||0),amount=Number(row.amount||0);
 if(ref===0){
   return `<div class="reference-label">Ingen pålitelig fellesverdi</div>`;
 }
 const diff=amount-ref;
 if(Math.abs(diff)<1)return `<span class="reference-delta same">SSB-nivå</span>`;
 return `<span class="reference-delta ${diff>0?"above":"below"}">${diff>0?"+":"−"}${fmtNok(Math.abs(diff))} mot SSB</span>`;
}
function leaveReferenceMode(){
 if(state.ui.referenceMode){
   state.ui.referenceMode=false;
   const badge=document.getElementById("referenceModeBadge");
   if(badge)badge.textContent="Din økonomiske plan";
 }
}
function renderReferenceMode(){
 const badge=document.getElementById("referenceModeBadge");
 if(!badge)return;
 badge.textContent=state.ui.referenceMode?"Norsk referansehusholdning 2026":"Din økonomiske plan";
}

function budgetSnapshot(name="Budsjett"){
 return {id:"budget_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),name,createdAt:new Date().toISOString(),netIncome:state.profile.netIncome,annual:clone(state.annual),budget:state.budget.map(row=>({id:row.id,name:row.name,amount:row.amount,type:row.type,linked:Boolean(row.linked)}))};
}
function snapshotTotals(snapshot){
 const rows=Array.isArray(snapshot?.budget)?snapshot.budget:[];
 const annualData=snapshot?.annual||{};
 const annual=(finiteNumber(annualData.travel)+finiteNumber(annualData.gifts)+finiteNumber(annualData.health)+finiteNumber(annualData.maintenance))/12;
 const investment=rows.filter(row=>row.linked).reduce((sum,row)=>sum+finiteNumber(row.amount),0);
 const otherSaving=rows.filter(row=>!row.linked&&row.type==="saving").reduce((sum,row)=>sum+finiteNumber(row.amount),0);
 const fixed=rows.filter(row=>row.type==="fixed").reduce((sum,row)=>sum+finiteNumber(row.amount),0);
 const variable=rows.filter(row=>row.type==="variable").reduce((sum,row)=>sum+finiteNumber(row.amount),0);
 const expenses=fixed+variable+annual,total=expenses+investment+otherSaving,income=finiteNumber(snapshot?.netIncome);
 return {income,investment,otherSaving,expenses,total,remaining:income-total};
}
function isBudgetReady(){
 const meaningfulRows=state.budget.filter(row=>!row.linked&&finiteNumber(row.amount)>0).length;
 return !state.ui.referenceMode&&state.profile.netIncome>0&&meaningfulRows>=4;
}
function focusBudgetSetup(){document.getElementById("budgetEntriesCard")?.scrollIntoView({behavior:"smooth",block:"start"})}
function saveCurrentAsTarget(){
 state.budgetTargets.target=budgetSnapshot("Målbudsjett");
 state.ui.compareSource="target";
 renderBudgetComparison();saveState();toast("Dagens budsjett er lagret som målbudsjett");
}
function saveBudgetSnapshot(){
 const input=document.getElementById("snapshotName");
 if(input)input.value="Budsjett "+new Date().toLocaleDateString("nb-NO");
 openModal("compareNameModal");
}
function confirmBudgetSnapshot(){
 const name=document.getElementById("snapshotName")?.value.trim()||"Tidligere budsjett";
 const snapshot=budgetSnapshot(name);
 state.budgetTargets.snapshots.unshift(snapshot);
 state.budgetTargets.snapshots=state.budgetTargets.snapshots.slice(0,12);
 state.ui.compareSource=snapshot.id;
 closeModal("compareNameModal");renderBudgetComparison();saveState();toast("Budsjettversjonen er lagret");
}
function selectedComparison(){
 const selected=document.getElementById("compareSource")?.value||state.ui.compareSource||"target";
 if(selected==="target")return state.budgetTargets.target;
 return state.budgetTargets.snapshots.find(snapshot=>snapshot.id===selected)||null;
}
function renderBudgetComparison(){
 const lock=document.getElementById("budgetComparisonLock"),content=document.getElementById("budgetComparisonContent"),select=document.getElementById("compareSource");
 if(!lock||!content||!select)return;
 const ready=isBudgetReady();
 lock.style.display=ready?"none":"block";content.style.display=ready?"block":"none";
 if(!ready)return;
 const options=[`<option value="target">Målbudsjett</option>`,...state.budgetTargets.snapshots.map(snapshot=>`<option value="${escapeHtml(snapshot.id)}">${escapeHtml(snapshot.name||"Tidligere budsjett")}</option>`)].join("");
 select.innerHTML=options;
 const preferred=state.ui.compareSource||"target";
 select.value=["target",...state.budgetTargets.snapshots.map(item=>item.id)].includes(preferred)?preferred:"target";
 const comparison=selectedComparison();
 const summary=document.getElementById("compareSummary"),rowsElement=document.getElementById("compareRows");
 if(!comparison){
  summary.innerHTML="";
  rowsElement.innerHTML=`<div class="empty-state"><strong>Ingen sammenligning er lagret ennå.</strong><div class="sub">Lagre dagens budsjett som mål eller som en historisk versjon.</div></div>`;
  return;
 }
 const current=budgetSnapshot("Dagens budsjett"),now=snapshotTotals(current),before=snapshotTotals(comparison);
 const stat=(label,currentValue,oldValue,goodWhenHigher=false)=>{const delta=currentValue-oldValue;const tone=Math.abs(delta)<1?"":((delta>0)===goodWhenHigher?"good":"bad");return `<div class="compare-stat"><span class="sub">${label}</span><strong>${fmtNok(currentValue)}</strong><div class="${tone}">${delta===0?"Ingen endring":`${delta>0?"+":"−"}${fmtNok(Math.abs(delta))}`}</div></div>`};
 summary.innerHTML=stat("Netto inntekt",now.income,before.income,true)+stat("Utgifter",now.expenses,before.expenses,false)+stat("Investering",now.investment,before.investment,true)+stat("Til overs",now.remaining,before.remaining,true);
 const oldById=new Map((comparison.budget||[]).map(row=>[row.id,row]));
 rowsElement.innerHTML=current.budget.map(row=>{const old=oldById.get(row.id);if(!old)return"";const delta=finiteNumber(row.amount)-finiteNumber(old.amount);if(Math.abs(delta)<1)return"";return `<div class="compare-row"><strong>${escapeHtml(row.name)}</strong><span class="compare-old">Før ${fmtNok(old.amount)}</span><span>Nå ${fmtNok(row.amount)}</span><strong class="${delta>0?"bad":"good"}">${delta>0?"+":"−"}${fmtNok(Math.abs(delta))}</strong></div>`}).join("")||`<div class="empty-state"><strong>Budsjettene er like.</strong><div class="sub">Endre en post for å se forskjellen.</div></div>`;
}

function accountingRows(){
 const rows=state.budget.map(row=>({id:row.id,name:row.name,amount:finiteNumber(row.amount),type:row.type,linked:Boolean(row.linked)}));
 const annual=annualMonthly();
 if(annual>0)rows.push({id:"annualCosts",name:"Årlige kostnader (månedssnitt)",amount:annual,type:"variable",linked:false});
 return rows;
}
function ensureAccountingRecord(month=state.accounting.activeMonth){
 if(!state.accounting||typeof state.accounting!=="object")state.accounting=normalizeAccounting(null);
 if(!state.accounting.months[month])state.accounting.months[month]={actualIncome:null,rows:{},updatedAt:""};
 return state.accounting.months[month];
}
function accountingMonthLabel(month){
 try{return new Intl.DateTimeFormat("nb-NO",{month:"long",year:"numeric"}).format(new Date(`${month}-15T12:00:00`))}catch{return month}
}
function parseAmountInput(value){
 const normalized=String(value??"").trim().replace(/\s+/g,"").replace(",",".");
 if(normalized==="")return null;
 const number=Number(normalized);
 return Number.isFinite(number)?Math.max(0,number):null;
}
function accountingStats(record=ensureAccountingRecord()){
 const rows=accountingRows();
 const details=rows.map(row=>{
  const raw=record.rows?.[row.id],entered=raw!==null&&raw!==""&&typeof raw!=="undefined";
  const actual=entered?Math.max(0,finiteNumber(raw)):null;
  const diff=entered?actual-row.amount:null;
  const favorable=entered&&(row.type==="saving"?diff>=0:diff<=0);
  return {...row,entered,actual,diff,favorable};
 });
 const entered=details.filter(row=>row.entered),budgetTotal=details.reduce((sum,row)=>sum+row.amount,0);
 const actualTotal=entered.reduce((sum,row)=>sum+row.actual,0),comparableBudget=entered.reduce((sum,row)=>sum+row.amount,0);
 const absoluteDeviation=entered.reduce((sum,row)=>sum+Math.abs(row.diff),0),variance=actualTotal-comparableBudget;
 const accuracy=entered.length&&comparableBudget>0?Math.max(0,Math.min(100,100-absoluteDeviation/comparableBudget*100)):null;
 const completion=details.length?entered.length/details.length*100:0;
 const actualIncome=record.actualIncome===null||record.actualIncome===""||typeof record.actualIncome==="undefined"?null:Math.max(0,finiteNumber(record.actualIncome));
 return {rows:details,enteredCount:entered.length,budgetTotal,actualTotal,comparableBudget,variance,accuracy,completion,actualIncome,actualRemaining:actualIncome===null?null:actualIncome-actualTotal};
}
/* Budsjett og regnskap */
function setBudgetMode(mode){
 state.ui.budgetMode=mode==="accounting"?"accounting":"budget";
 renderBudgetMode();saveState();
}
function renderBudgetMode(){
 const accounting=state.ui.budgetMode==="accounting";
 const planView=document.getElementById("budgetPlanView"),accountingView=document.getElementById("accountingView"),newRow=document.getElementById("newBudgetRowButton");
 if(planView)planView.style.display=accounting?"none":"block";
 if(accountingView)accountingView.style.display=accounting?"block":"none";
 if(newRow)newRow.style.display=accounting?"none":"inline-flex";
 const planButton=document.getElementById("budgetModePlan"),accountingButton=document.getElementById("budgetModeAccounting");
 [planButton,accountingButton].forEach(button=>button?.classList.remove("active"));
 (accounting?accountingButton:planButton)?.classList.add("active");
 if(planButton)planButton.setAttribute("aria-selected",String(!accounting));
 if(accountingButton)accountingButton.setAttribute("aria-selected",String(accounting));
 if(accounting)renderAccounting();
}
function accountingRowPresentation(row){
 const diffText=row.entered?`${row.diff>0?"+":""}${fmtNok(row.diff)}`:"–";
 let status="Ikke ført",tone="neutral";
 if(row.entered&&Math.abs(row.diff)<1){status="På budsjett";tone="neutral"}
 else if(row.entered&&row.type==="saving"){status=row.diff>0?"Mer spart":"Mindre spart";tone=row.favorable?"good":"bad"}
 else if(row.entered){status=row.diff>0?"Over budsjett":"Under budsjett";tone=row.favorable?"good":"bad"}
 return {diffText,status,tone,diffClass:row.entered?(row.favorable?"good":"bad"):""};
}
function renderAccountingSummary(stats){
 const monthInput=document.getElementById("accountingMonth");if(monthInput&&document.activeElement!==monthInput)monthInput.value=state.accounting.activeMonth;
 document.getElementById("accountingMonthTitle").textContent=`Regnskap for ${accountingMonthLabel(state.accounting.activeMonth)}`;
 document.getElementById("accountingBudgetTotal").textContent=fmtNok(stats.budgetTotal);
 document.getElementById("accountingActualTotal").textContent=stats.enteredCount?fmtNok(stats.actualTotal):"–";
 document.getElementById("accountingCompletionText").textContent=stats.enteredCount?`${stats.enteredCount} av ${stats.rows.length} poster ført`:"Ingen poster ført";
 const varianceElement=document.getElementById("accountingVariance");varianceElement.textContent=stats.enteredCount?`${stats.variance>0?"+":""}${fmtNok(stats.variance)}`:"–";varianceElement.className="value "+(!stats.enteredCount?"":stats.variance<=0?"good":"bad");
 document.getElementById("accountingAccuracy").textContent=stats.accuracy===null?"–":`${Math.round(stats.accuracy)} %`;
 document.getElementById("accountingProgressBar").style.width=`${stats.completion}%`;
 document.getElementById("accountingProgressLabel").textContent=`${Math.round(stats.completion)} % ført`;
 document.getElementById("accountingBudgetSum").textContent=fmtNok(stats.budgetTotal);
 document.getElementById("accountingActualSum").textContent=stats.enteredCount?fmtNok(stats.actualTotal):"–";
 document.getElementById("accountingVarianceSum").textContent=stats.enteredCount?`${stats.variance>0?"+":""}${fmtNok(stats.variance)}`:"–";
 const accuracyLabel=stats.accuracy===null?"Før inn faktiske beløp for å beregne treffsikkerhet.":stats.accuracy>=90?"Svært presist budsjett":stats.accuracy>=75?"Godt samsvar med budsjettet":stats.accuracy>=55?"Flere merkbare avvik":"Store avvik fra budsjettet";
 const remainingText=stats.actualIncome===null?"Før faktisk nettoinntekt for å se månedens resultat.":`${stats.actualRemaining>=0?"Igjen denne måneden":"Mangler denne måneden"}: ${fmtNok(Math.abs(stats.actualRemaining))}`;
 document.getElementById("accountingAssessment").innerHTML=`<div class="accounting-deviation"><span><strong>${accuracyLabel}</strong><div class="sub">Treffsikkerhet måles på postene du har ført.</div></span><strong>${stats.accuracy===null?"–":Math.round(stats.accuracy)+" %"}</strong></div><div class="accounting-deviation"><span><strong>Føring</strong><div class="sub">${stats.enteredCount} av ${stats.rows.length} poster er registrert.</div></span><strong>${Math.round(stats.completion)} %</strong></div><div class="accounting-deviation"><span><strong>Månedsresultat</strong><div class="sub">${remainingText}</div></span><strong class="${stats.actualRemaining===null?"":stats.actualRemaining>=0?"good":"bad"}">${stats.actualRemaining===null?"–":fmtNok(stats.actualRemaining)}</strong></div>`;
 const deviations=stats.rows.filter(row=>row.entered&&Math.abs(row.diff)>=1).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,5);
 document.getElementById("accountingLargestDeviations").innerHTML=deviations.length?deviations.map(row=>`<div class="accounting-deviation"><span><strong>${escapeHtml(row.name)}</strong><div class="sub">Budsjett ${fmtNok(row.amount)} · faktisk ${fmtNok(row.actual)}</div></span><strong class="${row.favorable?"good":"bad"}">${row.diff>0?"+":""}${fmtNok(row.diff)}</strong></div>`).join(""):`<div class="empty-state" style="padding:24px"><strong>Ingen avvik å vise ennå.</strong><div class="sub">Før faktiske tall, eller kopier budsjettet som utgangspunkt.</div></div>`;
}
function updateAccountingTableCells(stats){
 const rowsById=new Map(stats.rows.map(row=>[row.id,row]));
 document.querySelectorAll("#accountingBody [data-accounting-entry]").forEach(tableRow=>{
  const row=rowsById.get(tableRow.dataset.accountingEntry);if(!row)return;
  const view=accountingRowPresentation(row),diff=tableRow.querySelector("[data-accounting-diff]"),status=tableRow.querySelector("[data-accounting-status]");
  if(diff){diff.textContent=view.diffText;diff.className=view.diffClass}
  if(status){status.textContent=view.status;status.className=`variance-pill ${view.tone}`}
 });
}
function renderAccounting(){
 const body=document.getElementById("accountingBody");if(!body)return;
 const record=ensureAccountingRecord(),stats=accountingStats(record);
 const incomeInput=document.getElementById("accountingIncome");if(incomeInput)incomeInput.value=record.actualIncome??"";
 body.innerHTML=stats.rows.map(row=>{
  const view=accountingRowPresentation(row);
  return `<tr data-accounting-entry="${escapeHtml(row.id)}"><td><strong>${escapeHtml(row.name)}</strong>${row.type==="saving"?`<div class="sub">Sparing / investering</div>`:""}</td><td>${fmtNok(row.amount)}</td><td><input class="accounting-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="Ikke ført" value="${row.actual??""}" data-accounting-row="${escapeHtml(row.id)}"></td><td data-accounting-diff class="${view.diffClass}">${view.diffText}</td><td><span data-accounting-status class="variance-pill ${view.tone}">${view.status}</span></td></tr>`;
 }).join("");
 renderAccountingSummary(stats);
}
function refreshAccountingLive(){
 const stats=accountingStats();
 updateAccountingTableCells(stats);
 renderAccountingSummary(stats);
}
function updateAccountingRow(id,value){
 leaveReferenceMode();const record=ensureAccountingRecord();record.rows[id]=parseAmountInput(value);record.updatedAt=new Date().toISOString();refreshAccountingLive();saveState();
}
function updateAccountingIncome(value){
 leaveReferenceMode();const record=ensureAccountingRecord();record.actualIncome=parseAmountInput(value);record.updatedAt=new Date().toISOString();refreshAccountingLive();saveState();
}
function copyBudgetToAccounting(){
 const record=ensureAccountingRecord(),hasValues=record.actualIncome!==null||Object.values(record.rows||{}).some(value=>value!==null&&typeof value!=="undefined");
 if(hasValues&&!confirm("Erstatte de førte tallene for denne måneden med budsjettallene?"))return;
 record.actualIncome=state.profile.netIncome;record.rows={};accountingRows().forEach(row=>record.rows[row.id]=row.amount);record.updatedAt=new Date().toISOString();leaveReferenceMode();renderAccounting();saveState();toast("Budsjettallene er kopiert til regnskapet");
}
function clearAccountingMonth(){
 if(!confirm(`Tømme regnskapet for ${accountingMonthLabel(state.accounting.activeMonth)}?`))return;
 state.accounting.months[state.accounting.activeMonth]={actualIncome:null,rows:{},updatedAt:""};renderAccounting();saveState();toast("Måneden er tømt");
}

function renderBudgetTable(){
 const body=document.getElementById("budgetBody"),focus=document.activeElement,focusKey=focus?.dataset?.key,selStart=focus?.selectionStart;
 body.innerHTML=state.budget.map((r,i)=>`<tr class="${r.linked?"row-linked":""}"><td><input data-key="name-${i}" data-budget-index="${i}" data-budget-field="name" value="${escapeHtml(r.name)}" ${r.linked?"readonly":""}></td><td>
  <input data-key="amount-${i}" data-budget-index="${i}" data-budget-field="amount" type="text" inputmode="decimal" value="${r.amount}">
  <div class="reference-cell-${i}">${referenceDeltaHtml(r)}</div>
</td><td class="pct-${i}">${fmtPct(r.amount/Math.max(1,state.profile.netIncome))}</td><td><select data-key="type-${i}" data-budget-index="${i}" data-budget-field="type" ${r.linked?"disabled":""}><option value="fixed" ${r.type==="fixed"?"selected":""}>Fast</option><option value="variable" ${r.type==="variable"?"selected":""}>Variabel</option><option value="saving" ${r.type==="saving"?"selected":""}>Sparing</option></select></td><td>${r.linked?"🔗":`<button class="danger" data-action="remove-budget-row" data-budget-index="${i}">×</button>`}</td></tr>`).join("");
 const t=totals();document.getElementById("budgetSum").textContent=fmtNok(t.total);document.getElementById("budgetPct").textContent=fmtPct(t.total/Math.max(1,state.profile.netIncome));
 if(focusKey){const n=document.querySelector(`[data-key="${focusKey}"]`);if(n){n.focus();if(typeof selStart==="number"&&n.setSelectionRange)try{n.setSelectionRange(selStart,selStart)}catch(e){}}}
}
function updateBudgetField(i,key,value){
 leaveReferenceMode();
 const r=state.budget[i];if(!r)return;const oldAmount=Number(r.amount||0);r[key]=key==="amount"?(parseAmountInput(value)??0):value;
 if(r.linked&&key==="amount"){state.life.monthlyInvestment=r.amount;explainInvestmentChange(oldAmount,r.amount);}
 const pct=document.querySelector(`.pct-${i}`);if(pct)pct.textContent=fmtPct(r.amount/Math.max(1,state.profile.netIncome));
 const referenceCell=document.querySelector(`.reference-cell-${i}`);if(referenceCell)referenceCell.innerHTML=referenceDeltaHtml(r);
 const t=totals();document.getElementById("budgetSum").textContent=fmtNok(t.total);document.getElementById("budgetPct").textContent=fmtPct(t.total/Math.max(1,state.profile.netIncome));
 renderAllExceptTable();saveState()
}
function renderAllExceptTable(){
 recalc();
 const t=totals();
 document.getElementById("bIncome").textContent=fmtNok(state.profile.netIncome);
 document.getElementById("bExpenses").textContent=fmtNok(t.expenses);
 document.getElementById("bInvestment").textContent=fmtNok(t.investment);
 document.getElementById("bRemaining").textContent=fmtNok(t.remaining);
 document.getElementById("bRemaining").className="value "+(t.remaining>=0?"good":"bad");
 document.getElementById("budgetInsights").innerHTML=healthIssuesHtml();
 renderSafely("Budsjettgraf",drawBudgetChart);
 renderSafely("Budsjettsammenligning",renderBudgetComparison);
 saveState();
}
function addBudgetRow(){state.budget.splice(Math.max(0,state.budget.length-1),0,{id:"custom"+Date.now(),name:"Ny post",amount:0,type:"variable"});renderBudget();saveState()}
function removeBudgetRow(i){if(state.budget[i]?.linked)return;state.budget.splice(i,1);renderAll()}
function addRecommendedZeroRows(){
 const rec=[["health","Helse og tannlege"],["clothing","Klær og sko"],["travel","Ferie og reise"],["gifts","Gaver og høytider"],["homeMaintenance","Boligvedlikehold og innbo"],["vehicle","Bilhold og vedlikehold"],["bufferSaving","Buffersparing"],["education","Kompetanse og kurs"],["electronics","Elektronikk"]];
 rec.forEach(([id,name])=>{if(!state.budget.some(x=>x.id===id))state.budget.splice(Math.max(0,state.budget.length-1),0,{id,name,amount:0,type:id==="bufferSaving"?"saving":"variable"})});
 renderAll();toast("Anbefalte poster er lagt til")
}
function drawBudgetChart(){
 const t=totals(),data=[["Faste",t.fixed,"#15803d"],["Variable",t.variable,"#dc2626"],["Årlige",t.annual,"#d97706"],["Investering",t.investment,"#2563eb"],["Til overs",Math.max(0,t.remaining),"#14b8a6"]].filter(x=>x[1]>0);
 drawDonut("budgetChart",data,state.profile.netIncome);
 document.getElementById("budgetLegend").innerHTML=data.map(x=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${x[2]};margin-right:7px"></span>${x[0]}</span><strong>${fmtNok(x[1])}</strong></div>`).join("")
}
function renderFuture(){
 if(!projections.mid||!projections.low||!projections.high)recalc();
 const referenceBanner=document.getElementById("futureReferenceBanner");
 if(referenceBanner){
  referenceBanner.innerHTML=state.ui.referenceMode
   ?`<strong>Norsk referansehusholdning 2026</strong><span>Grafen, tidslinjen og tabellen bruker de samme referanseverdiene som resten av verktøyet. Milepælene er illustrative eksempler til du lager egne mål i Plan.</span>`
   :`<strong>Din økonomiske plan</strong><span>Grafen, tidslinjen og tabellen er beregnet fra verdiene og målene du har registrert.</span>`;
 }
 const mode=document.getElementById("futureMode")?.value||"nominal",labels=projections.mid.map(x=>x.age),series=[];
 if(mode==="nominal"){series.push({name:"Konservativ",data:projections.low.map(x=>x.net),color:"#94a3b8"},{name:"Forventet",data:projections.mid.map(x=>x.net),color:"#14b8a6"},{name:"Sterk",data:projections.high.map(x=>x.net),color:"#2563eb"})}
 else if(mode==="real"){series.push({name:"Konservativ",data:projections.low.map(x=>x.real),color:"#94a3b8"},{name:"Forventet",data:projections.mid.map(x=>x.real),color:"#14b8a6"},{name:"Sterk",data:projections.high.map(x=>x.real),color:"#2563eb"})}
 else{series.push({name:"Portefølje",data:projections.mid.map(x=>x.port),color:"#14b8a6"},{name:"Pensjon",data:projections.mid.map(x=>x.pension),color:"#8b5cf6"},{name:"Boligkapital",data:projections.mid.map(x=>x.equity),color:"#d97706"})}
 drawLineChart("futureChart",series,labels);
 const timelineGoals=milestones();
 document.getElementById("timeline").innerHTML=timelineGoals.map(x=>`<div class="time-card"><div style="font-size:22px">${escapeHtml(x.icon||"🎯")}</div><strong>${escapeHtml(x.name)}</strong>${x.example?`<div class="badge" style="margin-top:8px">Illustrativt eksempel</div>`:""}<div class="big" style="font-size:28px;margin-top:14px">${x.row?x.row.year:"–"}</div><div class="sub">${x.row?`${x.row.age} år${x.example&&x.metric==="buffer"?" · hvis overskuddet brukes til buffer":""}`:(x.pct>=100?"Nådd":"Ikke nådd i modellen")}</div></div>`).join("");
 const interval=Math.max(1,Number(document.getElementById("forecastInterval")?.value||1));
 const visibleRows=projections.mid.filter((r,i)=>i===0||i===projections.mid.length-1||i%interval===0);
 document.getElementById("forecastBody").innerHTML=visibleRows.map(r=>`<tr class="${r.age%5===0?'forecast-milestone':''}"><td>${r.year} / ${r.age}</td><td>${fmtNok(r.salary)}</td><td>${fmtNok(r.monthly)}</td><td>${fmtNok(r.port)}</td><td>${fmtNok(r.pension)}</td><td>${fmtNok(r.equity)}</td><td class="forecast-net">${fmtNok(r.net)}</td><td class="forecast-real">${fmtNok(r.real)}</td></tr>`).join("")
}
function renderDecisions(){
 if(!projections.mid)recalc();
 const l=state.life,last=projections.mid.at(-1),years=l.retireAge-l.startAge;
 setVal("decisionInvestment",getVal("decisionInvestment",l.monthlyInvestment));setVal("decisionInvestmentRange",getVal("decisionInvestment",l.monthlyInvestment));
 setVal("decisionHomeValue",getVal("decisionHomeValue",l.homeValue));setVal("decisionMortgage",getVal("decisionMortgage",l.mortgage));
 const alt=Number(document.getElementById("decisionInvestment").value)||0,diff=alt-l.monthlyInvestment,fv=futureValueMonthly(diff,l.retMid/100,years);
 document.getElementById("decisionInvestmentResult").textContent=(fv>=0?"+":"")+fmtNok(fv);
 document.getElementById("decisionInvestmentResult").className="decision-result "+(fv>=0?"good":"bad");
 document.getElementById("decisionInvestmentTime").textContent=Math.abs(diff)<1?"Samme som planen":`${diff>0?"Høyere":"Lavere"} investering enn planen`;
 const purchase=Number(document.getElementById("decisionPurchase").value)||0;document.getElementById("decisionPurchaseResult").textContent="−"+fmtNok(purchase*Math.pow(1+l.retMid/100,years));
 const newHome=Number(document.getElementById("decisionHomeValue").value)||l.homeValue,newLoan=Number(document.getElementById("decisionMortgage").value)||l.mortgage;
 const homeDiff=(newHome-newLoan)-(l.homeValue-l.mortgage);document.getElementById("decisionHomeResult").textContent=(homeDiff>=0?"+":"")+fmtNok(homeDiff);
 const extra=Math.max(0,Number(document.getElementById("decisionExtraPrincipal")?.value)||0),loanSimulation=simulateLoan(extra),result=document.getElementById("decisionPrincipalResult");
 if(result)result.textContent=l.mortgage<=0?"Legg inn boliglån i Innstillinger for å teste ekstra avdrag.":extra<=0?"Legg inn et beløp for å se mulig tids- og rentebesparelse.":`Kan forkorte lånet med ca. ${Math.floor(loanSimulation.monthsSaved/12)} år og ${loanSimulation.monthsSaved%12} måneder, og spare omtrent ${fmtNok(loanSimulation.interestSaved)} i renter.`;
 renderRatePanels()
}
function renderRatePanels(){
 const m=mortgageData(),html=`<div class="grid3"><div><div class="eyebrow">Termin nå</div><strong>${fmtNok(m.current)}</strong></div><div><div class="eyebrow">Ved ${fmtPct(m.stressRate)}</div><strong>${fmtNok(m.stress)}</strong></div><div><div class="eyebrow">Igjen</div><strong class="${m.stressRemaining>=0?"good":"bad"}">${fmtNok(m.stressRemaining)}</strong></div></div><div style="margin-top:14px"><strong>Budsjettet går omtrent i null ved ${fmtPct(m.maxRate)} rente</strong><div class="progress" style="margin-top:8px"><span style="width:${Math.min(100,m.maxRate/.15*100)}%"></span></div></div>`;
 document.getElementById("decisionRatePanel").innerHTML=html;document.getElementById("settingsRatePanel").innerHTML=html
}
function renderSettings(){
 const ids=["startAge","retireAge","startYear","salary","salaryGrowth","raiseShare","bonus","ipsAnnual","otpRate","portfolioStart","ipsStart","otpStart","homeValue","mortgage","homeGrowth","annualPrincipal","mortgageRate","loanYears","loanType","inflation","retLow","retMid","retHigh"];
 ids.forEach(id=>setVal(id,state.life[id]));
 setVal("includeHome",state.life.includeHome?"yes":"no");setVal("goalBufferMonths",state.profile.goalBufferMonths);setVal("goalInvestmentRate",state.profile.goalInvestmentRate);
 setVal("budgetMortgagePayment",(state.budget.find(x=>x.id==="mortgage")||state.budget.find(x=>x.id==="housing"))?.amount||0);renderRatePanels()
}
function setVal(id,v){const e=document.getElementById(id);if(e&&document.activeElement!==e)e.value=v}
function getVal(id,fallback){const e=document.getElementById(id);return e&&e.value!==""?Number(e.value):fallback}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

/* Navigasjon, redigering og veiviser */
function editDestination(target){
 const investmentIndex=state.budget.findIndex(row=>row.linked);
 const subscriptionIndex=state.budget.findIndex(row=>row.id==="subscriptions");
 const insuranceIndex=state.budget.findIndex(row=>row.id==="insurance");
 return {
  future:{page:"future",selector:"#futureMode",message:"Her ser du hvordan forutsetningene påvirker fremtiden."},
  goals:{page:"goals",selector:"#goalsOverview",message:"Her kan du opprette eller endre målene dine."},
  budget:{page:"budget",selector:"#budgetEntriesCard",message:"Her kan du endre inntekter og budsjettposter."},
  liquidity:{page:"budget",selector:"#buffer",message:"Endre disponibel buffer her."},
  investment:{page:"budget",selector:investmentIndex>=0?`[data-key="amount-${investmentIndex}"]`:"#budgetEntriesCard",message:"Endre månedlig investering i budsjettet."},
  subscriptions:{page:"budget",selector:subscriptionIndex>=0?`[data-key="amount-${subscriptionIndex}"]`:"#budgetEntriesCard",message:"Gå gjennom abonnement og kommunikasjon her."},
  insurance:{page:"budget",selector:insuranceIndex>=0?`[data-key="amount-${insuranceIndex}"]`:"#budgetEntriesCard",message:"Sammenlign og juster forsikringskostnader her."},
  networth:{page:"settings",selector:"#portfolioStart",message:"Endre portefølje, pensjon, bolig og gjeld her."},
  mortgage:{page:"settings",selector:"#mortgageRate",message:"Endre boliglån, rente og løpetid her."},
  robustness:{page:"budget",selector:"#buffer",message:"Styrk robustheten gjennom buffer og relevante budsjettposter. Pensjon endres i Innstillinger."},
  futureSettings:{page:"settings",selector:"#retMid",message:"Endre sparing, pensjon og fremtidsforutsetninger her."}
 }[target]||{page:"budget",selector:"#budgetEntriesCard",message:"Juster grunnlaget her."};
}
function navigateToEdit(target){
 closeModal("healthModal");closeModal("pulseModal");
 const destination=editDestination(target);
 if(destination.page==="budget")state.ui.budgetMode="budget";
 showPage(destination.page);
 setTimeout(()=>{
  const element=document.querySelector(destination.selector);
  if(!element)return;
  element.scrollIntoView({behavior:"smooth",block:"center"});
  element.classList.add("edit-highlight");
  if(typeof element.focus==="function")element.focus({preventScroll:true});
  setTimeout(()=>element.classList.remove("edit-highlight"),2800);
  toast(destination.message);
 },120);
}



const appGuideSteps=[
 {page:"dashboard",target:"dashboardFutureCard",label:"Oversikt",title:"Fremtidsverdien først",text:"Dette kortet viser forventet nettoformue ved pensjon og fremdrift mot ditt første mål."},
 {page:"budget",target:"budgetEntriesCard",label:"Budsjett",title:"Bygg budsjettet først",text:"Registrer inntekt og kostnader. Sammenligningene åpnes når grunnlaget er godt nok."},
 {page:"future",target:"forecastSection",label:"Fremtid",title:"Følg utviklingen over tid",text:"Se nøkkelår som kort, eller åpne detaljtabellen når du trenger mer."},
 {page:"decisions",target:"decisionInvestmentCard",label:"Beslutninger",title:"Test før du endrer planen",text:"Prøv et alternativ og se konsekvensen uten å endre grunnplanen."},
 {page:"goals",target:"goalsOverview",label:"Plan",title:"Velg dine egne mål",text:"Her setter du mål, ser milepæler og får konkrete tiltak."},
 {page:"settings",target:"settingsIncomeCard",label:"Innstillinger",title:"Juster forutsetningene",text:"Her endrer du alder, lønn, sparing og pensjonsforutsetninger."}
];
const goalCoachSteps=[
 {page:"goals",target:"goalsHeader",label:"Mål",title:"Målene er dine",text:"Velg selv hva du vil oppnå. Appen bruker ikke standardmål på mange millioner."},
 {page:"goals",target:"goalsOverview",label:"Fremdrift",title:"Se fremdriften samlet",text:"Målene vises her, på dashboardet og i fremtidstidslinjen."},
 {page:"goals",target:"goalsInfoButton",label:"Hjelp",title:"Åpne hjelpen igjen",text:"Info-knappen starter denne forklaringen på nytt."},
 {page:"goals",target:"goalsPrinciples",label:"Endringer",title:"Mål kan justeres",text:"Endre målene når livet eller prioriteringene dine endrer seg."}
];

let activeGuideSteps=[];
let coachIndex=0;
let guideRunning=false;
let guideRenderToken=0;

function activatePageWithoutGuide(id){
 const page=VALID_PAGES.has(id)?id:"dashboard";
 state.ui.page=page;

 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===page));
 document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 renderAll();
}

function askAppGuide(){
 if(confirm("Vil du åpne introduksjonen til hele verktøyet?"))startAppGuide();
}
function askGoalsGuide(){
 if(confirm("Vil du åpne forklaringen for Plan på nytt?"))startGoalsGuide();
}
function startAppGuide(){startGuide(appGuideSteps);}
function startGoalsGuide(){startGuide(goalCoachSteps);}
function startGuide(steps){
 activeGuideSteps=steps;
 coachIndex=0;
 guideRunning=true;
 document.getElementById("coachOverlay").classList.add("open");
 renderCoachStep();
}
function nextCoachStep(){
 if(!guideRunning)return;
 if(coachIndex>=activeGuideSteps.length-1){closeActiveGuide();return;}
 coachIndex++;
 renderCoachStep();
}
function previousCoachStep(){
 if(!guideRunning||coachIndex<=0)return;
 coachIndex--;
 renderCoachStep();
}
function clearGuideHighlight(){
 document.querySelectorAll(".guide-highlight").forEach(el=>{el.classList.remove("guide-highlight");el.style.pointerEvents="";});
}
function closeActiveGuide(){
 guideRenderToken++;
 clearGuideHighlight();
 document.getElementById("coachOverlay").classList.remove("open");
 guideRunning=false;
 if(activeGuideSteps===appGuideSteps)state.ui.appGuideSeen=true;
 if(activeGuideSteps===goalCoachSteps)state.ui.goalsGuideSeen=true;
 saveState();
}
function closeGoalsGuide(){closeActiveGuide();}

function renderCoachStep(){
 const step=activeGuideSteps[coachIndex];
 if(!step)return;
 const token=++guideRenderToken;

 clearGuideHighlight();
 activatePageWithoutGuide(step.page);

 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(token!==guideRenderToken||!guideRunning)return;
   const target=document.getElementById(step.target);
   if(target)target.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});

   setTimeout(()=>{
    if(token!==guideRenderToken||!guideRunning)return;
    clearGuideHighlight();
    if(target)target.classList.add("guide-highlight");

     document.getElementById("coachEyebrow").textContent=`${step.label} · ${coachIndex+1} av ${activeGuideSteps.length}`;
     document.getElementById("coachTitle").textContent=step.title;
     document.getElementById("coachText").textContent=step.text;
     document.getElementById("coachDots").innerHTML=activeGuideSteps.map((_,i)=>`<span class="coach-dot ${i===coachIndex?"active":""}"></span>`).join("");
     document.getElementById("coachNext").textContent=coachIndex===activeGuideSteps.length-1?"Ferdig":"Neste";
     document.getElementById("coachBack").classList.toggle("visible",coachIndex>0);
   },260);
 }));
}

function showPage(id){
 if(guideRunning)closeActiveGuide();
 activatePageWithoutGuide(id);
}
function on(id,event,handler){document.getElementById(id)?.addEventListener(event,handler)}
/* Sentral hendelsesflyt */
function handleAction(control){
 const action=control.dataset.action;
 switch(action){
  case "toggle-theme":toggleTheme();break;
  case "app-guide":askAppGuide();break;
  case "open-modal":openModal(control.dataset.modalId);break;
  case "close-modal":closeModal(control.dataset.modalId);break;
  case "health-info":openHealthInfo();break;
  case "pulse-info":openPulseInfo();break;
  case "add-budget-row":addBudgetRow();break;
  case "budget-mode":setBudgetMode(control.dataset.mode);break;
  case "add-recommended-rows":addRecommendedZeroRows();break;
  case "focus-budget-setup":focusBudgetSetup();break;
  case "save-target-budget":saveCurrentAsTarget();break;
  case "save-budget-snapshot":saveBudgetSnapshot();break;
  case "confirm-budget-snapshot":confirmBudgetSnapshot();break;
  case "copy-budget-accounting":copyBudgetToAccounting();break;
  case "clear-accounting-month":clearAccountingMonth();break;
  case "goals-guide":askGoalsGuide();break;
  case "open-goal-editor":openGoalEditor(control.dataset.goalId||"");break;
  case "delete-goal":deleteGoal(control.dataset.goalId);break;
  case "apply-suggested-goals":applySuggestedGoals();break;
  case "dismiss-goal-suggestions":dismissGoalSuggestions();break;
  case "apply-recommendation":applyRecommendationById(control.dataset.recommendationId);break;
  case "complete-recommendation":completeRecommendation(control.dataset.recommendationId);break;
  case "dismiss-recommendation":dismissRecommendation(control.dataset.recommendationId);break;
  case "remove-budget-row":removeBudgetRow(Number(control.dataset.budgetIndex));break;
  case "export-data":exportData();break;
  case "reset-all":resetAll();break;
  case "save-goal":saveGoal();break;
  case "guide-previous":previousCoachStep();break;
  case "guide-close":closeActiveGuide();break;
  case "guide-next":nextCoachStep();break;
  case "complete-onboarding":completeOnboarding();break;
  case "explore-onboarding":closeOnboardingAndGuide();break;
 }
}
function bindInputs(){
 document.addEventListener("input",event=>{
  if(event.target.matches?.("[data-accounting-row]"))updateAccountingRow(event.target.dataset.accountingRow,event.target.value);
  else if(event.target.matches?.("[data-accounting-income]"))updateAccountingIncome(event.target.value);
  else if(event.target.matches?.("[data-budget-field]")&&event.target.tagName!=="SELECT")updateBudgetField(Number(event.target.dataset.budgetIndex),event.target.dataset.budgetField,event.target.value);
 });
 document.addEventListener("change",event=>{
  if(event.target.matches?.("select[data-budget-field]"))updateBudgetField(Number(event.target.dataset.budgetIndex),event.target.dataset.budgetField,event.target.value);
 });
 document.addEventListener("click",event=>{
  const actionControl=event.target.closest?.("[data-action]");
  if(!actionControl)return;
  event.preventDefault();
  handleAction(actionControl);
 });
 document.addEventListener("click",event=>{
  const navButton=event.target.closest?.("[data-page]");
  if(!navButton)return;
  event.preventDefault();
  showPage(navButton.dataset.page);
 });
 document.addEventListener("click",event=>{
  const actionable=event.target.closest?.("[data-edit-target]");
  if(!actionable)return;
  const nestedControl=event.target.closest?.("a,input,select,textarea");
  if(nestedControl&&nestedControl!==actionable)return;
  navigateToEdit(actionable.dataset.editTarget);
 });
 document.addEventListener("keydown",event=>{
  const actionable=event.target.closest?.("[data-edit-target]");
  if(!actionable||actionable.tagName==="BUTTON"||!["Enter"," "].includes(event.key))return;
  event.preventDefault();navigateToEdit(actionable.dataset.editTarget);
 });
 document.querySelectorAll("input,select").forEach(el=>{
  if(!["compareSource","futureMode","forecastInterval","accountingMonth","onboardIncome","onboardInvestment","onboardAge","onboardRetire"].includes(el.id)){
   el.addEventListener("input",leaveReferenceMode);
   el.addEventListener("change",leaveReferenceMode);
  }
 });
 const lifeIds=["startAge","retireAge","startYear","salary","salaryGrowth","raiseShare","bonus","ipsAnnual","otpRate","portfolioStart","ipsStart","otpStart","homeValue","mortgage","homeGrowth","annualPrincipal","mortgageRate","loanYears","loanType","inflation","retLow","retMid","retHigh"];
 lifeIds.forEach(id=>on(id,"input",event=>{state.life[id]=event.target.type==="number"?finiteNumber(event.target.value):event.target.value;state.life.retireAge=Math.max(state.life.startAge+1,state.life.retireAge);renderAll()}));
 on("includeHome","change",event=>{state.life.includeHome=event.target.value==="yes";renderAll()});
 [["netIncome","netIncome"],["buffer","buffer"],["adults","adults"],["children","children"]].forEach(([id,key])=>on(id,"input",event=>{state.profile[key]=Math.max(0,finiteNumber(event.target.value));renderAll()}));
 on("hasCar","change",event=>{state.profile.hasCar=event.target.value==="yes";renderAll()});
 on("ownsHome","change",event=>{state.profile.ownsHome=event.target.value==="yes";renderAll()});
 [["annualTravel","travel"],["annualGifts","gifts"],["annualHealth","health"],["annualMaintenance","maintenance"]].forEach(([id,key])=>on(id,"input",event=>{state.annual[key]=Math.max(0,finiteNumber(event.target.value));renderAll()}));
 on("goalBufferMonths","input",event=>{state.profile.goalBufferMonths=Math.max(0,finiteNumber(event.target.value));renderAll()});
 on("goalInvestmentRate","input",event=>{state.profile.goalInvestmentRate=Math.max(0,finiteNumber(event.target.value));renderAll()});
 on("budgetMortgagePayment","input",event=>{const row=state.budget.find(item=>item.id==="mortgage")||state.budget.find(item=>item.id==="housing");if(row)row.amount=Math.max(0,finiteNumber(event.target.value));renderAll()});
 on("futureMode","change",()=>renderSafely("Fremtid",renderFuture));
 on("forecastInterval","change",()=>renderSafely("Fremtid",renderFuture));
 on("compareSource","change",event=>{state.ui.compareSource=event.target.value;renderBudgetComparison();saveState()});
 on("accountingMonth","change",event=>{if(!/^\d{4}-\d{2}$/.test(event.target.value))return;state.accounting.activeMonth=event.target.value;ensureAccountingRecord();renderAccounting();saveState()});
 on("goalMetric","change",updateGoalPreview);
 on("goalTarget","input",updateGoalPreview);
 on("decisionInvestment","input",event=>{const range=document.getElementById("decisionInvestmentRange");if(range)range.value=event.target.value;renderSafely("Beslutninger",renderDecisions)});
 on("decisionInvestmentRange","input",event=>{const input=document.getElementById("decisionInvestment");if(input)input.value=event.target.value;renderSafely("Beslutninger",renderDecisions)});
 ["decisionPurchase","decisionHomeValue","decisionMortgage","decisionExtraPrincipal"].forEach(id=>on(id,"input",()=>renderSafely("Beslutninger",renderDecisions)));
 on("importFile","change",importData)
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="okonomisk-fremtid-backup.json";a.click();URL.revokeObjectURL(a.href)}
async function importData(event){try{const file=event.target.files?.[0];if(!file)return;state=normalizeState(JSON.parse(await file.text()));renderAll();showPage(state.ui.page);toast("Data importert")}catch(error){recordRuntimeError("Import",error);toast("Import feilet")}}
function resetAll(){if(confirm("Tilbakestille alle data?")){state=clone(defaultState);localStorage.removeItem(STORAGE);localStorage.removeItem(LEGACY_STORAGE);renderAll();showPage("dashboard");toast("Tilbakestilt")}}

function drawLineChart(id,series,labels){
 const c=document.getElementById(id);if(!c)return;const rect=c.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(300,rect.width),h=Math.max(240,rect.height);c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
 const pad={l:72,r:20,t:38,b:48},vals=series.flatMap(s=>s.data),max=Math.max(...vals,1)*1.06,X=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,labels.length-1),Y=v=>h-pad.b-v/max*(h-pad.t-pad.b);
 x.font="12px system-ui";x.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line");x.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");
 for(let j=0;j<=5;j++){const v=max*j/5,y=Y(v);x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.textAlign="right";x.fillText(v>=1e6?(v/1e6).toFixed(v>=1e7?0:1)+"m":Math.round(v),pad.l-8,y+4)}
 for(let t=0;t<Math.min(7,labels.length);t++){const i=Math.round(t*(labels.length-1)/(Math.min(7,labels.length)-1));x.textAlign="center";x.fillText(labels[i],X(i),h-20)}
 series.forEach((s,k)=>{x.strokeStyle=s.color;x.lineWidth=3;x.beginPath();s.data.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v)));x.stroke();x.fillStyle=s.color;x.fillRect(pad.l+k*150,14,18,4);x.fillStyle=getComputedStyle(document.body).getPropertyValue("--text");x.textAlign="left";x.fillText(s.name,pad.l+24+k*150,18)})
}
function drawDonut(id,data,total){
 const c=document.getElementById(id);if(!c)return;const rect=c.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(300,rect.width),h=Math.max(260,rect.height);c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
 const cx=w/2,cy=h/2,r=Math.min(w,h)*.34,inner=r*.58,sum=data.reduce((s,a)=>s+a[1],0)||1;let a=-Math.PI/2;
 data.forEach(d=>{const b=a+Math.PI*2*d[1]/sum;x.beginPath();x.arc(cx,cy,r,a,b);x.arc(cx,cy,inner,b,a,true);x.closePath();x.fillStyle=d[2];x.fill();a=b});
 x.textAlign="center";x.fillStyle=getComputedStyle(document.body).getPropertyValue("--text");x.font="900 24px system-ui";x.fillText(fmtNok(total),cx,cy);x.font="12px system-ui";x.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");x.fillText("Netto inntekt",cx,cy+23)
}

function registerServiceWorker(){
 if(!("serviceWorker" in navigator))return;
 navigator.serviceWorker.register("sw.js").then(registration=>registration.update()).catch(error=>console.warn("Service worker kunne ikke registreres",error));
}
/* Oppstart */
function bootstrap(){
 applyTheme();
 bindInputs();
 activatePageWithoutGuide(state.ui.page||"dashboard");
 if(!state.ui.onboarded)setTimeout(()=>openModal("onboardingModal"),250);
 else if(!state.ui.appGuideSeen)setTimeout(startAppGuide,350);
 let resizeTimer;
 window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderPageContent(state.ui.page),120)});
 window.addEventListener("error",event=>recordRuntimeError("Uventet feil",event.error||event.message));
 window.addEventListener("unhandledrejection",event=>recordRuntimeError("Uventet feil",event.reason));
 window.__appTest={
  version:SCHEMA_VERSION,
  pages:[...VALID_PAGES],
  getState:()=>clone(state),
  getErrors:()=>clone(window.__runtimeErrors),
  getRenderMetrics:()=>clone(renderMetrics),
  activePage:()=>document.querySelector(".page.active")?.id||null,
  normalizeState:input=>clone(normalizeState(input)),
  accounting:()=>clone(accountingStats()),
  recommendations:()=>clone(generateRecommendations()),
  renderCurrent:renderAll
 };
 registerServiceWorker();
}
try{bootstrap()}catch(error){recordRuntimeError("Oppstart",error)}
})();
