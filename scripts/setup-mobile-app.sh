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
#
# Safe to re-run: each step is skipped if already done.
set -euo pipefail

APP_NAME="Heseos Partner"
APP_ID="com.heseos.partner"
SERVER_URL="https://heseos-bos-psi.vercel.app/partner"
BRAND_BG="#060f1c"

if [ ! -f "package.json" ] || ! grep -q '"name": "heseos-bos"' package.json; then
  echo "Run this from the heseos-bos project root (where package.json lives)." >&2
  exit 1
fi

echo "== 1/7  Installing Capacitor =="
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android @capacitor/splash-screen @capacitor/status-bar

echo "== 2/7  Creating a minimal native web-assets folder (www/) =="
# Capacitor's own copy step needs a real index.html to exist locally, even though server.url
# below overrides it at runtime with the live site — this is just that required placeholder,
# shown for a split second before the WebView redirects, never the real app.
mkdir -p www
cat > www/index.html <<'HTML_EOF'
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Heseos Partner</title>
<style>html,body{margin:0;height:100%;background:#060f1c}</style></head>
<body></body>
</html>
HTML_EOF

echo "== 3/7  Initializing Capacitor project (if not already) =="
if [ ! -f "capacitor.config.ts" ] && [ ! -f "capacitor.config.json" ]; then
  npx cap init "$APP_NAME" "$APP_ID" --web-dir=www
fi
# Whichever config file `cap init` created (or a re-run left behind), we always overwrite
# capacitor.config.ts as the single source of truth below and remove the other, so there's
# never ambiguity about which one Capacitor is actually reading.
rm -f capacitor.config.json

echo "== 4/7  Writing capacitor.config.ts (points the app at the live Vercel site) =="
cat > capacitor.config.ts <<CONFIG_EOF
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '$APP_ID',
  appName: '$APP_NAME',
  webDir: 'www',
  server: {
    url: '$SERVER_URL',
    cleartext: false,
  },
  backgroundColor: '$BRAND_BG',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '$BRAND_BG',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '$BRAND_BG',
    },
  },
};

export default config;
CONFIG_EOF

echo "== 5/7  Adding the native iOS and Android projects =="
[ -d "ios" ] || npx cap add ios
[ -d "android" ] || npx cap add android

echo "== 6/7  Generating app icons + splash screens from the existing PWA icon =="
mkdir -p assets
cp public/icon-512.png assets/icon.png
cp public/icon-512.png assets/splash.png
cp public/icon-maskable-512.png assets/icon-foreground.png
npx @capacitor/assets generate \
  --iconBackgroundColor "$BRAND_BG" \
  --iconBackgroundColorDark "$BRAND_BG" \
  --splashBackgroundColor "$BRAND_BG" \
  --splashBackgroundColorDark "$BRAND_BG"

echo "== 7/7  Syncing config + assets into the native projects =="
npx cap sync

cat <<DONE_EOF

Done. What got created:
  capacitor.config.ts    — points the app at $SERVER_URL
  www/                   — placeholder web assets (never the real app — server.url overrides it)
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
