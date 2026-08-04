# The iOS app

The App Store build. Everything that can be done without a Mac is done and committed; what is left
needs Xcode.

---

## What this is

A native iOS shell that loads `www.teamthickandfit.com` in a WKWebView, with real native plugins
injected into it.

**Why a shell and not a rewrite.** 156 routes force dynamic rendering and auth is Supabase cookies
resolved server-side on every request. There is no static export to bundle and there is not going to
be one, because making it exportable means giving up server-side auth, which is what keeps tenant
isolation honest. The shell means one codebase, one deploy, and an app that is never a version behind
the site.

**The risk that decides whether it ships.** Guideline 4.2 rejects apps that are "simply a web site
bundled as an app". The answer is that this one is not: native camera on the meal scan, real APNs push,
haptics, native status bar, and reload-on-resume. That is the argument at review, and it is true.
If review pushes back anyway, the fallback is bundling the marketing and offline shell locally while
keeping the authed app remote. **Do not respond by inventing fake native features.**

---

## Already done, in this repo

- `capacitor.config.ts` at the root: app id `com.teamthickandfit.app`, server URL, allowed navigation.
- `ios/` scaffolded with 7 plugins: app, browser, camera, haptics, push-notifications, splash-screen,
  status-bar.
- `src/lib/native/bridge.ts`: every native capability, each behind an `isNative()` guard and a lazy
  import, so the web app is byte-for-byte unchanged.
- `src/components/app/native-boot.tsx`: mounted in the app layout. Hides the splash, sets the status
  bar, wires resume-reload, asks for push four seconds in.
- The meal scan uses the native camera when it is there and the file input when it is not.
- `POST /api/native/push-token` stores the APNs token, bound to the caller's session.
- Migration `0112`: `push_subscriptions` holds both Web Push and APNs rows, with a shape check so a
  half-written row cannot look reachable.
- `Info.plist` purpose strings for camera and photos. Apple rejects a camera build without them, and
  the text is shown to the member verbatim.
- `App.entitlements` with `aps-environment`.

---

## What needs a Mac

### 1. Open it

```bash
pnpm install
npx cap sync ios
npx cap open ios
```

`cap sync` runs CocoaPods, which is why it has to happen on macOS.

### 2. Signing

Xcode, target **App**, **Signing & Capabilities**:

- Team: the Thick &amp; Fit business account. Business enrolment is what the D-U-N-S number is for.
- Bundle identifier: `com.teamthickandfit.app`. It must match `capacitor.config.ts` and App Store
  Connect exactly, and it can never be changed after first submission.
- **+ Capability, Push Notifications.** Add it through this panel rather than editing the entitlements
  file, so Xcode swaps `aps-environment` to `production` for release builds by itself.

### 3. Icons

`@capacitor/assets` needs `sharp`, which does not load on the Windows Node this repo was set up on, so
the icons were not generated here. On the Mac:

```bash
npx @capacitor/assets generate --ios
```

It reads `assets/icon.png` (already committed, 512px). **Supply a 1024x1024 icon and a 2732x2732
splash before running it**, or you ship an upscaled 512 and Apple rejects the icon for quality.

### 4. APNs key, for push to actually send

Storing tokens works today. Sending does not, and needs:

1. Apple Developer, Certificates &amp; Identifiers, Keys, **+**, tick Apple Push Notifications service.
2. Download the `.p8` **once**. It cannot be downloaded again.
3. Note the Key ID and the Team ID.
4. Add them as Vercel env vars, then write the APNs sender alongside the existing Web Push one in
   `src/lib/notifications/push.ts`. It branches on `push_subscriptions.platform`.

### 5. Test on a real device before TestFlight

The simulator cannot receive push and its camera is fake. Both native features need a physical phone.

Check, in order:

- The app opens straight into the site and the splash hides.
- Sign in works and **survives force-quitting the app**. If it does not, the WKWebView cookie store is
  not persisting and nothing else matters.
- The meal scan opens the **native camera sheet**, not a file picker.
- The push permission sheet appears about four seconds after opening.
- After granting it, a row appears: `select * from push_subscriptions where platform = 'ios'`.
- Background the app for over 30 minutes, reopen, confirm it reloads rather than showing stale numbers.
- An outbound link opens in Safari rather than replacing the app.

### 6. App Store Connect

- Create the app with the same bundle id.
- **Privacy nutrition labels.** Be accurate: health and fitness data, photos, email, usage. Getting
  this wrong is a rejection and a trust problem.
- Screenshots for 6.7" and 6.5". Real screens, not mockups.
- Support URL: `https://www.teamthickandfit.com/support`. Privacy policy:
  `https://www.teamthickandfit.com/privacy`. Both are live.
- **Answer the subscription question before submitting.** See below.

---

## The thing to decide before submitting

**Apple takes 15 to 30 percent of subscriptions sold inside an iOS app**, and guideline 3.1.1 is the
most common reason a subscription app is rejected. On $19.97 a month that is real money.

The options, in increasing order of risk:

1. **Sell only on the web, and the app never mentions buying.** No IAP, no link, no "subscribe"
   button. Members who already pay just sign in. Lowest risk, and what most coaching apps do at first.
2. **Add StoreKit in-app purchase** for iOS members, and wear the cut. Highest conversion on iOS,
   most work, and prices have to be reconciled with the web.
3. **External purchase link entitlement.** Available in some regions post-Epic, still takes a cut,
   and carries the most rules to get wrong.

**Option 1 is the one to launch with.** It is the least work, the least risk at review, and it can be
revisited once the app is live. It does mean the app must not contain a purchase call to action on
iOS, which is a real product constraint worth knowing before the copy is written.

---

## When the site changes

Nothing to do. The shell loads the live site, so a Vercel deploy updates the app.

A new build is only needed when something in `ios/`, `capacitor.config.ts`, the plugin list, or the
native bridge changes.
