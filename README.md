# Økonomisk fremtid

En privat, lokal og installerbar PWA for budsjett, investering, gjeld og langsiktig økonomisk planlegging.

## Personvern

- Ingen konto
- Ingen analyseverktøy
- Ingen annonser
- Ingen data sendes til en server
- Alle personlige data lagres lokalt i nettleseren
- Repositoriet inneholder bare kildekode og nøytrale eksempelverdier

> Merk: GitHub Pages publiserer selve appkoden offentlig. Data du skriver inn etter åpning lagres fortsatt bare lokalt på enheten din.

## Publisering med GitHub Pages

1. Opprett et nytt, tomt repository på GitHub. Et nøytralt navn kan være `okonomisk-fremtid`.
2. Last opp alle filene i denne mappen til repositoryets rot.
3. Gå til **Settings → Pages**.
4. Under **Build and deployment**, velg **GitHub Actions**.
5. Push til `main`. Workflowen `Deploy GitHub Pages` publiserer appen automatisk.
6. Den ferdige adressen vises under **Settings → Pages** og i workflow-kjøringen.

## Lokal testing

Fra prosjektmappen:

```bash
python -m http.server 8080
```

Åpne deretter:

```text
http://localhost:8080
```

## Installasjon

- **Chrome/Edge på PC:** Installer-ikonet i adressefeltet.
- **Android Chrome:** Meny → Installer app.
- **iPhone/iPad Safari:** Del → Legg til på Hjem-skjerm.

## Filer

- `index.html` – hele appen
- `manifest.webmanifest` – PWA-konfigurasjon
- `sw.js` – offline-cache
- `icon-192.png` / `icon-512.png` – appikoner
- `.github/workflows/deploy-pages.yml` – automatisk publisering
