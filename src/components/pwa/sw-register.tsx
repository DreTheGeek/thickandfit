'use client';
import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
        console.warn('sw register:', e instanceof Error ? e.message : e);
      });
    }
  }, []);
  return null;
}
