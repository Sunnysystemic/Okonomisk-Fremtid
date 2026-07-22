const assert = require("assert");

require("../assets/finance.js");
require("../assets/recommendations.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
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
  assert.strictEqual(projections.mid.length, state.life.retireAge - state.life.startAge + 1);
  assert(engine.health().score >= 0 && engine.health().score <= 100);
  assert(engine.simulateLoan(1000).interestSaved > 0, "Ekstra avdrag skal spare renter");
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
