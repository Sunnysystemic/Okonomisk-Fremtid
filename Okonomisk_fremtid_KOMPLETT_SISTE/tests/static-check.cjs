const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("assets/app.js");
const styles = read("assets/styles.css");
const sw = read("sw.js");
const failures = [];

const requiredFiles = [
  "index.html",
  "assets/app.js",
  "assets/styles.css",
  "sw.js",
  "manifest.webmanifest",
  "privacy.html",
  "icon-192.png",
  "icon-512.png",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Mangler fil: ${file}`);
}

if (/<(?:script|style)>/i.test(html)) failures.push("HTML inneholder fortsatt innebygd stil eller programlogikk.");
if (/\son(?:click|input|change)\s*=/i.test(html)) failures.push("HTML inneholder fortsatt inline-hendelser.");
if (!html.includes('href="assets/styles.css"')) failures.push("HTML laster ikke designsystemet.");
if (!html.includes('src="assets/app.js"')) failures.push("HTML laster ikke app-logikken.");
if (!app.trimStart().startsWith('(()=>{\n"use strict";')) failures.push("App-logikken er ikke kapslet inn i streng modus.");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) failures.push(`Dupliserte id-er: ${duplicateIds.join(", ")}`);

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
  if (!sw.includes(`"${asset}"`)) failures.push(`Offline-cachen mangler ${asset}`);
}

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

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`OK: ${ids.length} unike element-id-er`);
console.log(`OK: ${functionNames.length} unike, kapslede funksjoner`);
console.log(`OK: ${usedActions.length} delegerte handlinger`);
console.log("OK: Ingen inline-hendelser eller manglende appfiler");
