import "./style.css";
import "@aquaveo/geoglows-auth/core/sign-in.css";
import {
  bootstrapSession,
  mountSignInModal,
  renderAuthAction,
} from "@aquaveo/geoglows-auth/core";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

import { auth, SIGN_IN_REQUESTED_EVENT } from "./auth.js";
import { supabase } from "./supabase.js";
import { initTheme, updateThemeIcon } from "./theme.js";
import { bindWorkspaceEvents } from "./events.js";
import {
  detectRecoveryUrlState,
  getInitialState,
  isRedundantSignIn,
} from "./auth-events.js";
import {
  STORAGE_KEY as DISCLAIMER_STORAGE_KEY,
  getDisclaimerStatus,
  recordDisclaimerDecision,
  mountDisclaimerModal,
  renderDisclaimerRejectedPage,
} from "./disclaimer.js";
import { ICONS } from "./icons.js";
import { renderAppsPage } from "./ui/appsPage.js";
import { renderProfilePage } from "./ui/profilePage.js";
import { renderFooter } from "./ui/footer.js";

function pageFromHash(hash) {
  // Accept the legacy #workspace anchor as a synonym for #profile so
  // bookmarks from the previous Cognito-era app keep working.
  if (hash === "#profile" || hash === "#workspace") return "profile";
  return "apps";
}

const appState = {
  status: "bootstrapping",
  user: null,
  account: null,
  error: null,
  action: null,
  currentPage: pageFromHash(window.location.hash),
  profileEditing: false,
  profileBannerDismissed: false,
  // 'pending' | 'accepted' | 'rejected' — see src/disclaimer.js. Recovery
  // flow is NOT gated by this; it's a UI gate only.
  disclaimerStatus: getDisclaimerStatus(),
};

// Module-level handle to the disclaimer modal, created lazily inside initApp()
// when the user has not yet accepted. Stays null when status is already
// 'accepted' (no DOM mount is wasted on the 99%+ accepted-state visits).
let disclaimerModal = null;

function setState(patch) {
  Object.assign(appState, patch);
  renderApp();
}

function render(state) {
  const appEl = document.querySelector("#app");

  // Disclaimer-rejected: render the full-page rejection view instead of the
  // app catalog or profile. The Reconsider button click is bound by
  // bindWorkspaceEvents().
  if (state.disclaimerStatus === "rejected") {
    appEl.innerHTML = renderDisclaimerRejectedPage();
    return;
  }

  // Disclaimer-pending with the modal currently open: render an empty #app
  // so the apps catalog doesn't flash behind the modal backdrop. The normal
  // catalog/profile render resumes once the user accepts.
  if (state.disclaimerStatus === "pending" && disclaimerModal) {
    appEl.innerHTML = "";
    return;
  }

  const isApps = state.currentPage !== "profile";

  appEl.innerHTML = `
    <div class="min-h-screen text-slate-800 dark:text-slate-200 water-mesh flex flex-col">
      <nav class="w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 py-8 md:py-12">
        <div class="max-w-7xl mx-auto px-6 flex flex-col items-center text-center relative">
          <div class="absolute right-6 top-0 flex items-center gap-4">
            <a
              href="#apps"
              class="text-sm font-semibold transition-colors ${isApps ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}"
            >
              App Library
            </a>
            ${renderAuthAction(state)}
            <button
              id="theme-toggle"
              class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
              aria-label="Toggle theme"
            >
              ${ICONS.moon}
            </button>
          </div>

          <div class="flex items-center gap-3 mb-6">
            ${ICONS.droplet}
            <span class="font-bold text-xl tracking-wider text-blue-600 dark:text-slate-400 uppercase">GEOGLOWS</span>
          </div>

          <h1 class="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-tight">
            <span class="gradient-text">Global Water Intelligence</span>
          </h1>

          <p class="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
            Empowering individuals and organizations to solve local water challenges with global water intelligence.
          </p>
        </div>
      </nav>

      <main class="max-w-7xl mx-auto px-6 py-10 grow w-full">
        ${isApps ? renderAppsPage() : renderProfilePage(state)}
      </main>

      ${renderFooter()}
    </div>
  `;

  updateThemeIcon();
}

function renderApp() {
  render(appState);
  bindWorkspaceEvents(setState);
  updateThemeIcon();
}

