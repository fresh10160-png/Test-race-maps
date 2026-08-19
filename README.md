# Race Maps

A Google Maps-style app built for tagging "race" tracks: set a start (A) and finish (B) point on the map, optionally shape the route with extra points, and save the track for later.

## Features

- Interactive map with real streets (Leaflet + OpenStreetMap data, dark "race" theme, no API key needed)
- A/B tagging: set the start (A) and finish (B) point with a tap on the map
- Manually placed routes automatically snap to real roads/paths (via OSRM routing), with a driving/cycling/walking profile picker
- Add extra points to shape the route along the actual track
- Drag the A/B markers to fine-tune their position
- Automatically calculated track length
- Save tracks locally (localStorage) with a name; load and delete saved tracks
- 📍 "My location" button — centers the map on your current position
- 🔴 Live ride recording — tap "start", GPS follows your ride and automatically adds route points, tap "stop" and A/B/route are set automatically
- 📊 Race telemetry — live speed and G-force while recording, plus a session summary (time, avg/max speed, peak G) saved with the track; manually placed routes show an estimated travel time instead
- Collapsible bottom-sheet panel on mobile, so the map takes the full screen like a real map app

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Mobile app (Android / iOS)

The project is wrapped in [Capacitor](https://capacitorjs.com/) — the same web code is packaged into a real native Android/iOS app (`android/` and `ios/` folders).

### Android

Requires [Android Studio](https://developer.android.com/studio) (downloads the Android SDK itself).

```bash
npm run android:open
```

This builds the web app and opens the `android/` project in Android Studio. From there, click **Run** to install the app on a connected phone/emulator, or **Build > Build APK(s)** to get an installable `.apk` file.

### iOS

Requires a Mac with [Xcode](https://developer.apple.com/xcode/).

```bash
npm run ios:open
```

Opens the `ios/` project in Xcode. From there, run it on the simulator or a connected iPhone (installing on a real device / the App Store requires an Apple Developer account).

### Location (GPS)

The app uses [`@capacitor/geolocation`](https://capacitorjs.com/docs/apis/geolocation) for "My location" and live ride recording. The required permissions are already in place:

- Android: `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` in `android/app/src/main/AndroidManifest.xml`
- iOS: `NSLocationWhenInUseUsageDescription` in `ios/App/App/Info.plist`

The app will prompt the user for permission on first use.

Live speed/G-force telemetry uses [`@capacitor/motion`](https://capacitorjs.com/docs/apis/motion) (the device accelerometer). On iOS this needs `NSMotionUsageDescription`, already added to `Info.plist`; Android needs no extra permission.

### After changing the web code

Whenever you change `src/`, re-sync the native projects:

```bash
npm run cap:sync
```

### 📦 Downloading a ready-made APK

Android's SDK build tools need access to Google's servers, which isn't available in some isolated dev environments, so the build is automated with GitHub Actions (`.github/workflows/android-apk.yml`) — every push to this branch or `main` automatically builds an `.apk`.

To get the APK:

1. Open the repo's **Actions** tab and wait for the "Build Android APK" workflow to finish (green ✓), or
2. Open the repo's **Releases** page — every build publishes a new release (e.g. `apk-12`) with the `.apk` attached, ready to download and install on your phone (enable "Install from unknown sources" in Android settings).
