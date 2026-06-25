'use client';
// Last-resort boundary: catches errors thrown in the ROOT layout itself (where the normal error.tsx
// can't render). Must supply its own <html>/<body>. Guarantees the app never serves a blank document.
import type { ReactElement } from 'react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }): ReactElement {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#000',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>Please reload the page.</p>
          <button
            onClick={() => reset()}
            style={{
              background: '#5EBE62',
              color: '#000',
              border: 0,
              padding: '0.65rem 1.6rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
