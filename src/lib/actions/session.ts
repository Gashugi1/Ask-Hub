'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { createPublicSupabase } from '@/lib/public/client';
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

const resetRequest = z.object({
  email: z.string().trim().email().max(320),
});

/**
 * Ask Supabase Auth to email a password-recovery link. Not gated by
 * requireRole -- like signIn, its caller has no session by definition.
 *
 * **Always resolves to the same "done" state**, whatever happened. PRD 14.4:
 * the reset flow must not disclose whether an account exists. Supabase
 * itself says nothing for an unknown address, but its errors are not
 * uniform -- an email rate limit trips only when an email was actually
 * sent, so surfacing "too many requests" for one address and silence for
 * another would confirm which one has an account. So every outcome, the
 * malformed-address one included, is reported to the screen as the same
 * sentence, and a genuine failure is logged where an operator can see it.
 * The cost is deliberate: a person who mistypes their address is told the
 * link is on its way and has to notice it never arrives.
 *
 * The link lands on /admin/set-password with the session in the URL
 * fragment, exactly as an invitation does (SetPasswordForm explains why the
 * fragment and not a token the server checks). That is why the request goes
 * through the sessionless `createPublicSupabase` client and not the
 * request-scoped SSR one: the SSR client forces the PKCE flow, which stores
 * a code verifier in *this* browser's cookies and sends back a `?code=`
 * that only this browser can exchange -- a reset requested on a laptop and
 * opened on a phone would be told the link is invalid. The plain client's
 * implicit flow returns the fragment, which works from any device, and
 * nothing about the request needs a session anyway. The redirect is derived from
 * the request's own host for the reason inviteUser gives: a reset requested
 * on a preview deployment lands back on that preview. Supabase refuses any
 * host not on the project's redirect allow-list, so a spoofed Host header
 * can only make the link fall back to site_url.
 *
 * Rate limiting is Supabase's: `[auth.rate_limit] email_sent` per hour
 * project-wide and `[auth.email] max_frequency` per address (config.toml),
 * plus the recovery token being single-use and expiring with `otp_expiry`.
 */
export async function requestPasswordReset(formData: FormData): Promise<{ done: true }> {
  const parsed = resetRequest.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { done: true };

  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const redirectTo = host ? `${proto}://${host}/admin/set-password` : undefined;

  const supabase = createPublicSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error) {
    // The address is deliberately not logged beside the failure: a server
    // log is not the place for a list of who asked to reset a password.
    console.error(`requestPasswordReset: ${error.message}`);
  }
  return { done: true };
}
