// src/auth-events.js
//
// Helpers for the supabase.auth.onAuthStateChange listener in main.js.
// Extracted so they can be unit-tested in isolation (main.js itself runs
// initApp() at module load and is not test-friendly without booting the
// whole app).
//
// Why this exists: Supabase JS fires SIGNED_IN on every visibility-change
// session revalidation (GoTrueClient.js _recoverAndRefresh:3892), even when
// the session has not actually changed. Treating each SIGNED_IN as a fresh
// sign-in and re-running bootstrapSession costs an unnecessary network
// round trip AND used to cause a visible avatar → "Signing in…" flicker
// in the navbar (lib 1.1.2's render-layer guard now masks the flicker; we
// still skip the rebootstrap to avoid the wasted work).

/**
 * Returns true if the supplied event is a stale SIGNED_IN that should be
 * skipped — Supabase fired it for the same user we already know about.
 *
 * @param {string} event - the auth state change event name
 * @param {{ user?: { id?: string } | null } | null | undefined} session - the session payload from Supabase
 * @param {{ sub?: string } | null | undefined} currentUser - the consumer's currently-known user
 */
export function isRedundantSignIn(event, session, currentUser) {
  if (event !== "SIGNED_IN") return false;
  const currentSub = currentUser?.sub;
  if (!currentSub) return false;
  const newId = session?.user?.id;
  if (!newId) return false;
  return newId === currentSub;
}

/**
 * Returns a SessionState-shaped object suitable for passing as
 * `initialState` to `bootstrapSession` — or null if there's no user yet
 * (first bootstrap should run normally).
 *
 * Strips any consumer-only fields (action, profileEditing, etc.); the lib
 * only accepts the SessionState shape.
 *
 * @param {{ status?: string, user?: object | null, account?: object | null }} appState
 */
export function getInitialState(appState) {
  if (!appState?.user) return null;
  return {
    status: appState.status,
    user: appState.user,
    account: appState.account ?? null,
    error: null,
  };
}
