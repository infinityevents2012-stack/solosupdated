import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.solos.connect",
  appName: "SoloS",
  webDir: "dist",
  // Hot-reload from Lovable preview during dev. Remove `server` block before
  // producing a release APK so the app loads bundled assets from `dist/`.
  server: {
    url: "https://solo-connect-sphere.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b0b0f",
      showSpinner: false,
    },
  },
};

export default config;
