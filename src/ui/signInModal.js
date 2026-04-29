// src/ui/signInModal.js
//
// Vanilla JS sign-in modal. Opens when something dispatches
// `SIGN_IN_REQUESTED_EVENT` on `window`. Offers Google and GitHub OAuth,
// plus an email/password form (with sign-up toggle). All paths call
// adapter methods from src/auth.js or supabase.auth directly.
//
// On successful sign-in, the modal closes. The portal's main.js listens
// to `supabase.auth.onAuthStateChange` and re-runs `bootstrapSession`
// to refresh React-context-equivalent state (appState).

import {
  SIGN_IN_REQUESTED_EVENT,
  signInWithPassword,
  signInWithOAuth,
} from "../auth.js";
import { supabase } from "../supabase.js";

const GENERIC_PASSWORD_ERROR =
  "Sign-in failed. Please check your email and password and try again.";
const GENERIC_SIGNUP_ERROR =
  "We couldn't create your account. Please try again.";
const GENERIC_OAUTH_ERROR =
  "We couldn't start the sign-in flow. Please try again.";

/**
 * Mounts the sign-in modal once at app startup. Returns nothing; the modal
 * lives on window-level events from then on.
 */
export function mountSignInModal() {
  const dialog = document.createElement("dialog");
  dialog.id = "signInModal";
  // Centering: native <dialog>:modal UA styles place the element via
  // position:fixed; inset:0; margin:auto — but Tailwind's preflight
  // and our own w-* classes can interfere. Explicit translate-based
  // centering is robust regardless of UA / preflight quirks.
  dialog.className =
    "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-0 backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xl";
  dialog.innerHTML = renderModalBody({ mode: "signIn", error: null, pending: false });
  document.body.appendChild(dialog);

  let modalState = { mode: "signIn", error: null, pending: false };

  function setModalState(patch) {
    modalState = { ...modalState, ...patch };
    const scrollTop = dialog.scrollTop;
    dialog.innerHTML = renderModalBody(modalState);
    bindModalEvents();
    dialog.scrollTop = scrollTop;
  }

  function close() {
    modalState = { mode: "signIn", error: null, pending: false };
    dialog.innerHTML = renderModalBody(modalState);
    if (dialog.open) dialog.close();
  }

  async function handleOAuth(provider) {
    setModalState({ pending: true, error: null });
    try {
      await signInWithOAuth({
        provider,
        redirectTo: window.location.origin,
      });
      // Browser redirects away; nothing else to do here.
    } catch (err) {
      console.error("OAuth sign-in failed:", err instanceof Error ? err.message : err);
      setModalState({ pending: false, error: GENERIC_OAUTH_ERROR });
    }
  }

  async function handlePasswordSubmit(form) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email) {
      setModalState({ error: "Please enter your email address." });
      return;
    }
    if (!password.trim()) {
      setModalState({
        error:
          modalState.mode === "signUp"
            ? "Please choose a password."
            : "Please enter your password.",
      });
      return;
    }

    setModalState({ pending: true, error: null });
    try {
      if (modalState.mode === "signUp") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // signUp may or may not return a session depending on email
        // confirmation settings. If a session was returned,
        // onAuthStateChange will fire SIGNED_IN. Otherwise, show a
        // confirmation hint.
        setModalState({
          pending: false,
          error: null,
          mode: "signUpSent",
        });
      } else {
        await signInWithPassword({ email, password });
        // onAuthStateChange will fire SIGNED_IN; main.js re-bootstraps
        // and the navbar updates. Just close the modal.
        close();
      }
    } catch (err) {
      console.error(
        `${modalState.mode === "signUp" ? "Sign-up" : "Sign-in"} failed:`,
        err instanceof Error ? err.message : err,
      );
      setModalState({
        pending: false,
        error:
          modalState.mode === "signUp"
            ? GENERIC_SIGNUP_ERROR
            : GENERIC_PASSWORD_ERROR,
      });
    }
  }

  function bindModalEvents() {
    dialog
      .querySelector("#signInClose")
      ?.addEventListener("click", () => close());

    dialog
      .querySelector("#signInGoogle")
      ?.addEventListener("click", () => handleOAuth("google"));

    dialog
      .querySelector("#signInGithub")
      ?.addEventListener("click", () => handleOAuth("github"));

    dialog.querySelector("#signInPasswordForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      handlePasswordSubmit(e.target);
    });

    dialog.querySelector("#signInToggleMode")?.addEventListener("click", () => {
      setModalState({
        mode: modalState.mode === "signUp" ? "signIn" : "signUp",
        error: null,
      });
    });

    dialog.querySelector("#signInBackToForm")?.addEventListener("click", () => {
      setModalState({ mode: "signIn", error: null });
    });
  }

  // Close on backdrop click. The native <dialog> doesn't do this for us.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  // Reset state on close (Escape key or programmatic close)
  dialog.addEventListener("close", () => {
    modalState = { mode: "signIn", error: null, pending: false };
  });

  window.addEventListener(SIGN_IN_REQUESTED_EVENT, () => {
    if (!dialog.open) {
      setModalState({ mode: "signIn", error: null, pending: false });
      dialog.showModal();
    }
  });

  bindModalEvents();
}

function renderModalBody({ mode, error, pending }) {
  if (mode === "signUpSent") {
    return `
      <div class="p-8">
        <h2 class="text-xl font-bold mb-3">Check your email</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
          We sent a confirmation link to your email. Click the link to finish creating your account.
        </p>
        <button
          type="button"
          id="signInBackToForm"
          class="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          Back to sign in
        </button>
      </div>
    `;
  }

  const isSignUp = mode === "signUp";

  return `
    <div class="p-8">
      <div class="flex items-start justify-between mb-6">
        <h2 class="text-xl font-bold">${isSignUp ? "Create your account" : "Sign in"}</h2>
        <button
          type="button"
          id="signInClose"
          aria-label="Close"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-2xl leading-none"
        >&times;</button>
      </div>

      ${
        error
          ? `<p role="alert" aria-live="polite" class="mb-4 px-3 py-2 rounded-lg text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">${error}</p>`
          : ""
      }

      <div class="space-y-3 mb-6">
        <button
          type="button"
          id="signInGoogle"
          ${pending ? "disabled" : ""}
          class="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.94L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          id="signInGithub"
          ${pending ? "disabled" : ""}
          class="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Continue with GitHub
        </button>
      </div>

      <div class="relative my-4">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div class="relative flex justify-center text-xs">
          <span class="px-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            or with email
          </span>
        </div>
      </div>

      <form id="signInPasswordForm" novalidate class="space-y-3">
        <div>
          <label for="signInEmail" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email</label>
          <input
            id="signInEmail"
            name="email"
            type="email"
            autocomplete="email"
            ${pending ? "disabled" : ""}
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label for="signInPassword" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password</label>
          <input
            id="signInPassword"
            name="password"
            type="password"
            autocomplete="${isSignUp ? "new-password" : "current-password"}"
            ${pending ? "disabled" : ""}
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          ${pending ? "disabled" : ""}
          class="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          ${pending ? (isSignUp ? "Creating account…" : "Signing in…") : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p class="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        ${
          isSignUp
            ? `Already have an account? <button type="button" id="signInToggleMode" class="text-blue-600 dark:text-blue-400 font-semibold underline-offset-2 hover:underline">Sign in</button>`
            : `New here? <button type="button" id="signInToggleMode" class="text-blue-600 dark:text-blue-400 font-semibold underline-offset-2 hover:underline">Create an account</button>`
        }
      </p>
    </div>
  `;
}
