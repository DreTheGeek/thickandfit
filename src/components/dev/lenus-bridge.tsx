'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

const LENUS_ORIGIN = 'https://us.lenus.io';

type Row = { profileId: string; name: string; ops: number; status: 'ok' | 'failed'; detail?: string };

/**
 * Receives client payloads from the Lenus tab and forwards them to our API.
 *
 * SERIALISED ON PURPOSE. Payloads arrive at whatever rate the extractor produces them, around
 * 170 KB each. Forwarding them concurrently would put dozens of multi-hundred-KB writes in flight
 * at once; a queue keeps memory flat and makes the progress readout mean something. The extractor
 * also waits for an ack per client, so a slow database backs the whole pipeline off rather than
 * dropping data on the floor.
 *
 * ORIGIN IS CHECKED on every message. Any page can postMessage to a window it has a handle to, so
 * without this check a hostile tab could inject rows into her export.
 */
export function LenusBridge(): ReactElement {
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const queue = useRef<MessageEvent[]>([]);
  const draining = useRef(false);

  useEffect(() => {
    async function drain(): Promise<void> {
      if (draining.current) return;
      draining.current = true;
      while (queue.current.length) {
        const ev = queue.current.shift();
        if (!ev) continue;
        const payload = ev.data?.payload;
        const name = payload?.fullName ?? payload?.profileId ?? '?';
        let row: Row;
        try {
          const res = await fetch('/api/internal/lenus-ingest', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await res.json().catch(() => ({}));
          row = res.ok
            ? { profileId: payload.profileId, name, ops: json.stored ?? 0, status: 'ok' }
            : { profileId: payload.profileId, name, ops: 0, status: 'failed', detail: json.error ?? `HTTP ${res.status}` };
        } catch (e) {
          row = { profileId: payload?.profileId ?? '?', name, ops: 0, status: 'failed', detail: String(e).slice(0, 80) };
        }
        setRows((r) => [row, ...r].slice(0, 400));
        // Ack so the extractor advances. Failures are acked too, with ok:false, so one bad client
        // cannot stall the remaining 264: the extractor records it and moves on.
        ev.source?.postMessage?.(
          { type: 'lenus-bridge-ack', profileId: row.profileId, ok: row.status === 'ok', detail: row.detail },
          { targetOrigin: LENUS_ORIGIN } as WindowPostMessageOptions,
        );
      }
      draining.current = false;
    }

    function onMessage(ev: MessageEvent): void {
      if (ev.origin !== LENUS_ORIGIN) return;
      if (ev.data?.type === 'lenus-bridge-ping') {
        ev.source?.postMessage?.({ type: 'lenus-bridge-pong' }, { targetOrigin: LENUS_ORIGIN } as WindowPostMessageOptions);
        setReady(true);
        return;
      }
      if (ev.data?.type !== 'lenus-bridge-payload' || !ev.data?.payload?.profileId) return;
      queue.current.push(ev);
      void drain();
    }

    window.addEventListener('message', onMessage);
    setReady(true);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const ok = rows.filter((r) => r.status === 'ok').length;
  const failed = rows.filter((r) => r.status === 'failed').length;

  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Lenus bridge</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        {ready ? 'Listening' : 'Starting'} for payloads from {LENUS_ORIGIN}. Leave this tab open.
      </p>

      {/* THE EXPORT TAB HAS TO BE OPENED FROM HERE, not the other way round. postMessage needs a
          window handle, and the only handle a page gets for free is window.opener. Opening Lenus
          from this button makes this page its opener, so the extractor can post back without us
          hunting for a reference. It also has to be a real click: window.open() from a script with
          no user gesture is popup-blocked and returns null, which is exactly what happened the
          first time. */}
      <button
        type="button"
        onClick={() => window.open(`${LENUS_ORIGIN}/dashboard/clients`, 'lenusExport')}
        style={{
          marginBottom: 20,
          padding: '10px 18px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: '1px solid currentColor',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Open Lenus export tab
      </button>
      <p style={{ fontSize: 14, marginBottom: 16 }}>
        <strong>{ok}</strong> clients stored
        {failed > 0 && (
          <span style={{ color: '#b00' }}>
            {' · '}
            <strong>{failed}</strong> failed
          </span>
        )}
      </p>
      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
        {rows.map((r, i) => (
          <div key={`${r.profileId}-${i}`} style={{ color: r.status === 'ok' ? 'inherit' : '#b00' }}>
            {r.status === 'ok' ? '✓' : '✗'} {r.name} {r.status === 'ok' ? `(${r.ops} ops)` : `- ${r.detail}`}
          </div>
        ))}
      </div>
    </div>
  );
}
