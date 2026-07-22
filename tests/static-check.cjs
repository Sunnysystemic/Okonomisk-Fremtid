const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("assets/app.js");
const quality = read("assets/quality.js");
const finance = read("assets/finance.js");
const recommendations = read("assets/recommendations.js");
const styles = read("assets/styles.css");
const design = read("assets/design-system.css");
const sw = read("sw.js");
const failures = [];

const requiredFiles = [
  "index.html",
  "assets/app.js",
  "assets/quality.js",
  "assets/finance.js",
  "assets/recommendations.js",
  "assets/styles.css",
  "assets/design-system.css",
  "sw.js",
  "manifest.webmanifest",
  "privacy.html",
  "icon-192.png",
  "icon-512.png",
  "tests/browser-smoke.html",
  "tests/domain-check.cjs",
  ".github/workflows/deploy-pages.yml",
  "LANSERINGSKONTROLL.md",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Mangler fil: ${file}`);
}

if (/<(?:script|style)>/i.test(html)) failures.push("HTML inneholder fortsatt innebygd stil eller programlogikk.");
if (/\son(?:click|input|change)\s*=/i.test(html)) failures.push("HTML inneholder fortsatt inline-hendelser.");
if (!/href="assets\/styles\.css(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke designsystemet.");
if (!/href="assets\/design-system\.css(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke fase 3-designet.");
if (!/src="assets\/app\.js(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke app-logikken.");
if (!/src="assets\/quality\.js(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke kvalitetsmodulen.");
if (!/src="assets\/finance\.js(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke beregningsmodulen.");
if (!/src="assets\/recommendations\.js(?:\?[^\"]+)?"/.test(html)) failures.push("HTML laster ikke anbefalingsmotoren.");
if (!app.trimStart().startsWith('(()=>{\n"use strict";')) failures.push("App-logikken er ikke kapslet inn i streng modus.");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) failures.push(`Dupliserte id-er: ${duplicateIds.join(", ")}`);

const voidTags = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
const tagStack = [];
for (const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*?)?\s*\/?>/gi)) {
  const full = match[0], tag = match[1].toLowerCase();
  if (voidTags.has(tag) || full.endsWith("/>") || full.startsWith("<!")) continue;
  if (full.startsWith("</")) {
    const open = tagStack.pop();
    if (open !== tag) { failures.push(`Ubalansert HTML: forventet </${open || "ingen"}>, fant </${tag}>`); break; }
  } else tagStack.push(tag);
}
if (tagStack.length) failures.push(`Ubalansert HTML: mangler avslutning for ${tagStack.slice(-5).join(", ")}`);

const referencedIds = [...app.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds.filter((id) => !ids.includes(id)))];
if (missingIds.length) failures.push(`Programlogikken peker på manglende elementer: ${missingIds.join(", ")}`);

const functionNames = [...app.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map((match) => match[1]);
const duplicateFunctions = [...new Set(functionNames.filter((name, index) => functionNames.indexOf(name) !== index))];
if (duplicateFunctions.length) failures.push(`Dupliserte funksjoner: ${duplicateFunctions.join(", ")}`);

const usedActions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g), ...app.matchAll(/data-action=\\?"([^"\\]+)\\?"/g)].map((match) => match[1]))];
const handledActions = new Set([...app.matchAll(/case\s+"([^"]+)"\s*:/g)].map((match) => match[1]));
const unhandledActions = usedActions.filter((action) => !handledActions.has(action));
if (unhandledActions.length) failures.push(`Handlinger uten mottaker: ${unhandledActions.join(", ")}`);

for (const asset of ["./assets/styles.css", "./assets/app.js"]) {
  if (!sw.includes(`"${asset}`)) failures.push(`Offline-cachen mangler ${asset}`);
}
if (!sw.includes('"./assets/recommendations.js')) failures.push("Offline-cachen mangler anbefalingsmotoren.");
if (!sw.includes('"./assets/finance.js')) failures.push("Offline-cachen mangler beregningsmodulen.");
if (!sw.includes('"./assets/quality.js')) failures.push("Offline-cachen mangler kvalitetsmodulen.");
if (!sw.includes('"./assets/design-system.css')) failures.push("Offline-cachen mangler fase 3-designet.");
for (const asset of ["styles.css", "design-system.css", "quality.js", "finance.js", "recommendations.js", "app.js"]) {
  const htmlMatch = html.match(new RegExp(`assets/${asset.replace(".", "\\.")}\\?v=([^\"]+)`));
  if (!htmlMatch || !sw.includes(`./assets/${asset}?v=${htmlMatch[1]}`)) failures.push(`HTML og offline-cache bruker ulik versjon av ${asset}.`);
}
try {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  if (manifest.name !== "Økonomisk fremtid" || manifest.display !== "standalone") failures.push("Manifestet har feil navn eller visningsmodus.");
} catch { failures.push("Manifestet er ikke gyldig JSON."); }

