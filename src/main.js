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
  recordDisclaimerAcceptance,
  mountDisclaimerModal,
} from "./disclaimer.js";
import { ICONS } from "./icons.js";
import { renderLandingPage, renderAppsGrid, initScrollAnimations } from "./ui/landingPage.js";
import { renderProfilePage } from "./ui/profilePage.js";
import { renderFooter } from "./ui/footer.js";

function pageFromHash(hash) {
  if (hash === "#profile" || hash === "#workspace") return "profile";
  if (hash === "#home") return "home";
  if (hash === "#library") return "apps";
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
  profileSaveSuccess: false,
  // 'pending' | 'accepted' — see src/disclaimer.js. Informative
  // notice; no rejection path (deferred to a future plan).
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

  if (state.disclaimerStatus === "pending" && disclaimerModal) {
    appEl.innerHTML = `
      <div class="min-h-screen water-mesh flex items-center justify-center">
        <div class="text-center opacity-30">
          <div class="flex items-center justify-center gap-3">
            ${ICONS.droplet}
            <span class="font-bold text-xl tracking-wider text-blue-600 dark:text-slate-400 uppercase">GEOGLOWS</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const isApps = state.currentPage !== "profile";
  const showLanding = state.currentPage === "home" || (!state.user && isApps);

  const isDark = document.documentElement.classList.contains("dark");
  const themeIcon = isDark ? ICONS.sun : ICONS.moon;

  appEl.innerHTML = `
    <div class="min-h-screen text-slate-800 dark:text-slate-200 water-mesh flex flex-col">
      <header class="w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 py-8 md:py-20">
        <div class="max-w-7xl mx-auto px-6 flex flex-col items-center text-center relative">
          <a href="#home" class="flex items-center gap-3 mb-4 md:mb-6 no-underline hover:opacity-80 transition-opacity">
            ${ICONS.droplet}
            <span class="font-bold text-xl tracking-wider text-blue-600 dark:text-slate-400 uppercase">GEOGLOWS</span>
          </a>

          <nav class="flex items-center gap-3 md:gap-4 mb-6 md:mb-0 md:absolute md:right-6 md:top-0" aria-label="Site navigation">
            ${renderAuthAction(state)}
            <button
              id="theme-toggle"
              class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="${isDark ? "Switch to light mode" : "Switch to dark mode"}"
            >
              ${themeIcon}
            </button>
          </nav>

          <h1 class="text-3xl md:text-6xl lg:text-7xl font-normal tracking-tight mb-3 md:mb-4 leading-tight">
            <span class="hero-heading">Global Water Intelligence</span>
          </h1>

          <p class="text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Open-access tools for water science and decision-making.
          </p>
        </div>
      </header>

      <main id="main-content" class="max-w-7xl mx-auto px-6 py-10 grow w-full">
        ${state.status === "error" ? `
          <div role="alert" class="mb-6 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            ${state.error}
          </div>
        ` : ""}
        ${isApps ? (showLanding ? renderLandingPage() : renderAppsGrid()) : renderProfilePage(state)}
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
  if (appState.currentPage === "home" || (appState.currentPage !== "profile" && !appState.user)) initScrollAnimations();
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
  //
  // Read URL via the inline-script-captured snapshot from index.html
  // (window.__GEOGLOWS_INITIAL_URL__). Reading window.location directly
  // here can race against Supabase JS's _initialize() — by the time
  // initApp runs, the hash may already be cleared. The inline script in
  // index.html runs before any module is fetched, guaranteeing the
  // recovery hash is preserved here. See aquiferx 2026-05-01 race fix.
  const initialUrl = window.__GEOGLOWS_INITIAL_URL__;
  const initialHash =
    initialUrl && typeof initialUrl.hash === "string"
      ? initialUrl.hash
      : window.location.hash;
  const initialSearch =
    initialUrl && typeof initialUrl.search === "string"
      ? initialUrl.search
      : window.location.search;
  const recoveryUrl = detectRecoveryUrlState({
    hash: initialHash,
    search: initialSearch,
  });
  // The implicit-flow recovery (`#access_token=...&type=recovery`) returns
  // `kind: 'none'` from detectRecoveryUrlState because it's handled by
  // Supabase JS via PASSWORD_RECOVERY. Test for it explicitly so we know to
  // defer the disclaimer modal until that flow concludes too.
  const hasImplicitRecoveryHash =
    /(?:^|[#&?])access_token=/.test(initialHash) &&
    /(?:^|[#&?])type=recovery/.test(initialHash);
  const isRecoveryFlow =
    recoveryUrl.kind !== "none" || hasImplicitRecoveryHash;

  // Lazy-mount the disclaimer modal only when the user hasn't acknowledged
  // yet. If status is 'pending' AND a recovery URL is present, defer the
  // mount; we'll mount/open after the recovery modal closes (see below).
  function openDisclaimerNow() {
    if (disclaimerModal) {
      disclaimerModal.open();
      return;
    }
    disclaimerModal = mountDisclaimerModal({
      onAccept: () => {
        recordDisclaimerAcceptance();
        disclaimerModal.close();
        setState({ disclaimerStatus: "accepted" });
      },
    });
    disclaimerModal.open();
  }

  if (appState.disclaimerStatus === "pending" && !isRecoveryFlow) {
    openDisclaimerNow();
  }

  renderApp();

  // Cross-tab sync. When another tab acknowledges the disclaimer, close
  // this tab's modal too.
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
      setState({ status: "error", error: "Unable to connect. Please refresh the page or try again later." });
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
      // Only open the recovery modal if THIS tab actually loaded with
      // a recovery URL. Supabase fires PASSWORD_RECOVERY on every tab
      // that revalidates a recovery-type session via getSession() —
      // including tabs that did NOT receive the recovery email link
      // (e.g., the user clicked the link in another tab while
      // apps.geoglows was already open elsewhere). Without this gate
      // the setNewPassword modal pops up cross-tab, which is
      // misleading. `isRecoveryFlow` was computed at module load above
      // from detectRecoveryUrlState + the implicit-flow hash check.
      if (!isRecoveryFlow) return;
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
