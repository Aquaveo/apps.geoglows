// src/auth.js
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/`;
const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI || `${window.location.origin}/`;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

const scope = import.meta.env.VITE_COGNITO_SCOPE || "openid email profile";

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  redirect_uri: redirectUri,
  post_logout_redirect_uri: logoutUri,
  response_type: "code",
  scope,

  // Persist signed-in user across refreshes/tabs
  userStore: new WebStorageStateStore({ store: window.localStorage }),

  // Cognito-specific recommendations from oidc-client-ts docs
  automaticSilentRenew: false,
  revokeTokenTypes: ["refresh_token"],
});

export async function clearStaleAuthState() {
  try {
    await userManager.clearStaleState();
  } catch (error) {
    console.warn("Unable to clear stale auth state:", error);
  }
}

export async function signInRedirect() {
  await userManager.signinRedirect();
}

export async function completeSignInIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const hasAuthParams = params.has("code") && params.has("state");

  if (!hasAuthParams) {
    return null;
  }

  const user = await userManager.signinCallback();

  // Clean up ?code=...&state=... from the URL
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);

  return user;
}

export async function getCurrentUser() {
  const user = await userManager.getUser();
  if (!user || user.expired) {
    return null;
  }
  return user;
}

export async function signOutRedirect() {
  try {
    await userManager.removeUser();
  } catch (error) {
    console.warn("Unable to remove local user before logout:", error);
  }

  const url = new URL(`${cognitoDomain}/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);

  window.location.assign(url.toString());
}