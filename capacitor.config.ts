import type { CapacitorConfig } from "@capacitor/cli";

// The iOS and Android apps are native shells around the live site: every screen, server function
// and the Supabase database are the same ones the web uses, so a Vercel deploy updates the apps
// too. Native behaviour (back button, deep links, external links, splash, keyboard) lives in
// src/components/icoach/native-bridge.tsx. Build steps: docs/mobile-apps.md.
//
// ICOACH_APP_URL points a build at another deployment (e.g. a preview) without editing this file.
const appUrl = process.env["ICOACH_APP_URL"] ?? "https://i-coach.vercel.app";
const background = "#1b1b1e";

const config: CapacitorConfig = {
  appId: "com.icoach.performance",
  appName: "iCoach",
  // Only the offline page ships inside the app (server.errorPath); everything else is live.
  webDir: "mobile/www",
  backgroundColor: background,
  // Lets the server and analytics recognise the app; the web code checks window.Capacitor.
  appendUserAgent: "iCoachApp/1.0",
  server: {
    url: appUrl,
    // The app's front door: signed-in accounts go straight to their dashboard.
    appStartPath: "/app",
    errorPath: "offline.html",
    cleartext: false,
  },
  android: {
    backgroundColor: background,
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: background,
    contentInset: "never",
    preferredContentMode: "mobile",
    allowsLinkPreview: false,
  },
  plugins: {
    SystemBars: {
      // Light status-bar icons on the dark app; the page pads itself with env(safe-area-*).
      style: "DARK",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    SplashScreen: {
      // Hidden by the web app as soon as it is ready; this is only the upper bound.
      launchShowDuration: 6000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: background,
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      resize: "native",
      style: "DARK",
    },
  },
};

export default config;