if (!styles.includes(".accounting-table{table-layout:fixed")) failures.push("Regnskapstabellen mangler stabil kolonnelayout.");
if (!app.includes("function refreshAccountingLive()")) failures.push("Regnskap mangler oppdatering uten full tabellrendering.");

const functionBody = (name, nextName) => {
  const start = app.indexOf(`function ${name}(`);
  const end = nextName ? app.indexOf(`function ${nextName}(`, start + 1) : app.length;
  return start >= 0 ? app.slice(start, end >= 0 ? end : app.length) : "";
};
const accountingRowUpdate = functionBody("updateAccountingRow", "updateAccountingIncome");
const accountingIncomeUpdate = functionBody("updateAccountingIncome", "copyBudgetToAccounting");
for (const [label, body] of [["regnskapsrad", accountingRowUpdate], ["inntekt", accountingIncomeUpdate]]) {
  if (!body.includes("refreshAccountingLive()")) failures.push(`Liveoppdatering mangler for ${label}.`);
  if (body.includes("renderAccounting()") || body.includes("innerHTML")) failures.push(`${label} bygger fortsatt regnskapstabellen på nytt under skriving.`);
}

const renderAllBody = functionBody("renderAll", "renderDashboard");
if (!renderAllBody.includes("renderPageContent(state.ui.page)")) failures.push("Hovedrenderingen er ikke avgrenset til aktiv fane.");
for (const renderer of ["renderDashboard()", "renderBudget()", "renderFuture()", "renderDecisions()", "renderGoals()", "renderSettings()"]) {
  if (renderAllBody.includes(renderer)) failures.push(`Hovedrenderingen kaller fortsatt ${renderer} direkte.`);
}

if (!styles.includes(".accounting-table tbody tr{display:grid")) failures.push("Regnskapet mangler stabil kortvisning på mobil.");

if (!html.includes('class="forecast-list"') || !styles.includes(".forecast-row{")) failures.push("Årsutviklingen mangler den moderne periodevisningen.");
if (html.includes("polished-forecast") || styles.includes(".polished-forecast")) failures.push("Utdatert årstabell ligger fortsatt igjen.");

if (!design.includes("repeat(6,minmax(0,1fr))")) failures.push("Mobilnavigasjonen har ikke plass til alle seks fanene.");
if (!design.includes("grid-template-columns:42px minmax(0,1fr) minmax(150px,.72fr)")) failures.push("Plantiltakene mangler robust kolonnelayout.");
if (!design.includes("prefers-reduced-motion:reduce")) failures.push("Designet mangler redusert bevegelse for tilgjengelighet.");
if (!design.includes("focus-visible")) failures.push("Designet mangler synlig tastaturfokus.");
if (/type="month"/.test(html)) failures.push("Ustabil, nettleseravhengig månedsvelger ligger fortsatt i appen.");
for (const id of ["accountingMonthPart","accountingYearPart"])
  if (!ids.includes(id)) failures.push(`Regnskapets månedsvelger mangler ${id}.`);