async function runBootstrap() {
  await bootstrapSession({
    auth,
    supabase,
    // initialState carries the previous user/account through the
    // transient bootstrapping/loading_profile/loading_account phases on
    // rebootstrap (e.g. tab-focus revalidation), avoiding the avatar →
    // "Signing in…" flicker. Returns null on first bootstrap when
    // appState.user is null, which is the desired default behavior.
    initialState: getInitialState(appState),
    onStateChange: setState,
  });
}

async function initApp() {
  initTheme();

  // Detect any recovery-URL signal at module load. Used below to decide
  // whether to defer the disclaimer modal so the recovery flow runs first.
  const recoveryUrl = detectRecoveryUrlState({
    hash: window.location.hash,
    search: window.location.search,
  });
  // The implicit-flow recovery (`#access_token=...&type=recovery`) returns
  // `kind: 'none'` from detectRecoveryUrlState because it's handled by
  // Supabase JS via PASSWORD_RECOVERY. Test for it explicitly so we know to
  // defer the disclaimer modal until that flow concludes too.
  const hasImplicitRecoveryHash =
    /(?:^|[#&?])access_token=/.test(window.location.hash) &&
    /(?:^|[#&?])type=recovery/.test(window.location.hash);
  const isRecoveryFlow =
    recoveryUrl.kind !== "none" || hasImplicitRecoveryHash;

  // Lazy-mount the disclaimer modal only when the user hasn't accepted yet.
  // If status is 'rejected', the rejection page renders directly — no modal
  // mount. If status is 'pending' AND a recovery URL is present, defer the
  // mount; we'll mount/open after the recovery modal closes (see below).
  function openDisclaimerNow() {
    if (disclaimerModal) {
      disclaimerModal.open();
      return;
    }
    disclaimerModal = mountDisclaimerModal({
      onAccept: () => {
        recordDisclaimerDecision("accepted");
        disclaimerModal.close();
        setState({ disclaimerStatus: "accepted" });
      },
      onReject: () => {
        recordDisclaimerDecision("rejected");
        disclaimerModal.close();
        setState({ disclaimerStatus: "rejected" });
      },
    });
    disclaimerModal.open();
  }

  if (appState.disclaimerStatus === "pending" && !isRecoveryFlow) {
    openDisclaimerNow();
  }

  // Reconsider button on the rejection page → re-open the modal. The click
  // is dispatched as a window event from events.js#bindWorkspaceEvents to
  // avoid coupling events.js to the disclaimer modal handle. The state
  // stays 'rejected' until the user accepts in the re-opened modal.
  window.addEventListener("geoglows:disclaimer-reconsider", () => {
    openDisclaimerNow();
  });

  renderApp();

  // Cross-tab sync. When another tab writes the disclaimer entry, mirror
  // that decision in this tab. Last-write-wins for conflicting cross-tab
  // decisions; documented limitation.
  window.addEventListener("storage", (event) => {
    if (event.key !== DISCLAIMER_STORAGE_KEY) return;
    const next = getDisclaimerStatus();
    if (next === appState.disclaimerStatus) return;
    if (next === "accepted" && disclaimerModal) {
      disclaimerModal.close();
    }
    setState({ disclaimerStatus: next });
  });

  // Mount the lib's vanilla sign-in modal and bridge our window-event
  // dispatch (SIGN_IN_REQUESTED_EVENT — fired by signInRedirect() in
  // src/auth.js when the navbar's "Sign in" button is clicked) to the
  // modal's open() handle. This decouples any UI surface that wants to
  // request sign-in from a direct reference to the modal.
  const signInModal = mountSignInModal({ authAdapter: auth });
  window.addEventListener(SIGN_IN_REQUESTED_EVENT, () => signInModal.open());

  // Recovery URL detection — runs synchronously BEFORE Supabase JS consumes
  // the hash. If the URL signals expired-token or PKCE (unsupported in v1),
  // open the modal in the recoveryError view so the user sees a clean error
  // instead of silent failure. See docs/plans/2026-04-30-002-feat-forgot-
  // password-flow-plan.md (Q1 + PKCE detector).
  if (recoveryUrl.kind === "pkce-unsupported") {
    console.error(
      "PKCE recovery flow is not supported in @aquaveo/geoglows-auth 1.2.x. " +
        "If your Supabase project has been migrated to PKCE, the recovery " +
        "URL template needs to use the implicit flow.",
    );
    signInModal.open({ view: "recoveryError" });
  } else if (recoveryUrl.kind === "expired") {
    signInModal.open({ view: "recoveryError" });
  }

  // After the sign-in modal closes (recovery or normal), open the disclaimer
  // modal IF the user hasn't yet decided. This is the deferred path for
  // visitors who arrived via a recovery URL: recovery flow runs first, then
  // the disclaimer prompt comes up. Re-checks status from getDisclaimerStatus()
  // so a cross-tab acceptance during the recovery flow is honored.
  // The lib's mountSignInModal doesn't expose the underlying <dialog> element,
  // so we find it by the lib's stable class selector. Class is part of the
  // lib's public CSS contract (sign-in.css).
  const signInDialogEl = document.querySelector(".geoglows-signin-modal");
  signInDialogEl?.addEventListener("close", () => {
    if (getDisclaimerStatus() === "pending") openDisclaimerNow();
  });

  window.addEventListener("hashchange", () => {
    setState({ currentPage: pageFromHash(window.location.hash) });
  });

  // Bootstrap is driven by Supabase's onAuthStateChange. INITIAL_SESSION
  // fires after Supabase JS finishes detectSessionInUrl — this is the only
  // safe moment to call getSession() and have it reflect any OAuth tokens
  // that arrived in the URL hash. SIGNED_IN / SIGNED_OUT fire on later
  // changes (inline modal sign-in, sign-out from anywhere).
  let initialBootstrapDone = false;

  function bootstrapSafe(reason) {
    runBootstrap().catch((error) => {
      console.error(
        `Bootstrap after ${reason} failed:`,
        error instanceof Error ? error.message : error,
      );
    });
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" && !initialBootstrapDone) {
      initialBootstrapDone = true;
      bootstrapSafe("INITIAL_SESSION");

      // Strip OAuth callback artifacts so a reload doesn't replay the flow.
      // Supabase's implicit OAuth callback returns tokens in the hash;
      // PKCE returns ?code=&state= in the query. Clean both.
      const hashHasAuth = /(?:^|[#&])access_token=/.test(window.location.hash);
      const search = new URLSearchParams(window.location.search);
      const queryHasAuth = search.has("code") && search.has("state");
      if (hashHasAuth || queryHasAuth) {
        if (queryHasAuth) {
          search.delete("code");
          search.delete("state");
        }
        const cleanedSearch = search.toString();
        const newUrl =
          window.location.pathname + (cleanedSearch ? `?${cleanedSearch}` : "");
        history.replaceState({}, document.title, newUrl);
      }
      return;
    }
    if (event === "SIGNED_OUT") {
      bootstrapSafe("SIGNED_OUT");
      return;
    }
    if (event === "SIGNED_IN") {
      // Supabase JS fires SIGNED_IN on every visibility-change session
      // revalidation (GoTrueClient.js _recoverAndRefresh). If it's the
      // same user we already have, skip the rebootstrap — saves a
      // network round trip and (defensively) avoids the avatar
      // flicker. See `src/auth-events.js`.
      if (isRedundantSignIn(event, session, appState.user)) return;
      bootstrapSafe("SIGNED_IN");
    }
    if (event === "PASSWORD_RECOVERY") {
      // Supabase fires this once during _initialize() when the URL hash
      // carries `#type=recovery`. Open the modal in setNewPassword view
      // so the user can set a new password. The modal handles the
      // updateUserPassword + signOutOtherSessions sequence and fires
      // SIGNED_IN on success (which the dedup above will catch).
      signInModal.open({ view: "setNewPassword" });
    }
  });

  // Safety net: if INITIAL_SESSION never fires within 2s (unlikely with
  // detectSessionInUrl: true on by default), bootstrap anyway so the UI
  // never gets stuck on the "Signing in..." placeholder.
  setTimeout(() => {
    if (!initialBootstrapDone) {
      initialBootstrapDone = true;
      bootstrapSafe("timeout-fallback");
    }
  }, 2000);
}

initApp();
inject();
injectSpeedInsights();
