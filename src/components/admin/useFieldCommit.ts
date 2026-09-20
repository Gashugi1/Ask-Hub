'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type CommitStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

/** How long "Saved" stays on screen before the field goes quiet again. */
const SAVED_FOR_MS = 2500;

/**
 * The save-on-commit behaviour every Settings card shares: a field writes
 * when the operator leaves it (blur, or Enter on a single-line input), not
 * on a Save button and never per keystroke.
 *
 * The prototype has no Save buttons on Settings -- a change is the change --
 * and that is transcribed. What is not transcribed is its save-on-every-
 * keystroke, because here every committed edit is one `audit_log` row
 * (0018_audit_triggers.sql), and a title typed letter by letter would be
 * thirty rows for one edit. Blur is the moment the operator has finished.
 *
 * `commit` runs the write inside a transition so the field can show a
 * pending state; on success the router refreshes so the server-rendered
 * cards around it reflect the new value, and "Saved" shows for a moment.
 * `fail` is for a value refused before any write -- the card's own
 * validation -- so the message reaches the same status slot.
 */
export function useFieldCommit(): {
  status: CommitStatus;
  pending: boolean;
  commit: (write: () => Promise<void>) => void;
  fail: (message: string) => void;
} {
  const [status, setStatus] = useState<CommitStatus>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(write: () => Promise<void>) {
    setStatus({ kind: 'idle' });
    startTransition(async () => {
      try {
        await write();
        setStatus({ kind: 'saved' });
        router.refresh();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus({ kind: 'idle' }), SAVED_FOR_MS);
      } catch {
        setStatus({ kind: 'error', message: '' });
      }
    });
  }

  return {
    status,
    pending,
    commit,
    fail: (message) => setStatus({ kind: 'error', message }),
  };
}
