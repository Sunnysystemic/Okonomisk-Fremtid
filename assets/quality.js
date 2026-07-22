(()=>{
"use strict";

const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)));
const INPUT_RULES=Object.freeze({
 startAge:{min:18,max:90,step:1,label:"Startalder"},retireAge:{min:19,max:100,step:1,label:"Pensjonsalder"},startYear:{min:2000,max:2100,step:1,label:"Startår"},
 salary:{min:0,max:1e9,step:1000,label:"Årslønn"},salaryGrowth:{min:-20,max:20,step:.1,label:"Lønnsvekst"},raiseShare:{min:0,max:100,step:1,label:"Andel lønnsøkning"},
 bonus:{min:0,max:1e8,step:1000,label:"Årlig bonusinvestering"},ipsAnnual:{min:0,max:1e7,step:1000,label:"Årlig IPS"},otpRate:{min:0,max:30,step:.1,label:"OTP-sats"},
 portfolioStart:{min:0,max:1e12,step:1000,label:"Ordinær portefølje"},ipsStart:{min:0,max:1e12,step:1000,label:"IPS-saldo"},otpStart:{min:0,max:1e12,step:1000,label:"Pensjonskonto"},
 homeValue:{min:0,max:1e12,step:1000,label:"Boligverdi"},mortgage:{min:0,max:1e12,step:1000,label:"Boliglån"},homeGrowth:{min:-20,max:20,step:.1,label:"Boligprisvekst"},annualPrincipal:{min:0,max:1e9,step:1000,label:"Årlig avdrag"},
 mortgageRate:{min:0,max:30,step:.1,label:"Boliglånsrente"},loanYears:{min:1,max:50,step:1,label:"Gjenværende løpetid"},inflation:{min:0,max:20,step:.1,label:"Inflasjon"},
 retLow:{min:-20,max:30,step:.1,label:"Konservativ avkastning"},retMid:{min:-20,max:30,step:.1,label:"Forventet avkastning"},retHigh:{min:-20,max:30,step:.1,label:"Sterk avkastning"},
 netIncome:{min:0,max:1e8,step:100,label:"Netto månedslønn"},buffer:{min:0,max:1e10,step:1000,label:"Disponibel buffer"},adults:{min:1,max:20,step:1,label:"Voksne"},children:{min:0,max:20,step:1,label:"Barn"},
 annualTravel:{min:0,max:1e8,step:1000,label:"Ferie og reise"},annualGifts:{min:0,max:1e8,step:1000,label:"Gaver og høytider"},annualHealth:{min:0,max:1e8,step:1000,label:"Helse og tannlege"},annualMaintenance:{min:0,max:1e8,step:1000,label:"Vedlikehold"},
 goalBufferMonths:{min:0,max:24,step:.5,label:"Buffer-mål"},goalInvestmentRate:{min:0,max:100,step:1,label:"Investeringsmål"},budgetMortgagePayment:{min:0,max:1e8,step:100,label:"Boliglånsbetaling"},
 decisionInvestment:{min:0,max:1e7,step:500,label:"Månedlig investering"},decisionPurchase:{min:0,max:1e12,step:1000,label:"Engangskjøp"},decisionHomeValue:{min:0,max:1e12,step:1000,label:"Ny boligverdi"},decisionMortgage:{min:0,max:1e12,step:1000,label:"Nytt boliglån"},decisionExtraPrincipal:{min:0,max:1e8,step:500,label:"Ekstra avdrag"},
 goalTarget:{min:0,max:1e12,step:1000,label:"Målbeløp"},onboardIncome:{min:0,max:1e8,step:100,label:"Netto månedslønn"},onboardInvestment:{min:0,max:1e7,step:100,label:"Månedlig investering"},onboardAge:{min:18,max:90,step:1,label:"Alder"},onboardRetire:{min:19,max:100,step:1,label:"Pensjonsalder"}
});

function normalizeStateRanges(normalized){
 const life=normalized.life,profile=normalized.profile;
 life.startAge=Math.round(clamp(life.startAge,18,90));
 life.retireAge=Math.round(clamp(life.retireAge,life.startAge+1,100));
 life.startYear=Math.round(clamp(life.startYear,2000,2100));
 life.salary=clamp(life.salary,0,1e9);life.salaryGrowth=clamp(life.salaryGrowth,-20,20);life.raiseShare=clamp(life.raiseShare,0,100);life.monthlyInvestment=clamp(life.monthlyInvestment,0,1e7);
 life.bonus=clamp(life.bonus,0,1e8);life.ipsAnnual=clamp(life.ipsAnnual,0,1e7);life.otpRate=clamp(life.otpRate,0,30);
 ["portfolioStart","ipsStart","otpStart","homeValue","mortgage"].forEach(key=>life[key]=clamp(life[key],0,1e12));
 life.homeGrowth=clamp(life.homeGrowth,-20,20);life.annualPrincipal=clamp(life.annualPrincipal,0,1e9);life.mortgageRate=clamp(life.mortgageRate,0,30);life.loanYears=Math.round(clamp(life.loanYears,1,50));life.inflation=clamp(life.inflation,0,20);
 const returns=[life.retLow,life.retMid,life.retHigh].map(value=>clamp(value,-20,30)).sort((a,b)=>a-b);[life.retLow,life.retMid,life.retHigh]=returns;
 profile.netIncome=clamp(profile.netIncome,0,1e8);profile.buffer=clamp(profile.buffer,0,1e10);profile.adults=Math.round(clamp(profile.adults,1,20));profile.children=Math.round(clamp(profile.children,0,20));profile.goalBufferMonths=clamp(profile.goalBufferMonths,0,24);profile.goalInvestmentRate=clamp(profile.goalInvestmentRate,0,100);
 return normalized
}

function importCandidate(payload){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("Filen inneholder ikke et gyldig dataobjekt");
 const candidate=payload.data&&typeof payload.data==="object"?payload.data:payload;
 const recognized=["version","life","profile","budget","goals","accounting"].some(key=>Object.prototype.hasOwnProperty.call(candidate,key));
 if(!recognized)throw new Error("Filen ser ikke ut til å være en sikkerhetskopi fra Økonomisk fremtid");
 return candidate
}

globalThis.OFQuality=Object.freeze({INPUT_RULES,clamp,normalizeStateRanges,importCandidate});
})();
