#!/usr/bin/env bash
# scripts/setup-mobile-app.sh — one-time scaffold of the iOS + Android Partner app.
#
# What this does: wraps the ALREADY-LIVE Partner PWA (heseos-bos-psi.vercel.app/partner) in a
# native Capacitor shell, so it can be submitted to the App Store and Google Play as a real app.
# The native shell's WebView just loads the live site — every screen already built
# (components/partner/*) keeps working exactly as-is, nothing is duplicated natively.
#
# Run this from the project root:
#   cd heseos-bos && bash scripts/setup-mobile-app.sh
#
# Needs: Node.js + npm (already on this Mac), and normal internet access (this script installs
# packages from npm — it will NOT run inside Claude's sandboxed shells, only in your own Terminal).
set -euo pipefail

APP_NAME="Heseos Partner"
APP_ID="com.heseos.partner"
SERVER_URL="https://heseos-bos-psi.vercel.app/partner"
BRAND_BG="#060f1c"

if [ ! -f "package.json" ] || ! grep -q '"name": "heseos-bos"' package.json; then
  echo "Run this from the heseos-bos project root (where package.json lives)." >&2
  exit 1
fi

echo "== 1/6  Installing Capacitor =="
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android @capacitor/splash-screen @capacitor/status-bar

echo "== 2/6  Initializing Capacitor project =="
if [ ! -f "capacitor.config.json" ]; then
  npx cap init "$APP_NAME" "$APP_ID" --web-dir=public
else
  echo "capacitor.config.json already exists — skipping cap init."
fi

echo "== 3/6  Writing capacitor.config.json (points the app at the live Vercel site) =="
cat > capacitor.config.json <<CONFIG_EOF
{
  "appId": "$APP_ID",
  "appName": "$APP_NAME",
  "webDir": "public",
  "server": {
    "url": "$SERVER_URL",
    "cleartext": false
  },
  "backgroundColor": "$BRAND_BG",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 800,
      "backgroundColor": "$BRAND_BG",
      "androidScaleType": "CENTER_CROP",
      "showSpinner": false
    },
    "StatusBar": {
      "style": "DARK",
      "backgroundColor": "$BRAND_BG"
    }
  }
}
CONFIG_EOF

echo "== 4/6  Adding the native iOS and Android projects =="
[ -d "ios" ] || npx cap add ios
[ -d "android" ] || npx cap add android

echo "== 5/6  Generating app icons + splash screens from the existing PWA icon =="
mkdir -p assets
cp public/icon-512.png assets/icon.png
cp public/icon-512.png assets/splash.png
cp public/icon-maskable-512.png assets/icon-foreground.png
npx @capacitor/assets generate \
  --iconBackgroundColor "$BRAND_BG" \
  --iconBackgroundColorDark "$BRAND_BG" \
  --splashBackgroundColor "$BRAND_BG" \
  --splashBackgroundColorDark "$BRAND_BG"

echo "== 6/6  Syncing config + assets into the native projects =="
npx cap sync

cat <<DONE_EOF

Done. What got created:
  capacitor.config.json   — points the app at $SERVER_URL
  ios/                    — Xcode project (needs Xcode + your Apple Developer account to build)
  android/                — Android Studio / Gradle project (buildable on this Mac already)
  assets/                 — source icon/splash used to generate every native size

Next steps:
  Android: open the "android" folder in Android Studio, or run
           cd android && ./gradlew bundleRelease
           (you'll need your own release keystore — see the README section this script's
           companion PR adds for the exact keytool command)
  iOS:     needs Xcode, which isn't on this Mac — build via a GitHub Actions macOS runner
           instead (ask Claude to set that CI workflow up next), or on any Mac with Xcode +
           your Apple Developer account.

Nothing here touches your Vercel deployment or the web app itself — this only adds a native
shell around the site that's already live.
DONE_EOF
