import { getUserDisplayInfo } from "@geoglows/auth/core";
import { ICONS } from "../icons.js";

export function renderAccountPanel(state) {
  const { user, account, status, error, action } = state;
  if (!user) return "";

  const { name, email, initials } = getUserDisplayInfo(user, account);
  const orgs = account?.organizations || [];
  const activeOrgId = account?.activeOrgId || "";
  const activeRole = account?.activeRole || null;
  const hasOrg = Boolean(account?.activeOrg);

  return `
    <div class="glass-card rounded-3xl p-6 md:p-8 shadow-sm">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-lg font-bold flex items-center justify-center shadow-sm">
              ${initials}
            </div>
            <div>
              <p class="text-sm font-medium text-blue-600 dark:text-blue-400">Workspace</p>
              <h2 class="text-2xl font-bold text-slate-800 dark:text-white">${name}</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">${email}</p>
            </div>
          </div>

          ${
            status === "loading_profile" || status === "loading_account"
              ? `
            <div class="mt-5 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Loading your workspace...
            </div>
          `
              : ""
          }

          ${
            error
              ? `
            <div class="mt-5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              We could not load your account details. You are signed in, but some workspace features may not be available yet.
            </div>
          `
              : ""
          }

          ${
            hasOrg
              ? `
            <div class="mt-5 flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-300 border border-blue-200 dark:border-slate-700">
                Active organization: ${account.activeOrg.name}
              </span>
              ${
                activeRole
                  ? `
                <span class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Role: ${activeRole}
                </span>
              `
                  : ""
              }
            </div>
          `
              : `
            <div class="mt-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-4">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white">Set up your workspace</h3>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                You are signed in, but you are not part of an organization yet. Create one to start managing shared data and permissions.
              </p>
            </div>
          `
          }
        </div>

        <div class="w-full lg:w-[320px]">
          ${
            orgs.length > 0
              ? `
            <div class="rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 p-4">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active organization
              </label>
              <select
                id="orgSelector"
                ${action === "switching_org" ? "disabled" : ""}
                class="mt-2 w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-60"
              >
                ${orgs
                  .map(
                    (org) => `
                  <option value="${org.id}" ${org.id === activeOrgId ? "selected" : ""}>
                    ${org.name}
                  </option>
                `
                  )
                  .join("")}
              </select>
              ${
                action === "switching_org"
                  ? `<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Switching organization...</p>`
                  : ""
              }
            </div>
          `
              : `
            <form id="createOrgForm" class="rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Create organization
              </label>
              <input
                id="createOrgName"
                type="text"
                placeholder="Organization name"
                class="px-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Choose a clear name for your team, lab, or agency.
              </p>
              <button
                type="submit"
                ${action === "creating_org" ? "disabled" : ""}
                class="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors"
              >
                ${action === "creating_org" ? "Creating..." : "Create organization"}
              </button>
            </form>
          `
          }
        </div>
      </div>
    </div>
  `;
}

export function renderWorkspacePage(state) {
  if (!state.user) {
    return `
      <div class="flex flex-col items-center justify-center py-24 text-center gap-6">
        <div class="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
          ${ICONS.droplet}
        </div>
        <div>
          <h2 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">Sign in to access your workspace</h2>
          <p class="text-slate-600 dark:text-slate-400 max-w-sm">
            Manage your account, organization, and access to shared GEOGLOWS resources.
          </p>
        </div>
        <button
          id="signIn"
          class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          Sign in
        </button>
      </div>
    `;
  }

  return `
    <section>
      <div class="mb-5">
        <p class="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Workspace
        </p>
        <h2 class="text-3xl font-bold text-slate-800 dark:text-white">
          Your Workspace
        </h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Manage your account, organization, and access to shared GEOGLOWS resources.
        </p>
      </div>
      ${renderAccountPanel(state)}
    </section>
  `;
}
