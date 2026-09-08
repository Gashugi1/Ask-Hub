'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';

/**
 * PRD 5.3: copy link, LinkedIn, email and WhatsApp, with editable
 * pre-written text. The default text comes from en.json rather than being
 * written here, so it is policed by the content-rule scan like every other
 * user-facing string and can be translated later.
 */
export default function ShareModal({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(t('share.defaultText'));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const body = `${message}\n\n${title}\n${url}`;

  /**
   * Copying can fail in two ways that both used to be invisible.
   *
   * `navigator.clipboard` is undefined on any non-secure origin except
   * localhost, so the property access below throws a TypeError before the
   * await is ever reached -- a staging deploy on plain http, or an IP address,
   * hits this on every click. And even where the API exists, `writeText`
   * rejects when the document is not focused or permission is denied.
   *
   * Neither is exceptional enough to surface as an error, but neither may be
   * swallowed: the previous version left the label reading "Copy link" with no
   * clipboard write and no explanation. The catch shows the failure and puts
   * the full share text on screen, selected, so the reader can copy it by
   * hand; that fallback needs no permission and no secure context.
   */
  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  // Selecting happens here rather than in the catch because the textarea does
  // not exist until the failed state has rendered.
  useEffect(() => {
    if (copyState !== 'failed') return;
    const fallback = fallbackRef.current;
    if (!fallback) return;
    fallback.focus();
    fallback.select();
  }, [copyState]);

  function close() {
    setOpen(false);
    // Reset, or reopening the panel next time greets the reader with "Link
    // copied" (or a copy failure) for something that never happened.
    setCopyState('idle');
  }

  // The trigger wears the prototype's secondary action (reference line 336):
  // a 1.5px hairline that takes the primary blue on hover, beside the solid
  // apply button.
  if (!open) {
    return (
      <button
        type="button"
        className="proto-outline-button"
        onClick={() => setOpen(true)}
        style={{
          border: '1.5px solid #C9D3E8',
          color: '#1A2332',
          background: '#fff',
          fontSize: 14,
          fontWeight: 700,
          padding: '12px 20px',
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        {t('share.open')}
      </button>
    );
  }

  return (
    <div
      style={{
        background: '#F4F6F9',
        border: '1px solid #DDE5EE',
        borderRadius: 14,
        padding: '18px 20px',
        width: '100%',
      }}
    >
      <h2 className="text-sm font-semibold text-navy">{t('share.title')}</h2>
      <label className="mt-3 block text-sm text-muted">
        <span>{t('share.message')}</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-hairline p-3 text-navy"
          rows={3}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setCopyState('idle');
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-primary underline" onClick={() => void copy()}>
          {copyState === 'copied' ? t('share.copied') : t('share.copyLink')}
        </button>
        <a
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        >
          {t('share.linkedin')}
        </a>
        <a
          className="text-primary underline"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`}
        >
          {t('share.email')}
        </a>
        <a
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(body)}`}
        >
          {t('share.whatsapp')}
        </a>
        <button type="button" className="ml-auto text-muted underline" onClick={close}>
          {t('share.close')}
        </button>
      </div>
      {copyState === 'failed' ? (
        <div className="mt-3 text-sm text-muted">
          <p className="text-danger">{t('share.copyFailed')}</p>
          <textarea
            ref={fallbackRef}
            aria-label={t('share.manualCopy')}
            className="mt-1 w-full rounded-lg border border-hairline p-3 text-navy"
            rows={4}
            readOnly
            value={body}
          />
        </div>
      ) : null}
    </div>
  );
}
