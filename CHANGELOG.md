# Endringslogg

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
