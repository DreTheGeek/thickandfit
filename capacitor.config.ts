import type { CapacitorConfig } from '@capacitor/cli';

// The iOS shell.
//
// WHY IT POINTS AT THE LIVE SERVER RATHER THAN BUNDLING FILES. 156 routes in this app force dynamic
// rendering, and auth is Supabase cookies resolved server-side on every request. There is no static
// export to bundle, and there is not going to be one: making it exportable would mean giving up
// server-side auth, which is the thing keeping tenant isolation honest.
//
// So the shell loads www.teamthickandfit.com in a native WKWebView, and Capacitor injects the native
// plugins into it. Members get one codebase, one deploy, and an app that is never a version behind
// the website.
//
// THE RISK THIS CREATES, stated plainly because it decides whether the app ships. App Store Review
// Guideline 4.2 rejects apps that are "simply a web site bundled as an app". A shell that only loads
// a URL is exactly that. The answer is that this one does not only load a URL: it takes photos with
// the native camera, receives real push notifications, and uses haptics and native status bar
// handling. Those are in src/lib/native/, they are real, and they are the argument at review.
//
// If review pushes back anyway, the fallback is to bundle the marketing and offline shell locally and
// keep only the authed app remote, which is a well-trodden pattern. Do not respond by adding fake
// native features.
const config: CapacitorConfig = {
  appId: 'com.teamthickandfit.app',
  appName: 'Thick & Fit',
  // Present but unused while server.url is set. Kept so `cap sync` has somewhere to look and so the
  // local-bundle fallback above is a config change rather than a rebuild.
  webDir: 'public',

  server: {
    url: 'https://www.teamthickandfit.com',
    // The app is HTTPS-only and HSTS-preloaded, so cleartext must stay off.
    cleartext: false,
    // Anything not on this list opens in the system browser instead of inside the app, which is both
    // the Apple expectation and what stops a member losing her session on an outbound link.
    allowNavigation: ['www.teamthickandfit.com', 'teamthickandfit.com', '*.supabase.co'],
  },

  ios: {
    // The brand ground colour, so the gap during rotation and rubber-band scroll is not white.
    backgroundColor: '#e7e5df',
    // Members are logged in for months. Persisting the WKWebView cookie store is what stops the app
    // signing everyone out whenever iOS reclaims memory.
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0f0f0f',
      showSpinner: false,
      // The web app takes over the moment it paints; a longer splash is just a slower app.
      launchAutoHide: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
