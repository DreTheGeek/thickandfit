'use client';
// Root error boundary for the marketing/auth/legal routes (the (app) and (coach) segments have their
// own). Prevents an unhandled render error from showing a blank white page. Keeps the user on-brand.
import type { ReactElement } from 'react';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }): ReactElement {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Please try again.</p>
        <button
          onClick={() => reset()}
          style={{
            background: '#5EBE62',
            color: '#000',
            border: 0,
            padding: '0.65rem 1.6rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