if (!app.includes('on("accountingMonthPart","change",updateAccountingMonthFromControls)') || !app.includes('on("accountingYearPart","change",updateAccountingMonthFromControls)')) failures.push("Regnskapets måned og år er ikke koblet til samme stabile oppdatering.");
if (!design.includes('input[type="number"]::-webkit-inner-spin-button')) failures.push("Native tallpiler er ikke normalisert.");
if (!design.includes(".month-picker{")) failures.push("Månedsvelgeren mangler felles layout.");
if (/type="date"/.test(html)) failures.push("Nettleseravhengig datofelt ligger fortsatt i appen.");
if (!html.includes('id="futureAssumptions"') || !design.includes(".assumption-strip{")) failures.push("Fremtidsvisningen mangler synlige forutsetninger.");
if (!html.includes("Praktiske budsjettunderposter") || !html.includes("modellforutsetninger")) failures.push("Referanseprofilen skiller ikke tydelig mellom statistikk og modellantakelser.");
if (!app.includes("Referansenivå") || /mot SSB/.test(app)) failures.push("Budsjettunderpostene fremstilles fortsatt som direkte SSB-gjennomsnitt.");
if (!quality.includes("const INPUT_RULES=") || !app.includes("function validateNumberInput(")) failures.push("Tallfeltene mangler samlet validering.");
if (/\bconfirm\s*\(/.test(app)) failures.push("Native bekreftelsesdialoger ligger fortsatt i appen.");
if (!app.includes("RECOVERY_STORAGE") || !app.includes("function recoverData(")) failures.push("Appen mangler lokal gjenoppretting før destruktive handlinger.");
const modalTags = [...html.matchAll(/<div[^>]+class="modal"[^>]*>/g)].map(match => match[0]);
if (modalTags.some(tag => !/role="(?:dialog|alertdialog)"/.test(tag) || !/aria-modal="true"/.test(tag) || !/aria-hidden="true"/.test(tag))) failures.push("En eller flere dialoger mangler tilgjengelig dialogsemantikk.");
if (!finance.includes("if(index>0)")) failures.push("Fremtidsberegningen bruker ikke dagens beholdning som startpunkt.");

for (const enginePart of ["function createRecommendationEngine(","function context()","function rank(","function recommendations()"])
  if (!recommendations.includes(enginePart)) failures.push(`Anbefalingsmotoren mangler ${enginePart}.`);
for (const financePart of ["function createFinanceEngine(","function totals()","function recalculate()","function health()"])
  if (!finance.includes(financePart)) failures.push(`Beregningsmodulen mangler ${financePart}.`);
if (!app.includes('generateRecommendations().slice(0,3)')) failures.push("Plan bruker ikke den samme prioriterte anbefalingsmotoren som dashboardet.");
if (!app.includes("Planen er ikke endret")) failures.push("Simulatorforslag mangler tydelig beskjed om at grunnplanen ikke endres.");
if (!app.includes('document.getElementById("focusTag").textContent="Viktigst nå"')) failures.push("Hovedanbefalingen mangler den faste etiketten Viktigst nå.");
if (/\.onclick\s*=/.test(app + recommendations)) failures.push("Appen inneholder fortsatt direkte onclick-koblinger.");
if (!app.includes("function applyStateMigrations(")) failures.push("Datamodellen mangler en samlet migreringsflyt.");
if (app.includes("function migrateLegacyGoals(")) failures.push("Gammel datamigrering kjøres fortsatt fra visningslogikken.");
if (!app.includes("function milestoneListHtml(") || (app.match(/milestoneListHtml\(/g)||[]).length < 3) failures.push("Milepælvisningene deler ikke én felles komponent.");
if (!app.includes("function runRuntimeSmokeTests(")) failures.push("Appen mangler automatisert kjørefunksjonstest.");
if (Buffer.byteLength(app,"utf8") > 110000) failures.push("Appens hovedfil har vokst forbi arkitekturgrensen; flytt mer logikk til egne moduler.");

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`OK: ${ids.length} unike element-id-er`);
console.log(`OK: ${functionNames.length} unike, kapslede funksjoner`);
console.log(`OK: ${usedActions.length} delegerte handlinger`);
console.log("OK: Ingen inline-hendelser eller manglende appfiler");
