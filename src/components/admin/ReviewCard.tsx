'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { approveAndPublishSubmission, rejectSubmission } from '@/lib/actions/submissions';
import type { ReviewSubmission } from '@/lib/admin/types';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_ERROR, ADMIN_HELP } from './chrome';

/** A fixed locale and zone so the server render and hydration agree (see TeamAccessCard). */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const BADGE = {
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 10px',
  borderRadius: 99,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const;

const PRIMARY = {
  background: '#0E7A54',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

const SECONDARY = {
  display: 'inline-block',
  border: '1.5px solid #C9D3E8',
  background: '#fff',
  color: '#1F5FBF',
  borderRadius: 8,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

const DANGER = {
  background: 'none',
  border: 'none',
  color: '#C0392B',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  padding: '9px 10px',
} as const;

/**
 * One queue entry, in the prototype's card: a type badge, the title, the
 * date on the right, the description, "Submitted by", then the buttons
 * that type gets -- a new resource offers Approve & publish, Edit first
 * and Reject; an update suggestion offers Open resource to edit and
 * Reject. The prototype's owner and tri-state selects are not here: the
 * queue uses PRD 4.5's three statuses, and a card leaves the screen when
 * it stops being pending.
 *
 * Mounted only by `/admin/review`, which `requirePageRole`s admin and
 * editor, so there is no read-only branch.
 */
export default function ReviewCard({ submission }: { submission: ReviewSubmission }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const isNew = submission.type === 'new_resource';

  function approve() {
    setNotice(null);
    startTransition(async () => {
      try {
        const outcome = await approveAndPublishSubmission(submission.id);
        if (outcome.ok) {
          setNotice({ tone: 'ok', text: t('admin.review.approved') });
          router.refresh();
        } else {
          setNotice({ tone: 'error', text: t(`admin.review.refused.${outcome.reason}`) });
        }
      } catch {
        setNotice({ tone: 'error', text: t('admin.error.generic') });
      }
    });
  }

  function reject() {
    setNotice(null);
    startTransition(async () => {
      try {
        const outcome = await rejectSubmission(submission.id);
        setNotice(
          outcome.ok
            ? { tone: 'ok', text: t('admin.review.rejected') }
            : { tone: 'error', text: t('admin.review.refused.notPending') },
        );
        router.refresh();
      } catch {
        setNotice({ tone: 'error', text: t('admin.error.generic') });
      }
    });
  }

  return (
    <article style={ADMIN_PANEL} aria-labelledby={`submission-${submission.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            ...BADGE,
            background: isNew ? '#E7F4EE' : '#EAEFFB',
            color: isNew ? '#0E7A54' : '#1F5FBF',
          }}
        >
          {t(isNew ? 'admin.review.badge.new' : 'admin.review.badge.update')}
        </span>
        <h2 id={`submission-${submission.id}`} style={{ margin: 0, fontSize: 15.5, fontWeight: 800 }}>
          {submission.resourceName}
        </h2>
        <span style={{ fontSize: 12, color: '#5B6B8C', marginLeft: 'auto' }}>
          {shortDate(submission.createdAt)}
        </span>
      </div>

      {!isNew && submission.targetResourceName ? (
        <p style={{ ...ADMIN_HELP, margin: '8px 0 0 0' }}>
          {t('admin.review.targetResource', { name: submission.targetResourceName })}
        </p>
      ) : null}

      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#42506E', margin: '10px 0 0 0', whiteSpace: 'pre-line' }}>
        {submission.description}
      </p>

      <dl
        style={{
          margin: '10px 0 0 0',
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gap: '4px 12px',
          fontSize: 12.5,
          color: '#42506E',
        }}
      >
        {submission.organisation ? (
          <>
            <dt style={{ fontWeight: 800, color: '#5B6B8C' }}>{t('admin.review.meta.organisation')}</dt>
            <dd style={{ margin: 0 }}>{submission.organisation}</dd>
          </>
        ) : null}
        {submission.need ? (
          <>
            <dt style={{ fontWeight: 800, color: '#5B6B8C' }}>{t('admin.review.meta.need')}</dt>
            <dd style={{ margin: 0 }}>{t(`need.${submission.need}`)}</dd>
          </>
        ) : null}
        {submission.link ? (
          <>
            <dt style={{ fontWeight: 800, color: '#5B6B8C' }}>{t('admin.review.meta.link')}</dt>
            <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
              <a href={submission.link} target="_blank" rel="noopener noreferrer" style={{ color: '#1F5FBF' }}>
                {submission.link}
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      <p style={{ ...ADMIN_HELP, margin: '8px 0 0 0' }}>
        {t('admin.review.submittedBy', {
          name: submission.submitterName ?? submission.submitterEmail,
          email: submission.submitterEmail,
        })}
        {submission.programmeContactEmail
          ? ` · ${t('admin.review.programmeContact', { email: submission.programmeContactEmail })}`
          : ''}
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {isNew ? (
          <>
            <button type="button" disabled={pending} onClick={approve} style={PRIMARY}>
              {t('admin.review.approve')}
            </button>
            <Link href={`/admin/resources/new?submission=${submission.id}`} style={SECONDARY}>
              {t('admin.review.editFirst')}
            </Link>
          </>
        ) : submission.targetResourceId ? (
          <Link
            href={`/admin/resources/${submission.targetResourceId}?submission=${submission.id}`}
            style={SECONDARY}
          >
            {t('admin.review.openResource')}
          </Link>
        ) : null}
        <button type="button" disabled={pending} onClick={reject} style={DANGER}>
          {t('admin.review.reject')}
        </button>
        <span
          role="status"
          aria-live="polite"
          style={notice?.tone === 'error' ? ADMIN_ERROR : { ...ADMIN_HELP, color: '#0E7A54', fontWeight: 700 }}
        >
          {notice?.text ?? ''}
        </span>
      </div>
    </article>
  );
}
