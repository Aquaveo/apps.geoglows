// src/auth.js
//
// Supabase Auth adapter (replaces the prior Cognito/OIDC adapter as of v0.2.0
// of @aquaveo/geoglows-auth). The Supabase client is shared with the data
// layer in src/supabase.js — same client serves both auth and queries.

import { createSupabaseAuthAdapter } from "@aquaveo/geoglows-auth/core";
import { supabase } from "./supabase.js";

// Preserve pathname so password-recovery / magic-link emails return
// users to the same surface they started from. apps.geoglows itself
// runs at the root path so origin and origin+pathname are typically
// equivalent here, but this matches the convention used by the
// proxied sub-apps (grace, rfs, aquiferx-via-proxy) and is forward-
// compatible if the portal ever adds subroutes that should preserve
// recovery context.
const auth = createSupabaseAuthAdapter({
  supabase,
  defaultRedirectTo: window.location.origin + window.location.pathname,
  logoutRedirectTo: window.location.origin,
});

// Custom event signalling to the sign-in modal that the user pressed the
// "Sign in" button somewhere in the app. Decoupled from any specific
// renderer so the navbar (or any other surface) can dispatch it.
export const SIGN_IN_REQUESTED_EVENT = "geoglows:sign-in-requested";

export async function clearStaleAuthState() {
  return auth.clearStaleAuthState();
}

export async function completeSignInIfNeeded() {
  return auth.completeSignInIfNeeded();
}

export async function getCurrentUser() {
  return auth.getCurrentUser();
}

export function setupTokenRenewal() {
  auth.setupTokenRenewal?.();
}

// Replaces the old hosted-UI redirect. Now opens the inline sign-in modal
// by dispatching a window-level event; the modal subscribes to it and
// shows itself. Kept under the same name so existing call sites
// (src/events.js) don't need to change.
export async function signInRedirect() {
  window.dispatchEvent(new CustomEvent(SIGN_IN_REQUESTED_EVENT));
}

export async function signOutRedirect() {
  return auth.signOutRedirect();
}

// Headless Supabase Auth methods exposed for the inline sign-in modal.
export async function signInWithPassword(args) {
  return auth.signInWithPassword(args);
}

export async function signInWithMagicLink(args) {
  return auth.signInWithMagicLink(args);
}

export async function signInWithOAuth(args) {
  return auth.signInWithOAuth(args);
}

export { auth };
