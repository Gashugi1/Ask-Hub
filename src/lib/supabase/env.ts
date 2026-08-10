/**
 * The Supabase URL, read once and normalised, for every client that builds one.
 *
 * Written while diagnosing a Vercel build that died in `generateStaticParams`
 * with PostgREST's own `Invalid path specified in request URL`, from a query
 * against `resources_public`. That error means something answered, so the host
 * resolved; the path it was asked for was not one PostgREST recognised.
 *
 * What the probe actually showed, which is narrower than the obvious theory:
 * `@supabase/supabase-js` already tolerates most malformed values. Given a
 * trailing slash, leading or trailing whitespace, or a trailing newline, it
 * still builds `https://host/rest/v1` correctly. The single case it does not
 * survive is two or more trailing slashes, which yields `https://host//rest/v1`
 * -- a leading empty path segment, which is exactly what produces that error.
 *
 * So a trailing slash pasted into a dashboard is not sufficient to explain that
 * build failure, and this normalisation should not be read as having fixed it.
 * It removes one candidate. The likelier remaining explanations are that the
 * view did not exist on the target project, or that the URL pointed at a
 * project that no longer exists -- a deleted project's hostname can still
 * resolve to Supabase's edge and answer on any path.
 */

/**
 * Strip surrounding whitespace and every trailing slash.
 *
 * Deliberately not a full URL parse-and-rebuild: `new URL(x).origin` would
 * silently discard a path component, and a Supabase URL that has acquired a
 * path is a misconfiguration worth surfacing rather than quietly repairing.
 */
export function normaliseSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Read and normalise `NEXT_PUBLIC_SUPABASE_URL`, or throw naming it.
 *
 * Throws on absent or blank rather than returning an empty string: an empty
 * base URL turns every query into a request against the deployment's own
 * origin, which fails far from the cause.
 */
export function supabaseUrlFromEnv(): string {
  // Named, never valued: this project's rule is that a thrown message may name
  // a variable but must not interpolate its contents.
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || raw.trim() === '') throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return normaliseSupabaseUrl(raw);
}
