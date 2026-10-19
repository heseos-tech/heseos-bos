# Heseos Installer — native Android app

A thin Capacitor shell around the live web app at `https://heseos-bos-psi.vercel.app/installer`
(same approach as the Partner app in the repo root). It has its **own** `appId`
(`com.heseos.installer`), name, icon, splash screen and Android project, so it installs next to
the Partner app and is published to Google Play as a separate listing.

Because the app just loads the live site, every change to the Installer web screens ships the
moment you deploy to Vercel — a new Play Store build is only needed for native things (icon, name,
permissions, plugins, `versionCode`).

## One-time setup (on your Mac)

```bash
cd installer-app
npm install
npx cap sync android        # copies capacitor.config.ts + www/ into the Android project
```

## Run on a phone / emulator

```bash
npx cap open android        # opens Android Studio → press Run ▶
```

## Release build for Google Play

1. Create a **new** upload keystore for this app (do not reuse the Partner one — Play treats each
   app's signing key separately):

   ```bash
   keytool -genkeypair -v -keystore ~/heseos-installer-release.keystore \
     -alias heseos-installer -keyalg RSA -keysize 2048 -validity 10000
   ```

2. `cp android/keystore.properties.example android/keystore.properties` and fill in the real
   path/passwords. This file is git-ignored — never commit it. Back the keystore file up somewhere
   safe; if it is lost you cannot update the app.

3. Build the bundle:

   ```bash
   npm run bundle
   # → android/app/build/outputs/bundle/release/app-release.aab
   ```

4. Upload the `.aab` in Play Console → your Installer app → Release → Production
   (or Internal testing first). Text for the listing is in `PLAY_STORE_LISTING.md`.

For each later update bump `versionCode` (and `versionName`) in `android/app/build.gradle`.

## Keeping things in sync

- `capacitor.config.ts` → `server.url` and `www/error.html` (the offline page, which has the URL
  hard-coded) must point at the same address.
- Icons/splash were generated from `assets/` (white icon + wrench badge). To regenerate every size
  after changing them: `npx @capacitor/assets generate --iconBackgroundColor "#FFFFFF" --splashBackgroundColor "#060f1c"`.
- iOS isn't set up for the Installer app. When you have Xcode: `npx cap add ios` inside this folder.
