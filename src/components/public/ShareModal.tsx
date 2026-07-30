'use client';

import { useState } from 'react';
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
  const [copied, setCopied] = useState(false);

  const body = `${message}\n\n${title}\n${url}`;

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-lg border border-hairline px-4 py-2 text-sm text-navy"
        onClick={() => setOpen(true)}
      >
        {t('share.open')}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-tint-2 p-4">
      <h2 className="text-sm font-semibold text-navy">{t('share.title')}</h2>
      <label className="mt-3 block text-sm text-muted">
        <span>{t('share.message')}</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-hairline p-3 text-navy"
          rows={3}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setCopied(false);
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-primary underline" onClick={() => void copy()}>
          {copied ? t('share.copied') : t('share.copyLink')}
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
        <button
          type="button"
          className="ml-auto text-muted underline"
          onClick={() => setOpen(false)}
        >
          {t('share.close')}
        </button>
      </div>
    </div>
  );
}
