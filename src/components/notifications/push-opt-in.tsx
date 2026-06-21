'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from '@/lib/notifications/actions';

type PushState = 'unsupported' | 'default' | 'denied' | 'subscribed' | 'working';

/** Convert a base64url VAPID key into the ArrayBuffer the PushManager expects. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Web push opt-in card. Only rendered when VAPID is configured server-side. Requests permission,
 * subscribes the existing service worker's pushManager, and persists the subscription. Degrades to
 * a disabled state where push is unsupported or denied. In-app notifications are unaffected by any
 * of this.
 */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string }): ReactElement | null {
  const t = useTranslations('app.notifications.push');
  const [state, setState] = useState<PushState>('default');

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    void navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? 'subscribed' : 'default');
    });
  }, []);

  async function subscribe(): Promise<void> {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
      });
      const json = sub.toJSON();
      const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
      const auth = arrayBufferToBase64(sub.getKey('auth'));
      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh,
        auth,
      });
      setState(res.ok ? 'subscribed' : 'default');
    } catch {
      setState('default');
    }
  }

  async function unsubscribe(): Promise<void> {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('default');
    } catch {
      setState('subscribed');
    }
  }

  if (state === 'unsupported') return null;

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-warm/60 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{t('title')}</p>
        <p className="mt-0.5 text-[12px] text-muted">
          {state === 'denied' ? t('blocked') : state === 'subscribed' ? t('on') : t('subtitle')}
        </p>
      </div>
      {state === 'subscribed' ? (
        <button
          type="button"
          onClick={unsubscribe}
          className="flex-none rounded-full border border-line px-4 py-1.5 text-[12px] font-semibold text-ink"
        >
          {t('disable')}
        </button>
      ) : state === 'denied' ? null : (
        <button
          type="button"
          onClick={subscribe}
          disabled={state === 'working'}
          className="flex-none rounded-full bg-accent px-4 py-1.5 text-[12px] font-semibold text-accent-ink disabled:opacity-40"
        >
          {t('enable')}
        </button>
      )}
    </div>
  );
}
