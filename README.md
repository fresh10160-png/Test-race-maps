# Race Maps

Web aplikacija poput Google Maps-a, namenjena obeležavanju "race" staza: postavi start (A) i cilj (B) na mapi, po želji dodaj tačke da oblikuješ trasu, i sačuvaj stazu za kasnije.

## Funkcionalnosti

- Interaktivna mapa sa pravim ulicama (Leaflet + OpenStreetMap podaci, tamna "race" tema, bez potrebe za API ključem)
- A/B tagovanje: postavi tačku starta (A) i cilja (B) klikom na mapu
- Dodavanje dodatnih tačaka da se oblikuje realna trasa staze
- Prevlačenje (drag) A/B markera radi finog podešavanja pozicije
- Automatski izračunata dužina staze
- Čuvanje staza lokalno (localStorage) sa nazivom, učitavanje i brisanje sačuvanih staza
- 📍 "Moja lokacija" dugme — centrira mapu na tvoju trenutnu poziciju
- 🔴 Snimanje vožnje uživo — klikneš "start", GPS prati tvoju vožnju i automatski dodaje tačke staze, klikneš "stop" i A/B/trasa se automatski postave

## Pokretanje

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Mobilna app (Android / iOS)

Projekat je obučen u [Capacitor](https://capacitorjs.com/) — isti web kod se pakuje u pravu native Android/iOS aplikaciju (`android/` i `ios/` folderi).

### Android

Potreban je [Android Studio](https://developer.android.com/studio) (skida Android SDK sam).

```bash
npm run android:open
```

Ovo build-uje web app i otvara `android/` projekat u Android Studio-u. Tamo klikni **Run** da instaliraš app na povezan telefon/emulator, ili **Build > Build APK(s)** da dobiješ `.apk` fajl za instalaciju.

### iOS

Potreban je Mac sa [Xcode](https://developer.apple.com/xcode/).

```bash
npm run ios:open
```

Otvara `ios/` projekat u Xcode-u. Odatle se pokreće na simulatoru ili povezanom iPhone-u (za instalaciju na pravi uređaj/App Store potreban je Apple Developer nalog).

### Lokacija (GPS)

App koristi [`@capacitor/geolocation`](https://capacitorjs.com/docs/apis/geolocation) za "Moja lokacija" i snimanje vožnje uživo. Dozvole za lokaciju su već dodate:

- Android: `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` u `android/app/src/main/AndroidManifest.xml`
- iOS: `NSLocationWhenInUseUsageDescription` u `ios/App/App/Info.plist`

Prilikom prvog korišćenja app će zatražiti dozvolu od korisnika.

### Nakon izmena u web kodu

Kad god promeniš `src/`, ponovo sinhronizuj native projekte:

```bash
npm run cap:sync
```

### 📦 Preuzimanje gotovog APK-a

Android SDK build alati zahtevaju pristup Google-ovim serverima koji nije dostupan u nekim izolovanim razvojnim okruženjima, pa je build automatizovan preko GitHub Actions-a (`.github/workflows/android-apk.yml`) — svaki push na ovu granu ili `main` automatski build-uje `.apk`.

Gotov APK preuzimaš ovde:

1. Otvori **Actions** tab u repozitorijumu i sačekaj da workflow "Build Android APK" završi (zeleni ✓), ili
2. Otvori **Releases** stranicu repozitorijuma (desno na GitHub-u) — svaki build objavljuje novi release (npr. `apk-12`) sa `.apk` fajlom kao prilogom, spremnim za direktno preuzimanje i instalaciju na telefon (uključi "Instaliraj iz nepoznatih izvora" u Android podešavanjima).
