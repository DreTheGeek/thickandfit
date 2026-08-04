'use client';
// The line between the website and the iOS app.
//
// The app is the same Next.js site running inside a native WKWebView, so every function here has to
// answer the same question: are we native right now, and if not, get out of the way completely. The
// web experience must be byte-for-byte what it was before Capacitor existed. That is why every plugin
// is imported LAZILY, inside the call, and after the isNative() guard.
//
// Precisely what that buys, since it is easy to overstate: the bundler still EMITS a chunk for each
// plugin, and you will find them on disk in .next/static/chunks. A web browser never downloads them,
// because the dynamic import sits behind a guard that returns first on web, so the request is never
// made. Moving any of these to a static import would change that from "emitted but never fetched" to
// "in everyone's bundle", so do not.
//
// Nothing here throws. A native capability that fails should degrade to the web behaviour, never
// break the screen a member is standing in.

let cachedNative: boolean | null = null;

/** True only inside the iOS shell. Cached: the answer cannot change within a session. */
export function isNative(): boolean {
  if (cachedNative !== null) return cachedNative;
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  cachedNative = Boolean(cap?.isNativePlatform?.());
  return cachedNative;
}

/**
 * Take a photo of a meal with the real camera.
 *
 * THIS IS THE FEATURE, not a nicety. Photo-to-macro is the thing this product is better at than its
 * competitors, and on the web it runs through a file input: two taps, a system sheet, no preview,
 * and on some iOS versions an image the browser has already recompressed. Native gives a real camera
 * with a live preview and control over the encoding we hand the model.
 *
 * Returns a data URL so the existing scan path is unchanged, or null to mean "fall back to the web
 * file input", which includes the case where she simply cancelled.
 */
export async function capturePhoto(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      // The scan downscales anyway; sending a 12MP original just costs her upload time on cellular.
      width: 1600,
      correctOrientation: true,
      promptLabelHeader: 'Log a meal',
      promptLabelPhoto: 'Choose from photos',
      promptLabelPicture: 'Take a photo',
    });
    return photo.dataUrl ?? null;
  } catch {
    // Cancelled, or permission refused. Both mean "do nothing", not "show an error".
    return null;
  }
}

/**
 * Register for push, and hand the token to the server.
 *
 * The other genuine reason this app exists natively. Web push on iOS requires the member to have
 * added the site to her home screen, silently does nothing if she has not, and cannot be relied on
 * for a check-in reminder. Native push is the difference between a reminder system that works and one
 * that works for some people.
 */
export async function registerPush(): Promise<{ registered: boolean }> {
  if (!isNative()) return { registered: false };
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const current = await PushNotifications.checkPermissions();
    let status = current.receive;
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await PushNotifications.requestPermissions()).receive;
    }
    if (status !== 'granted') return { registered: false };

    // Registration is asynchronous and answers on an event, not a promise.
    PushNotifications.addListener('registration', (token) => {
      void fetch('/api/native/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value, platform: 'ios' }),
      }).catch(() => {});
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('push registration:', err);
    });
    // A tapped notification should land on the thing it is about, not the home screen.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const link = (action.notification.data as { link?: string } | undefined)?.link;
      if (link && link.startsWith('/')) window.location.assign(link);
    });

    await PushNotifications.register();
    return { registered: true };
  } catch (e) {
    console.error('registerPush:', e instanceof Error ? e.message : e);
    return { registered: false };
  }
}

/** A short tap. Used where the web app already gives visual feedback and the phone can do better. */
export async function tapFeedback(kind: 'light' | 'success' | 'warning' = 'light'): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'light') await Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    /* haptics are decoration; never surface a failure */
  }
}

/**
 * One-time shell setup: status bar, splash, and reload-on-resume.
 *
 * The resume behaviour matters more than it sounds. A member leaves the app open for three days, iOS
 * freezes the webview, she opens it and sees Tuesday's numbers. Reloading when she has been away long
 * enough is the difference between an app that is stale and one that is wrong.
 */
export async function initShell(): Promise<void> {
  if (!isNative()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor/app'),
    ]);

    // The app ships light-first on a warm cream ground, so the status bar wants dark glyphs.
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    await SplashScreen.hide().catch(() => {});

    let backgroundedAt = 0;
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt = Date.now();
        return;
      }
      // 30 minutes. Long enough that switching to Messages and back does not reload under her, short
      // enough that a day-old dashboard never renders as today.
      if (backgroundedAt && Date.now() - backgroundedAt > 30 * 60 * 1000) {
        window.location.reload();
      }
    });

    // The hardware-free equivalent of a back button: iOS swipe-back inside a webview does nothing by
    // default, so wire it to real history.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
    });
  } catch (e) {
    console.error('initShell:', e instanceof Error ? e.message : e);
  }
}
