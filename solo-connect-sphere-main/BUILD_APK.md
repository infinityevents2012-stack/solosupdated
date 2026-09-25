# Building the SoloS Android APK

Lovable builds the **web app**. To get an installable `.apk`, you wrap that web app with Capacitor and build it on your own machine using Android Studio.

## One-time setup on your machine

1. Install **Node.js 20+**, **Java JDK 21**, and **Android Studio** (Hedgehog or newer).
2. In Android Studio: **SDK Manager → SDK Platforms** → install **Android 14 (API 34)**.
3. Connect this project to GitHub from Lovable (top-right → GitHub → Connect), then `git clone` it locally.

## Each time you want a new APK

```bash
# 1. Pull latest from Lovable / GitHub
git pull

# 2. Install deps
bun install   # or: npm install

# 3. Add the Android platform (only needed the first time)
npx cap add android

# 4. Build the web app + sync to native
bun run build
npx cap sync android

# 5. Open in Android Studio
npx cap open android
```

In Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Output appears in `android/app/build/outputs/apk/debug/app-debug.apk`

For Play Store: **Build → Generate Signed Bundle / APK** (you'll need a keystore).

## Switching between live-reload and bundled mode

`capacitor.config.ts` currently points at the Lovable preview URL — the app loads the live web build, so any change you publish in Lovable shows up after restarting the app. **For a release APK, delete the `server` block** so the APK ships with bundled assets from `dist/`.

## What's already wired

- Camera, Geolocation, Filesystem, Preferences, App, StatusBar, SplashScreen plugins are installed.
- `appId` = `app.solos.connect`, `appName` = `SoloS`.

## What still needs setup before a real launch

These were skipped — add when ready:
- **Real OTP** (Twilio / MSG91)
- **Payments** (Stripe / Razorpay) + webhook for `is_premium`
- **FCM push** (`@capacitor/push-notifications` + `google-services.json`)
- **AdMob rewarded** (`@capacitor-community/admob` + SSV webhook)
- **Permissions** in `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
  ```
