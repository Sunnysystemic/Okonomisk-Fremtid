# Økonomisk fremtid – lanseringskandidat v2

Økonomisk fremtid er en lokal PWA for budsjett, regnskap, økonomiske valg, mål og langsiktige scenarioer. Appen oppretter ingen konto og lagrer brukerdata lokalt i nettleseren.

## Publisering på GitHub Pages

1. Pakk ut ZIP-filen.
2. Last opp hele innholdet til roten av repositoryet.
3. Behold mappestrukturen, særlig `.github`, `assets` og `tests`.
4. Erstatt eksisterende filer når GitHub spør.

Workflowen i `.github/workflows/deploy-pages.yml` publiserer automatisk fra `main`.

## Viktig om data og beregninger

- Referanseinntekt og samlet referanseforbruk bygger på SSB-tall, prisjustert til juni 2026.
- Praktiske budsjettunderposter og langsiktige scenarioer inneholder tydelig merkede modellantakelser.
- Resultatene er illustrasjoner, ikke personlig investerings-, skatte- eller pensjonsrådgivning.
- Brukeren bør eksportere en sikkerhetskopi før bytte av nettleser eller enhet.

Se [LANSERINGSKONTROLL.md](LANSERINGSKONTROLL.md) for gjennomførte kontroller, kilder og kjente avgrensninger.

## Prosjektstruktur

- `index.html` – struktur og tilgjengelige dialoger
- `assets/design-system.css` – gjennomgående design
- `assets/quality.js` – validering og importkontroll
- `assets/finance.js` – økonomiske beregninger
- `assets/recommendations.js` – prioriterte anbefalinger
- `assets/app.js` – navigasjon, visning og brukerhandlinger
- `sw.js` – offline-støtte og oppdateringsflyt
- `tests` – struktur-, domene- og nettlesertester
