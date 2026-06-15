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

/**
 * Synchronously detects recovery-related URL state at module-load time,
 * BEFORE Supabase JS consumes the hash via detectSessionInUrl. Returns
 * one of:
 *   - { kind: "expired" }          — token already used / past TTL
 *   - { kind: "pkce-unsupported" } — PKCE recovery URL on an implicit-flow project
 *   - { kind: "none" }             — neither (incl. valid implicit-flow recovery)
 *
 * The valid-implicit-flow recovery case (`#access_token=…&type=recovery`)
 * returns "none" — it's handled by Supabase JS, which fires PASSWORD_RECOVERY
 * via the onAuthStateChange listener. detectRecoveryUrlState catches the
 * cases where no event will fire so the consumer can surface a clean error
 * to the user instead of leaving them stranded on a normal signed-out page.
 *
 * @param {{ hash?: string, search?: string }} url
 */
export function detectRecoveryUrlState(url) {
  const hash = url?.hash ?? "";
  const search = url?.search ?? "";

  // Expired token takes precedence — the URL signals failure regardless of flow.
  if (/(?:^|[#&?])error_code=otp_expired/.test(hash)) {
    return { kind: "expired" };
  }
  if (/(?:^|[?&])error_code=otp_expired/.test(search)) {
    return { kind: "expired" };
  }

  // PKCE recovery: a `?code=` (or `#code=`) AND `type=recovery` in the same
  // string. Implicit flow recovery uses `#access_token=`, NOT `code=`, so the
  // code+recovery combination uniquely identifies the unsupported-flow case.
  const hasCode = /(?:^|[#&?])code=/.test(hash) || /(?:^|[?&])code=/.test(search);
  const hasRecovery =
    /(?:^|[#&?])type=recovery/.test(hash) ||
    /(?:^|[?&])type=recovery/.test(search);
  if (hasCode && hasRecovery) {
    return { kind: "pkce-unsupported" };
  }

  return { kind: "none" };
}
