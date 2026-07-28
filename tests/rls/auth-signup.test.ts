import { describe, it, expect } from 'vitest';
import { anonClient } from '../helpers/clients';

// Pins PRD 3 / 14.3: there is no public sign-up route, enforced at the
// Supabase Auth layer regardless of application code (no app route ever
// calls auth.signUp() -- verified separately -- but that absence is not
// something a test can observe from outside the app, so this asserts the
// actual runtime behaviour instead).
//
// This is also the guard for supabase/config.toml's `[auth.email]
// enable_signup = true` line and its comment. That flag had to be flipped
// to true to stop GoTrue's known conflation (supabase/auth#330) of
// "signup disabled" with "login disabled" for already-provisioned users,
// which was breaking every roleClient() call. Flipping it the wrong way
// back to `false` would break login loudly; flipping the *other* knob --
// the top-level `[auth] enable_signup = false` this test actually
// exercises -- back to `true` would silently reopen public self-signup.
// Without this test, nothing in the suite would catch that: the existing
// env-contract test only asserts the config *text* says false, never that
// the auth service actually behaves that way, and a hosted Supabase
// project has no local config.toml at all for that test to read.
//
// Assert positively on the specific rejection reason and status, not mere
// error presence -- a bare non-null check would also pass if the whole
// auth service were unreachable.
describe('anonymous self sign-up', () => {
  it('is rejected by Supabase Auth itself', async () => {
    const email = `unsolicited-signup-${Date.now()}@askhub.test`;
    const { data, error } = await anonClient().auth.signUp({
      email,
      password: 'Unsolicited-Signup-Passw0rd!',
    });

    expect(data.user, 'signUp must not create a user').toBeNull();
    expect(error, 'expected signup to be rejected, got none').not.toBeNull();
    expect(error!.status).toBe(422);
    expect(error!.code).toBe('signup_disabled');
  });
});
