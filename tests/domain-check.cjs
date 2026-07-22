const assert = require("assert");

require("../assets/finance.js");
require("../assets/recommendations.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const approximately = (actual, expected, tolerance = 1) => {
  assert(Math.abs(actual - expected) <= tolerance, `Forventet omtrent ${expected}, fikk ${actual}`);
};
const fmtNok = (value) => `${Math.round(Number(value) || 0).toLocaleString("nb-NO")} kr`;
const fmtPct = (value) => `${Math.round((Number(value) || 0) * 100)} %`;
const futureValueMonthly = (monthly, rate, years) => {
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = rate / 12;
  if (!monthlyRate) return monthly * months;
  return monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
};

function baseState() {
  return {
    profile: {
      netIncome: 59650,
      buffer: 20000,
      goalBufferMonths: 3,
      goalInvestmentRate: 15,
    },
    annual: { travel: 18000, gifts: 8400, health: 6000, maintenance: 12000 },
    budget: [
      { id: "housing", name: "Bolig", amount: 15000, type: "fixed" },
      { id: "food", name: "Mat", amount: 6315, type: "variable" },
      { id: "subscriptions", name: "Abonnement", amount: 2415, type: "variable" },
      { id: "insurance", name: "Forsikring", amount: 2198, type: "fixed" },
      { id: "investment", name: "Investering", amount: 2505, type: "saving", linked: true },
    ],
    life: {
      startYear: 2026,
      startAge: 42,
      retireAge: 67,
      salary: 744840,
      salaryGrowth: 3,
      inflation: 2,
      raiseShare: 50,
      monthlyInvestment: 2505,
      bonus: 0,
      portfolioStart: 100000,
      ipsStart: 25000,
      otpStart: 30000,
      ipsAnnual: 15000,
      otpRate: 2,
      includeHome: true,
      homeValue: 4576100,
      mortgage: 2071800,
      mortgageRate: 5.1,
      loanYears: 25,
      loanType: "annuity",
      homeGrowth: 3,
      annualPrincipal: 45000,
      retLow: 5,
      retMid: 7,
      retHigh: 9,
    },
    goals: [],
    ui: { recommendationState: { completed: [], dismissed: [] } },
  };
}

function referenceState() {
  const state = baseState();
  state.profile.buffer = 53266;
  state.annual = { travel: 0, gifts: 0, health: 0, maintenance: 0 };
  state.budget = [
    { id: "housing", name: "Andre faste utgifter", amount: 21207, type: "fixed" },
    { id: "variable", name: "Variable utgifter", amount: 29861, type: "variable" },
    { id: "insurance", name: "Forsikring", amount: 2198, type: "fixed" },
    { id: "investment", name: "Investering", amount: 2505, type: "saving", linked: true },
  ];
  state.life.monthlyInvestment = 2505;
  state.life.salary = 744840;
  state.life.salaryGrowth = 3;
  state.life.raiseShare = 4.2;
  state.life.portfolioStart = 91000;
  state.life.ipsStart = 0;
  state.life.otpStart = 0;
  state.life.ipsAnnual = 0;
  state.life.otpRate = 4;
  state.life.homeValue = 4576100;
  state.life.mortgage = 2071800;
  state.life.mortgageRate = 5.08;
  state.life.loanYears = 25;
  state.life.homeGrowth = 2;
  state.life.annualPrincipal = 44000;
  state.life.retLow = 7;
  state.life.retMid = 9;
  state.life.retHigh = 11;
  return state;
}

function financeFor(state) {
  let projections = { low: [], mid: [], high: [] };
  const engine = globalThis.OFFinance.createFinanceEngine({
    getState: () => state,
    getProjections: () => projections,
  });
  projections = engine.recalculate();
  return { engine, projections };
}

function recommendationsFor(state) {
  const { engine: finance } = financeFor(state);
  return globalThis.OFRecommendations.createRecommendationEngine({
    getState: () => state,
    totals: () => finance.totals(),
    health: () => finance.health(),
    mortgageData: () => finance.mortgageData(),
    goalProgress: () => 0,
    goalForecast: () => null,
    futureValueMonthly,
    fmtNok,
    fmtPct,
  });
}

