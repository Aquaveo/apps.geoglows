// src/auth.js
import { createOidcAuthAdapter } from "@aquaveo/geoglows-auth/core";

const auth = createOidcAuthAdapter({
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI,
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN,
  scope: import.meta.env.VITE_COGNITO_SCOPE || "openid email profile",
});

export async function clearStaleAuthState() {
  return auth.clearStaleAuthState();
}

export async function signInRedirect() {
  return auth.signInRedirect();
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

export async function signOutRedirect() {
  return auth.signOutRedirect();
}

export { auth };