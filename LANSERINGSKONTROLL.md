# Lanseringskontroll – Økonomisk fremtid v2

Kontrollert 22. juli 2026.

## Gjennomført

- Alle seks faner rendres isolert uten blanke visninger.
- Navigasjon, omvisning, budsjett, regnskap, fremtid, beslutninger, mål og innstillinger er gjennomgått.
- Regnskapsfeltene oppdateres uten at tabellen bygges på nytt eller mister fokus.
- Tallfelter har felles grenser, feiltekst og normalisering.
- Sletting, tilbakestilling og overskriving bruker appens egen bekreftelsesdialog.
- Import av ugyldige data avvises; gyldige data normaliseres før bruk.
- Lokal gjenopprettingskopi opprettes før import, tilbakestilling og gjenoppretting.
- Fremtidsberegningen starter med dagens beholdninger og slutter ved valgt pensjonsalder.
- Nominelle og inflasjonsjusterte tall bruker samme scenarioforutsetninger.
- Anbefalingsmotoren prioriterer negativ kontantstrøm og lav buffer før veksttiltak.
- Fullførte og midlertidig skjulte anbefalinger huskes.
- Appen håndterer tilfeller uten nye anbefalinger.
- Dialoger har tastaturfokus, Escape-lukking og tilgjengelig dialogsemantikk.
- Offline-cachen inneholder alle nødvendige appfiler og fjerner gamle cacheversjoner.
- ZIP-leveransen valideres ved å pakkes ut og testes på nytt før levering.

## Norsk referanseprofil

Referansen bruker følgende offisielle SSB-grunnlag:

- Median husholdningsinntekt etter skatt i 2024: 676 100 kr.
- Gjennomsnittlig husholdningsforbruk i 2022: 554 585 kr.
- KPI: 89,2 i 2022, 97,1 i 2024 og 102,8 i juni 2026.
- Beregnet markedsverdi av primærbolig i 2024: 4 576 100 kr blant husholdninger med posten.
- Gjeld i 2024: 2 071 800 kr blant husholdninger med posten.
- Utestående boliglånsrente i mai 2026: 5,08 prosent.
- Nettofinansinvestering i 2025: 4,2 prosent av disponibel inntekt.

Dette gir 59 650 kr i referanseinntekt og 53 266 kr i referanseforbruk per måned i juni 2026-kroner. Den økonomiske helsen starter på 66 av 100 i appens egen, forklarbare modell.

Praktiske budsjettunderposter, alder, buffer, pensjon, lånetid, avdrag, boligvekst, inflasjon og avkastning er modellantakelser. De er ikke SSB-gjennomsnitt eller anbefalinger.

## Offisielle kilder

- [Forbruksundersøkelsen](https://www.ssb.no/inntekt-og-forbruk/forbruk/statistikk/forbruksundersokelsen/)
- [Inntekts- og formuesstatistikk for husholdninger](https://www.ssb.no/inntekt-og-forbruk/inntekt-og-formue/statistikk/inntekts-og-formuesstatistikk-for-husholdninger/)
- [Konsumprisindeksen](https://www.ssb.no/priser-og-prisindekser/konsumpriser/statistikk/konsumprisindeksen)
- [Renteutvikling](https://www.ssb.no/bank-og-finansmarked/finansinstitusjoner-og-andre-finansielle-foretak/statistikk/renter-i-banker-og-kredittforetak/artikler/renteutvikling)
- [Husholdningenes finansregnskap for 2025](https://www.ssb.no/nasjonalregnskap-og-konjunkturer/finansregnskap/artikler/husholdningenes-finansregnskap-for-2025)

## Avgrensninger før offentlig markedsføring

- Appen har ingen bankintegrasjon eller automatisk avstemming.
- Skatt, fondsgebyrer, valutarisiko og alle pensjonsregler modelleres ikke fullstendig.
- Enkeltstående fremtidsbaner viser scenarioer, ikke sannsynligheter.
- Lokal nettleserlagring er ikke en erstatning for brukerens eksporterte sikkerhetskopi.
- Appen bør omtales som et planleggings- og refleksjonsverktøy, ikke som finansiell rådgivning.
