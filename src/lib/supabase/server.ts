import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Request-scoped client carrying the caller's session from httpOnly cookies
 * (PRD 14.3 — not the browser's local storage). On the anon key, so every query is subject
 * to RLS as that user. This is what server components and server actions use
 * to read on a user's behalf.
 */
export async function createServerSupabase() {
  // Named, not valued. Never interpolate a key into a thrown message.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  const cookieStore = await cookies();
  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Thrown when called during a Server Component render, where the
            // cookie store is read-only. Swallowing it is correct: src/proxy.ts
            // refreshes the session on every request, so the write is redundant
            // here rather than lost.
          }
        },
      },
    },
  );
}
