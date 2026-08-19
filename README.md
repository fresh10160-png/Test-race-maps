# Race Maps

Web aplikacija poput Google Maps-a, namenjena obeležavanju "race" staza: postavi start (A) i cilj (B) na mapi, po želji dodaj tačke da oblikuješ trasu, i sačuvaj stazu za kasnije.

## Funkcionalnosti

- Interaktivna mapa (Leaflet + OpenStreetMap, bez potrebe za API ključem)
- A/B tagovanje: postavi tačku starta (A) i cilja (B) klikom na mapu
- Dodavanje dodatnih tačaka da se oblikuje realna trasa staze
- Prevlačenje (drag) A/B markera radi finog podešavanja pozicije
- Automatski izračunata dužina staze
- Čuvanje staza lokalno (localStorage) sa nazivom, učitavanje i brisanje sačuvanih staza

## Pokretanje

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
