import "./style.css";
import { bootstrapSession } from "@aquaveo/geoglows-auth/core";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

import { auth } from "./auth.js";
import { supabase } from "./supabase.js";
import { initTheme, updateThemeIcon } from "./theme.js";
import { bindWorkspaceEvents } from "./events.js";
import { ICONS } from "./icons.js";
import { renderAuthAction } from "./ui/navbar.js";
import { renderAppsPage } from "./ui/appsPage.js";
import { renderProfilePage } from "./ui/profilePage.js";
import { renderFooter } from "./ui/footer.js";
import { mountSignInModal } from "./ui/signInModal.js";

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
};

function setState(patch) {
  Object.assign(appState, patch);
  renderApp();
}

function render(state) {
  const isApps = state.currentPage !== "profile";

  document.querySelector("#app").innerHTML = `
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
    onStateChange: setState,
  });
}

async function initApp() {
  initTheme();
  renderApp();
  mountSignInModal();

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

  supabase.auth.onAuthStateChange((event) => {
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
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      bootstrapSafe(event);
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
