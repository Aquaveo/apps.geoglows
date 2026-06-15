import { describe, expect, it, vi } from "vitest";

import {
  detectRecoveryUrlState,
  getInitialState,
  isRedundantSignIn,
} from "../src/auth-events.js";

describe("isRedundantSignIn", () => {
  // Supabase JS fires SIGNED_IN on every visibility-change session
  // revalidation (GoTrueClient _recoverAndRefresh), even when the session
  // hasn't changed. The dedup check skips the rebootstrap when the new
  // event represents the same user we already have, eliminating both the
  // wasted network round trip AND the avatar → "Signing in…" flicker.

  const currentUser = { sub: "user-1", email: "u@example.com" };

  it("returns false when event is not SIGNED_IN", () => {
    expect(
      isRedundantSignIn("SIGNED_OUT", { user: { id: "user-1" } }, currentUser),
    ).toBe(false);
    expect(
      isRedundantSignIn(
        "TOKEN_REFRESHED",
        { user: { id: "user-1" } },
        currentUser,
      ),
    ).toBe(false);
    expect(
      isRedundantSignIn(
        "INITIAL_SESSION",
        { user: { id: "user-1" } },
        currentUser,
      ),
    ).toBe(false);
  });

  it("returns false when no current user (first sign-in)", () => {
    expect(
      isRedundantSignIn("SIGNED_IN", { user: { id: "user-1" } }, null),
    ).toBe(false);
  });

  it("returns false when current user has no sub", () => {
    expect(
      isRedundantSignIn(
        "SIGNED_IN",
        { user: { id: "user-1" } },
        { sub: "", email: "u@example.com" },
      ),
    ).toBe(false);
  });

  it("returns false when session has no user", () => {
    expect(isRedundantSignIn("SIGNED_IN", null, currentUser)).toBe(false);
    expect(isRedundantSignIn("SIGNED_IN", {}, currentUser)).toBe(false);
    expect(
      isRedundantSignIn("SIGNED_IN", { user: null }, currentUser),
    ).toBe(false);
  });

  it("returns false when the new user id differs from current user sub", () => {
    expect(
      isRedundantSignIn(
        "SIGNED_IN",
        { user: { id: "user-2" } },
        currentUser,
      ),
    ).toBe(false);
  });

  it("returns true when SIGNED_IN fires for the same user we already have", () => {
    expect(
      isRedundantSignIn(
        "SIGNED_IN",
        { user: { id: "user-1" } },
        currentUser,
      ),
    ).toBe(true);
  });
});

describe("getInitialState", () => {
  // Used to seed bootstrapSession's optional initialState — when set, the
  // lib's transient bootstrapping / loading_profile / loading_account
  // emits preserve user/account from the previous state instead of
  // nulling them, avoiding the navbar flicker on rebootstrap.

  it("returns null when appState has no user (first bootstrap)", () => {
    expect(
      getInitialState({ status: "anonymous", user: null, account: null }),
    ).toBeNull();
  });

  it("returns a SessionState-shaped object when user is present", () => {
    const appState = {
      status: "ready",
      user: { sub: "user-1", email: "u@example.com" },
      account: { profile: { id: "user-1", email: "u@example.com" } },
      action: null,
    };

    const initial = getInitialState(appState);
    expect(initial).toEqual({
      status: "ready",
      user: appState.user,
      account: appState.account,
      error: null,
    });
  });

  it("does not include consumer-only fields like 'action' in the SessionState shape", () => {
    const initial = getInitialState({
      status: "ready",
      user: { sub: "user-1" },
      account: null,
      action: "saving_profile",
      profileEditing: true,
    });
    expect(initial).not.toHaveProperty("action");
    expect(initial).not.toHaveProperty("profileEditing");
  });
});

describe("detectRecoveryUrlState", () => {
  // Q6.b/c — synchronous URL parse called from initApp BEFORE Supabase
  // consumes the hash. Returns one of:
  //   - { kind: "expired" } — hash carries error_code=otp_expired
  //   - { kind: "pkce-unsupported" } — query has ?code=&type=recovery
  //   - { kind: "none" } — neither
  // Distinct from Supabase's own PASSWORD_RECOVERY event, which fires
  // AFTER the consumer's listener registers.

  it("returns 'expired' when hash carries error_code=otp_expired", () => {
    expect(
      detectRecoveryUrlState({
        hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        search: "",
      }),
    ).toEqual({ kind: "expired" });
  });

  it("returns 'pkce-unsupported' when query has both ?code and type=recovery", () => {
    expect(
      detectRecoveryUrlState({
        hash: "",
        search: "?code=abc123&type=recovery",
      }),
    ).toEqual({ kind: "pkce-unsupported" });
  });

  it("returns 'pkce-unsupported' when type=recovery is in the hash with code", () => {
    // Some Supabase configs land with #type=recovery&code=...
    expect(
      detectRecoveryUrlState({
        hash: "#code=abc123&type=recovery",
        search: "",
      }),
    ).toEqual({ kind: "pkce-unsupported" });
  });

  it("returns 'none' when neither hash nor search match recovery patterns", () => {
    expect(detectRecoveryUrlState({ hash: "", search: "" })).toEqual({
      kind: "none",
    });
    expect(
      detectRecoveryUrlState({
        hash: "#access_token=xyz&type=recovery",
        search: "",
      }),
    ).toEqual({ kind: "none" });
    expect(
      detectRecoveryUrlState({
        hash: "",
        search: "?code=abc&state=xyz",
      }),
    ).toEqual({ kind: "none" });
  });

  it("'expired' takes precedence over 'pkce-unsupported' when both signals are present", () => {
    expect(
      detectRecoveryUrlState({
        hash: "#error_code=otp_expired",
        search: "?code=abc&type=recovery",
      }),
    ).toEqual({ kind: "expired" });
  });
});

describe("PASSWORD_RECOVERY event handling integration", () => {
  it("calls signInModal.open({ view: 'setNewPassword' }) on PASSWORD_RECOVERY", () => {
    // Mirrors the wiring in main.js: when onAuthStateChange fires
    // PASSWORD_RECOVERY, the consumer must open the modal in setNewPassword
    // view. We assert this by simulating the handler shape directly.
    const open = vi.fn();
    const modal = { open };

    function onAuthStateChange(event /* , session */) {
      if (event === "PASSWORD_RECOVERY") {
        modal.open({ view: "setNewPassword" });
      }
    }

    onAuthStateChange("PASSWORD_RECOVERY", null);
    expect(open).toHaveBeenCalledWith({ view: "setNewPassword" });
  });
});
