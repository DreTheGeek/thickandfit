'use client';

// Talk instead of typing, on any text field.
//
// WHY THIS EXISTS. Stephanie asked for it on 2026-08-13 and it is the one thing in that whole call
// she audibly thanked us for: "thanks for adding the voice to text." The screen it unblocks is the
// coach interview, which is how the AI learns to answer AS her — the single highest-value thing she
// can give this product and the one she is least likely to sit down and type. She said it herself
// on the same call: she is slammed, she is behind on her own homework, and she talks to ChatGPT all
// day. Rodney's shape was per-box dictation rather than one big recorder, which is what this is.
//
// PROGRESSIVE ENHANCEMENT, not a dependency. The Web Speech API is real in Chrome, Edge and Safari
// and absent in Firefox. When it is absent this renders NOTHING: the textarea beside it keeps
// working exactly as before, and she never sees a button that does nothing. No library, no upload,
// no audio leaves the device beyond what the browser's own engine does.
//
// APPENDS, NEVER REPLACES. Speech recognition mishears, and a field that wipes what she already
// typed the moment the engine returns something wrong is a field she will not use twice.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

// Minimal local shape. The DOM lib's SpeechRecognition typings are inconsistent across TS versions
// and the vendor-prefixed constructor is not in them at all, so this describes only what is used.
type SpeechResultAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechResultAlternative; length: number };
type SpeechEvent = { resultIndex: number; results: { length: number } & Record<number, SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Module-level so useSyncExternalStore sees stable identities. Inline arrows would be new functions
// on every render, which makes React tear down and re-subscribe each time for no reason.
const noopSubscribe = (): (() => void) => () => {};
const isSupported = (): boolean => recognitionCtor() !== null;
const notSupportedOnServer = (): boolean => false;

export function DictateButton({
  value,
  onAppend,
  className,
}: {
  /** Current field value, so appended speech lands after it with sensible spacing. */
  value: string;
  onAppend: (next: string) => void;
  className?: string;
}): ReactElement | null {
  const t = useTranslations('app.common');
  const locale = useLocale();
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  // The live value, so the result handler appends to what is in the box NOW rather than to whatever
  // it was when recognition started. Without this, a long dictation overwrites its own earlier
  // words. Synced in an effect rather than during render: a ref write during render is exactly the
  // tearing hazard the React lint rule is about, and here the handler only ever runs after commit.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Feature detection with a server snapshot of `false`, which is the textbook use for this hook and
  // the reason it is here rather than a useState + useEffect pair: the server has no window, so the
  // button must not exist in the HTML, and React reconciles the difference without a hydration
  // mismatch or a cascading render. Support never changes during a session, hence the no-op
  // subscribe.
  const supported = useSyncExternalStore(noopSubscribe, isSupported, notSupportedOnServer);

  const stop = useCallback((): void => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  // Recognition holds a microphone. Leaving one running when the component unmounts keeps the
  // browser's recording indicator lit on a page she has already left.
  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback((): void => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    // es-MX rather than es-ES: her audience and her assistant are Mexican, and the engine's
    // vocabulary and accent model differ enough to matter on fitness words.
    rec.lang = locale === 'es' ? 'es-MX' : 'en-US';
    // continuous, because an answer about her coaching philosophy is a paragraph, not a phrase, and
    // an engine that stops at the first pause turns one thought into six button presses.
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechEvent): void => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        // FINAL results only. Appending interim ones duplicates every word as the engine revises.
        if (r?.isFinal) finalText += r[0].transcript;
      }
      if (!finalText.trim()) return;
      const current = valueRef.current;
      const needsSpace = current.length > 0 && !/\s$/.test(current);
      onAppend(`${current}${needsSpace ? ' ' : ''}${finalText.trim()}`);
    };
    // Both paths reset the button. A mic that looks live but is not is worse than one that stopped:
    // she keeps talking into nothing.
    rec.onerror = (): void => stop();
    rec.onend = (): void => setListening(false);

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      // start() throws if one is already running. Treat it as "already listening", not an error.
      setListening(true);
    }
  }, [locale, onAppend, stop]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-pressed={listening}
      aria-label={listening ? t('dictateStop') : t('dictateStart')}
      title={listening ? t('dictateStop') : t('dictateStart')}
      className={[
        'tf-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
        listening
          ? 'border-alert-ink bg-alert text-alert-ink'
          : 'border-line text-muted hover:border-ink hover:text-ink',
        className ?? '',
      ].join(' ')}
    >
      <Icon name={listening ? 'pulse' : 'mic'} size={14} />
      {listening ? t('dictateStop') : t('dictateStart')}
    </button>
  );
}
