import { getUserDisplayInfo } from "@aquaveo/geoglows-auth/core";

export function renderAuthAction(state) {
  const { user, account, status, action } = state;

  if (
    status === "bootstrapping" ||
    status === "processing_callback" ||
    status === "loading_profile" ||
    status === "loading_account"
  ) {
    return `
      <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">
        <span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        Signing in...
      </div>
    `;
  }

  if (!user) {
    return `
      <button
        id="signIn"
        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        aria-label="Sign In"
      >
        Sign in
      </button>
    `;
  }

  const { name, email, initials } = getUserDisplayInfo(user, account);

  return `
    <details class="relative">
      <summary class="list-none cursor-pointer w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-sm font-bold flex items-center justify-center select-none hover:opacity-90 transition-opacity">
        ${initials}
      </summary>
      <div class="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50">
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${name}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${email}</p>
        </div>
        <a
          href="#workspace"
          class="flex items-center px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Workspace
        </a>
        <div class="border-t border-slate-100 dark:border-slate-800"></div>
        <button
          id="signOut"
          ${action === "signing_out" ? "disabled" : ""}
          class="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
        >
          ${action === "signing_out" ? "Signing out..." : "Log out"}
        </button>
      </div>
    </details>
  `;
}
