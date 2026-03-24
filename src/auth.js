// src/auth.js
// import { UserManager, WebStorageStateStore } from "oidc-client-ts";

// const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
// const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
// const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
// const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;
// const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

// const scope = import.meta.env.VITE_COGNITO_SCOPE || "openid email profile";

// export const userManager = new UserManager({
//   authority,
//   client_id: clientId,
//   redirect_uri: redirectUri,
//   post_logout_redirect_uri: logoutUri,
//   response_type: "code",
//   scope,

//   userStore: new WebStorageStateStore({ store: window.localStorage }),

//   // Keep this false for Cognito
//   automaticSilentRenew: false,
//   revokeTokenTypes: ["refresh_token"],
// });

// let renewalInFlight = null;

// async function renewTokens() {
//   if (renewalInFlight) return renewalInFlight;

//   renewalInFlight = (async () => {
//     try {
//       const renewedUser = await userManager.signinSilent();
//       return renewedUser;
//     } catch (error) {
//       console.error("Token renewal failed:", error);
//       await userManager.removeUser();
//       return null;
//     } finally {
//       renewalInFlight = null;
//     }
//   })();

//   return renewalInFlight;
// }

// export async function clearStaleAuthState() {
//   try {
//     await userManager.clearStaleState();
//   } catch (error) {
//     console.warn("Unable to clear stale auth state:", error);
//   }
// }

// export async function signInRedirect() {
//   await userManager.signinRedirect();
// }

// export async function completeSignInIfNeeded() {
//   const params = new URLSearchParams(window.location.search);
//   const hasAuthParams = params.has("code") && params.has("state");

//   if (!hasAuthParams) {
//     return null;
//   }

//   const user = await userManager.signinCallback();

//   const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
//   window.history.replaceState({}, document.title, cleanUrl);

//   return user;
// }

// export async function getCurrentUser() {
//   let user = await userManager.getUser();

//   if (!user) {
//     return null;
//   }

//   // If already expired, try one refresh before giving up
//   if (user.expired) {
//     user = await renewTokens();
//     return user;
//   }

//   return user;
// }

// export function setupTokenRenewal() {
//   userManager.events.addAccessTokenExpiring(async () => {
//     try {
//       await renewTokens();
//     } catch (error) {
//       console.error("Access token expiring renewal failed:", error);
//     }
//   });

//   userManager.events.addAccessTokenExpired(async () => {
//     try {
//       await renewTokens();
//     } catch (error) {
//       console.error("Access token expired renewal failed:", error);
//     }
//   });

//   userManager.events.addSilentRenewError(async (error) => {
//     console.error("Silent renew error:", error);
//   });

//   userManager.events.addUserSignedOut(async () => {
//     try {
//       await userManager.removeUser();
//     } catch (error) {
//       console.warn("Unable to remove signed-out user:", error);
//     }
//   });
// }

// export async function signOutRedirect() {
//   try {
//     await userManager.removeUser();
//   } catch (error) {
//     console.warn("Unable to remove local user before logout:", error);
//   }

//   const url = new URL(`${cognitoDomain}/logout`);
//   url.searchParams.set("client_id", clientId);
//   url.searchParams.set("logout_uri", logoutUri);

//   window.location.assign(url.toString());
// }

import { createOidcAuthAdapter } from "@geoglows/auth/core";
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