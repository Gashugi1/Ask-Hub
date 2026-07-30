'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

/**
 * Sign in. Not gated by requireRole — this is the one admin path that must
 * work with no session.
 *
 * One message for every failure mode. Distinguishing "no such account" from
 * "wrong password" from "deactivated" would confirm which addresses hold
 * accounts on a UN programme's admin portal, and PRD 14.5 forbids the
 * disclosure. `getCurrentUser()` already makes a deactivated account
 * indistinguishable from no account, so the deactivated case needs no
 * special handling here.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: t('admin.login.failed') };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t('admin.login.failed') };

  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