{
  const state = baseState();
  const { engine, projections } = financeFor(state);
  const totals = engine.totals();
  assert(totals.remaining > 0, "Referansebudsjettet skal ha positiv kontantstrøm");
  approximately(totals.total + totals.remaining, state.profile.netIncome, 0.01);
  assert.strictEqual(projections.mid.length, state.life.retireAge - state.life.startAge + 1);
  assert.strictEqual(projections.mid[0].year, state.life.startYear);
  assert.strictEqual(projections.mid[0].age, state.life.startAge);
  assert.strictEqual(projections.mid.at(-1).age, state.life.retireAge);
  approximately(projections.mid[0].net, engine.nowNetWorth(), 0.01);
  approximately(projections.mid[0].port, state.life.portfolioStart, 0.01);
  approximately(projections.mid[0].home, state.life.homeValue, 0.01);
  approximately(projections.mid[0].loan, state.life.mortgage, 0.01);
  approximately(projections.mid[0].real, projections.mid[0].net, 0.01);
  approximately(projections.mid[1].real, projections.mid[1].net / 1.02, 0.01);
  assert(engine.health().score >= 0 && engine.health().score <= 100);
  assert(engine.simulateLoan(1000).interestSaved > 0, "Ekstra avdrag skal spare renter");
  approximately(engine.mortgagePayment(2000000, 0.05, 25, "annuity"), 11691.80, 1);
  approximately(engine.mortgagePayment(1200000, 0, 10, "annuity"), 10000, 0.01);
}

{
  const state = referenceState();
  const { engine } = financeFor(state);
  const totals = engine.totals();
  assert.strictEqual(totals.expenses, 53266, "Referanseutgiftene skal være 53 266 kr per måned");
  assert.strictEqual(totals.remaining, 3879, "Referansebudsjettet skal ha 3 879 kr til overs");
  assert.strictEqual(engine.health().score, 66, "Norsk referanseprofil skal starte på 66 av 100 i appens modell");
}

{
  const state = baseState();
  state.life.salaryGrowth = 0;
  state.life.raiseShare = 0;
  state.life.otpRate = 0;
  state.life.ipsAnnual = 0;
  state.life.includeHome = false;
  state.life.bonus = 12000;
  const { engine, projections } = financeFor(state);
  const firstFutureYear = projections.mid[1];
  approximately(firstFutureYear.port, (state.life.portfolioStart + state.life.monthlyInvestment * 12 + 12000) * 1.07, 0.01);
  assert.strictEqual(firstFutureYear.home, 0);
  assert.strictEqual(firstFutureYear.loan, 0);
  approximately(engine.nowNetWorth(), state.profile.buffer + state.life.portfolioStart + state.life.ipsStart + state.life.otpStart, 0.01);
}

{
  const state = baseState();
  state.budget[0].amount = 70000;
  const engine = recommendationsFor(state);
  const recommendations = engine.recommendations();
  assert.strictEqual(engine.context().stage, "stabilize");
  assert.strictEqual(recommendations[0].id, "balance_budget");
  assert.strictEqual(recommendations[0].action.type, "budget");
}

{
  const state = baseState();
  const engine = recommendationsFor(state);
  const recommendations = engine.recommendations();
  assert.strictEqual(engine.context().stage, "protect");
  assert.strictEqual(recommendations[0].id, "build_buffer");
  assert(recommendations.every((item, index) => index === 0 || recommendations[index - 1].priority >= item.priority));
  assert(new Set(recommendations.map((item) => item.id)).size === recommendations.length);

  const first = recommendations[0];
  state.ui.recommendationState.dismissed.push({
    id: first.id,
    signature: first.signature,
    until: new Date(Date.now() + 86400000).toISOString(),
  });
  assert(!engine.recommendations().some((item) => item.id === first.id), "Skjult forslag skal filtreres bort");
}

{
  const state = baseState();
  state.profile.buffer = 250000;
  state.budget.find((item) => item.id === "subscriptions").amount = 300;
  state.budget.find((item) => item.id === "insurance").amount = 1000;
  const engine = recommendationsFor(state);
  assert.strictEqual(engine.context().stage, "grow");
  assert.strictEqual(engine.recommendations()[0].id, "increase_investment");
}

{
  const state = baseState();
  state.profile.buffer = 250000;
  state.profile.goalInvestmentRate = 4;
  state.budget.find((item) => item.id === "investment").amount = 7000;
  state.life.monthlyInvestment = 7000;
  state.budget.find((item) => item.id === "subscriptions").amount = 300;
  state.budget.find((item) => item.id === "insurance").amount = 1000;
  state.life.mortgage = 0;
  const engine = recommendationsFor(state);
  assert.strictEqual(engine.recommendations().length, 0, "En robust plan skal kunne ha null nye forslag");
}

console.log("OK: Beregningsmotoren og anbefalingsmotorens prioritering, skjuling og tomtilstand er testet");
