(()=>{
"use strict";

function createFinanceEngine({getState,getProjections}){
 const state=()=>getState();
 function annualMonthly(){const s=state();return (s.annual.travel+s.annual.gifts+s.annual.health+s.annual.maintenance)/12}
 function totals(){
  const s=state(),investment=s.budget.filter(item=>item.linked).reduce((sum,item)=>sum+item.amount,0);
  const otherSaving=s.budget.filter(item=>!item.linked&&item.type==="saving").reduce((sum,item)=>sum+item.amount,0);
  const fixed=s.budget.filter(item=>item.type==="fixed").reduce((sum,item)=>sum+item.amount,0);
  const variable=s.budget.filter(item=>item.type==="variable").reduce((sum,item)=>sum+item.amount,0);
  const annual=annualMonthly(),expenses=fixed+variable+annual,total=expenses+investment+otherSaving;
  return {investment,otherSaving,fixed,variable,annual,expenses,total,remaining:s.profile.netIncome-total};
 }
 function mortgagePayment(balance,annualRate,years,type){
  balance=Math.max(0,balance);const rate=Math.max(0,annualRate)/12,months=Math.max(1,years*12);
  if(!balance)return 0;if(type==="interestOnly")return balance*rate;if(type==="serial")return balance/months+balance*rate;if(!rate)return balance/months;
  return balance*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1);
 }
 function mortgageData(){
  const s=state(),life=s.life,budget=totals(),entered=(s.budget.find(item=>item.id==="mortgage")||s.budget.find(item=>item.id==="housing"))?.amount||0;
  const currentRate=life.mortgageRate/100,stressRate=Math.max(.07,currentRate+.03);
  const current=mortgagePayment(life.mortgage,currentRate,life.loanYears,life.loanType),stress=mortgagePayment(life.mortgage,stressRate,life.loanYears,life.loanType);
  const stressRemaining=budget.remaining+entered-stress;let low=0,high=.30,available=budget.remaining+entered;
  for(let index=0;index<65;index++){const midpoint=(low+high)/2;if(mortgagePayment(life.mortgage,midpoint,life.loanYears,life.loanType)<=available)low=midpoint;else high=midpoint}
  return {currentRate,stressRate,current,stress,stressRemaining,maxRate:low,entered};
 }
 function simulateLoan(extraMonthly=0){
  const life=state().life,balanceStart=Math.max(0,life.mortgage),rate=Math.max(0,life.mortgageRate/100/12),maxMonths=Math.max(1,Math.round(life.loanYears*12));
  const run=extra=>{
   let balance=balanceStart,interest=0,months=0;const annuity=mortgagePayment(balanceStart,life.mortgageRate/100,life.loanYears,"annuity"),serialPrincipal=balanceStart/maxMonths;
   while(balance>0.01&&months<maxMonths*2){
    const monthInterest=balance*rate;interest+=monthInterest;
    let payment=life.loanType==="interestOnly"?monthInterest:life.loanType==="serial"?serialPrincipal+monthInterest:annuity;
    payment+=Math.max(0,extra);const principal=Math.max(0,payment-monthInterest);
    if(principal<=0&&extra<=0){months=maxMonths;break}
    balance=Math.max(0,balance-principal);months++;
   }
   return {months,interest,balance};
  };
  const baseline=run(0),accelerated=run(extraMonthly);
  return {baseline,accelerated,monthsSaved:Math.max(0,baseline.months-accelerated.months),interestSaved:Math.max(0,baseline.interest-accelerated.interest)};
 }
 function project(rate){
  const s=state(),life=s.life,rows=[];let salary=life.salary,monthly=life.monthlyInvestment,bonus=life.bonus,portfolio=life.portfolioStart,ips=life.ipsStart,otp=life.otpStart;
  let home=life.includeHome?life.homeValue:0,loan=life.includeHome?life.mortgage:0,price=1;
  for(let index=0;index<=life.retireAge-life.startAge;index++){
   const ordinary=monthly*12,otpIn=salary*life.otpRate/100;
   portfolio=(portfolio+ordinary+bonus)*(1+rate);ips=(ips+life.ipsAnnual)*(1+rate);otp=(otp+otpIn)*(1+rate);
   if(life.includeHome){home*=1+life.homeGrowth/100;loan=Math.max(0,loan-life.annualPrincipal)}
   price*=1+life.inflation/100;const equity=life.includeHome?home-loan:0,net=s.profile.buffer+portfolio+ips+otp+equity;
   rows.push({year:life.startYear+index,age:life.startAge+index,salary,monthly,port:portfolio,ips,otp,pension:ips+otp,home,loan,equity,net,real:net/price});
   const raise=salary*life.salaryGrowth/100;salary+=raise;monthly+=raise*life.raiseShare/100/12;bonus+=bonus*life.salaryGrowth/100*life.raiseShare/100;
  }
  return rows;
 }
 function recalculate(){
  const life=state().life;
  return {low:project(life.retLow/100),mid:project(life.retMid/100),high:project(life.retHigh/100)};
 }
 function nowNetWorth(){const s=state(),life=s.life;return s.profile.buffer+life.portfolioStart+life.ipsStart+life.otpStart+(life.includeHome?life.homeValue-life.mortgage:0)}
 function health(){
  const s=state(),budget=totals(),mortgage=mortgageData(),income=Math.max(1,s.profile.netIncome),monthlyExpenses=Math.max(1,budget.expenses);
  const bufferMonths=s.profile.buffer/monthlyExpenses,savingsRate=(budget.investment+budget.otherSaving)/income,annualGross=Math.max(1,s.life.salary),debtRatio=s.life.mortgage/annualGross,paymentBurden=mortgage.current/income;
  const liquidity=Math.round(Math.max(0,Math.min(20,bufferMonths>=6?20:bufferMonths>=3?16:bufferMonths>=1?8+bufferMonths*2.5:bufferMonths*6)));
  const saving=Math.round(Math.max(0,Math.min(20,savingsRate>=.25?20:savingsRate/.25*20)));
  let debt=20;
  if(s.life.mortgage>0){if(debtRatio>5)debt-=8;else if(debtRatio>4)debt-=5;else if(debtRatio>3)debt-=2;if(paymentBurden>.40)debt-=7;else if(paymentBurden>.30)debt-=4;else if(paymentBurden>.22)debt-=2;if(mortgage.stressRemaining<0)debt-=5;debt=Math.max(0,Math.min(20,Math.round(debt)))}
  let robustness=0;if(s.life.otpRate>0)robustness+=5;if(s.life.ipsAnnual>0||s.life.ipsStart>0)robustness+=3;if((s.budget.find(item=>item.id==="insurance")?.amount||0)>0)robustness+=4;if(budget.remaining>=0)robustness+=3;robustness=Math.min(20,robustness);
  const projections=getProjections(),final=projections.mid?.at(-1);let future=0;
  if(final){const realGrowth=final.real-nowNetWorth();if(realGrowth>0)future+=8;if(s.life.monthlyInvestment>0)future+=5;if(s.life.salaryGrowth>s.life.inflation)future+=3;if(final.pension>0)future+=4}future=Math.min(20,future);
  const dimensions=[{name:"Likviditet",score:liquidity},{name:"Sparing",score:saving},{name:"Gjeld",score:debt},{name:"Robusthet",score:robustness},{name:"Fremtid",score:future}];
  const lowest=[...dimensions].sort((a,b)=>a.score-b.score)[0],adviceMap={Likviditet:"Bygg buffer til minst tre måneders løpende utgifter.",Sparing:"Øk sparingen gradvis mot minst 10–15 % av nettoinntekten.",Gjeld:"Reduser gjeldsbelastningen eller øk månedlig margin.",Robusthet:"Styrk buffer, forsikring eller pensjonssparing.",Fremtid:"Sørg for positiv realvekst gjennom jevn investering."};
  const issues=dimensions.map(dimension=>[dimension.score>=15?"good":dimension.score>=10?"warn":"bad",dimension.name,`${dimension.score} av 20 poeng`]);
  return {score:liquidity+saving+debt+robustness+future,dimensions,issues,advice:adviceMap[lowest.name],lowest:lowest.name};
 }
 return {annualMonthly,totals,mortgagePayment,mortgageData,simulateLoan,project,recalculate,nowNetWorth,health};
}

globalThis.OFFinance=Object.freeze({createFinanceEngine});
})();
