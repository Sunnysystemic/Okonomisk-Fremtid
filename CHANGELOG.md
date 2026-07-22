# Endringslogg

## Fase 3 – gjennomgående design

- Alle faner bruker nå samme fargepalett, typografi, kort, knapper, skjemaer og tabeller.
- Mørke marine og turkise signaturflater fremhever de viktigste beslutningene uten å gjøre hele appen tung.
- Plan-tiltak har fått en robust layout som ikke presser tekst eller effektdata sammen.
- Mobilnavigasjonen har riktig plass til alle seks fanene.
- Regnskapet beholder en stabil kortvisning på mobil.
- Tastaturfokus, trykkflater og redusert bevegelse er ivaretatt.
- Fase 3-design og versjonerte filer er lagt til offline-cachen.

## Fase 1 – stabilitet

- Beregninger og anbefalinger er flyttet ut av hovedfilen og inn i egne moduler.
- Datamigrering skjer ett sted før appen rendres.
- Duplisert milepællogikk er erstattet av én felles komponent.
- Alle seks faner rendres og testes isolert.
- Regnskapsfeltene oppdateres uten å bygge tabellen på nytt eller miste fokus.
- Utdaterte funksjonskall, inline-hendelser og manglende elementkoblinger kontrolleres automatisk.

## Fase 2 – smarte anbefalinger

- Anbefalinger prioriteres etter økonomisk fase: stabilisere, beskytte, styrke eller vokse.
- Hovedforslaget forklarer hvorfor det prioriteres, forventet effekt og sikkerhet.
- Simulatorforslag endrer ikke grunnplanen.
- Fullførte og midlertidig skjulte forslag huskes.
- Negativ kontantstrøm går foran vekstforslag.
- Motoren håndterer også situasjoner uten nye forslag.
