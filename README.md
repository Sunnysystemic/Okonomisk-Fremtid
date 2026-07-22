# Økonomisk fremtid – fase 1 og 2 ferdig

Dette er en komplett erstatningspakke. Den inneholder både den stabile kodebasen fra fase 1 og den prioriterte anbefalingsmotoren fra fase 2.

## Oppdater GitHub

1. Pakk ut ZIP-filen.
2. Last opp hele innholdet til roten av GitHub-repositoryet.
3. Behold mappestrukturen, særlig `.github`, `assets` og `tests`.
4. Erstatt eksisterende filer når GitHub spør.

GitHub Pages publiserer deretter den nye versjonen automatisk.

## Innhold

- `index.html` – appens struktur
- `assets/styles.css` – felles design
- `assets/app.js` – visning, navigasjon og brukerhandlinger
- `assets/finance.js` – beregninger og økonomisk helse
- `assets/recommendations.js` – prioriterte anbefalinger
- `sw.js` – offline-støtte og versjonert hurtiglager
- `tests` – automatiske struktur-, domene- og nettlesertester

Brukerdata lagres fortsatt bare lokalt i nettleseren.
