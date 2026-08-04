'use client';
// Starts the native shell once, when the app opens inside iOS.
//
// Renders nothing. It exists because the shell needs a moment after the webview paints to hide the
// splash, set the status bar, wire resume-reload, and ask for push. Doing that from a component
// keeps it inside React's lifecycle rather than a script racing hydration.
//
// ON THE WEB THIS IS A NO-OP. isNative() is false, every call returns immediately, and the Capacitor
// packages are never imported, so nothing reaches the browser bundle. That property is the whole
// reason the bridge uses lazy imports; if you ever make one of them static, check the bundle.
import { useEffect } from 'react';
import { initShell, registerPush, isNative } from '@/lib/native/bridge';

export function NativeBoot(): null {
  useEffect(() => {
    if (!isNative()) return;
    void initShell();

    // Push is asked for a beat AFTER the app opens, not during launch. iOS only lets you ask once
    // per install, and a permission sheet on top of a splash screen is the reliable way to get a no.
    // By the time this fires she is looking at her own dashboard and the ask has context.
    const t = window.setTimeout(() => void registerPush(), 4000);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
