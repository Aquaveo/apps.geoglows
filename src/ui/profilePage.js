import { getUserDisplayInfo } from "@aquaveo/geoglows-auth/core";
import { ICONS } from "../icons.js";
import { isProfileComplete } from "../account.js";
import { escape } from "./escape.js";

const USER_TYPE_OPTIONS = [
  { value: "researcher", label: "Researcher" },
  { value: "student", label: "Student" },
  { value: "agency_staff", label: "Agency staff" },
  { value: "industry_professional", label: "Industry professional" },
  { value: "public", label: "Member of the public" },
  { value: "other", label: "Other" },
];

const USER_TYPE_LABELS = Object.fromEntries(
  USER_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

function fieldRow(label, displayHtml) {
  return `
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">${escape(label)}</p>
      <p class="mt-1 text-sm">${displayHtml}</p>
    </div>
  `;
}

function field(label, value, opts = {}) {
  const display = value
    ? `<span class="text-slate-800 dark:text-slate-200">${escape(value)}</span>`
    : `<span class="italic text-slate-400 dark:text-slate-500">${escape(opts.empty ?? "Not provided")}</span>`;
  return fieldRow(label, display);
}

function renderCompletionBanner(state) {
  const { account } = state;
  const profile = account?.profile;
  if (state.profileBannerDismissed) return "";
  if (isProfileComplete(profile)) return "";

  return `
    <div role="alert" aria-label="Profile completion reminder"
      class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-4 py-3">
      <div class="flex-1 min-w-[200px] text-sm text-amber-900 dark:text-amber-200">
        Your profile is missing your name. Complete it so we can address you correctly.
      </div>
      <button type="button" id="profileBannerDismiss"
        class="px-3 py-1.5 rounded-lg text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
        Dismiss
      </button>
      <button type="button" id="profileBannerComplete"
        class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors">
        Complete profile
      </button>
    </div>
  `;
}

function renderViewMode(state) {
  const { user, account } = state;
  const profile = account?.profile;
  const { name, email, initials } = getUserDisplayInfo(user, account);

  const userTypeLabel = profile?.user_type
    ? USER_TYPE_LABELS[profile.user_type] ?? profile.user_type
    : null;

  const userLinkRow = profile?.user_link
    ? fieldRow(
        "Personal link",
        `<a href="${escape(profile.user_link)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline break-all">${escape(profile.user_link)}</a>`,
      )
    : field("Personal link", null, { empty: "—" });

  return `
    <div class="glass-card rounded-3xl p-6 md:p-8 shadow-sm">
      <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white text-xl font-bold flex items-center justify-center shadow-sm">
            ${escape(initials)}
          </div>
          <div>
            <p class="text-sm font-medium text-blue-600 dark:text-blue-400">Profile</p>
            <h2 class="text-2xl font-bold text-slate-800 dark:text-white">${escape(name)}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">${escape(email)}</p>
          </div>
        </div>
        <button type="button" id="profileEditButton"
          class="self-start px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors">
          Edit profile
        </button>
      </div>

      <div class="mt-8 grid gap-5 sm:grid-cols-2">
        ${field("First name", profile?.first_name)}
        ${field("Middle name", profile?.middle_name, { empty: "—" })}
        ${field("Last name", profile?.last_name)}
        ${field("Phone number", profile?.phone_number, { empty: "—" })}
        ${field("User type", userTypeLabel, { empty: "—" })}
        ${userLinkRow}
      </div>

      <div class="mt-5">
        ${field("Address", profile?.address, { empty: "—" })}
      </div>
    </div>
  `;
}

function renderEditMode(state) {
  const { user, account, action, error } = state;
  const profile = account?.profile ?? {};
  const { email } = getUserDisplayInfo(user, account);
  const pending = action === "saving_profile";

  const userTypeOptionsHtml = USER_TYPE_OPTIONS.map(
    (opt) => `
      <option value="${escape(opt.value)}" ${profile.user_type === opt.value ? "selected" : ""}>
        ${escape(opt.label)}
      </option>
    `,
  ).join("");

  return `
    <form id="profileEditForm" novalidate class="glass-card rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 dark:text-white">Edit profile</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">Update your information. Your account email is shown below and cannot be changed here.</p>
      </div>

      <div class="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
        Account email: <strong>${escape(email)}</strong>
      </div>

      ${
        error
          ? `<p role="alert" aria-live="polite" class="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">${escape(error)}</p>`
          : ""
      }

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label for="profileFirstName" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">First name *</label>
          <input id="profileFirstName" name="first_name" type="text" autocomplete="given-name" ${pending ? "disabled" : ""}
            value="${escape(profile.first_name ?? "")}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label for="profileMiddleName" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Middle name</label>
          <input id="profileMiddleName" name="middle_name" type="text" autocomplete="additional-name" ${pending ? "disabled" : ""}
            value="${escape(profile.middle_name ?? "")}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label for="profileLastName" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Last name *</label>
          <input id="profileLastName" name="last_name" type="text" autocomplete="family-name" ${pending ? "disabled" : ""}
            value="${escape(profile.last_name ?? "")}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="profilePhone" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Phone number</label>
          <input id="profilePhone" name="phone_number" type="tel" autocomplete="tel" ${pending ? "disabled" : ""}
            value="${escape(profile.phone_number ?? "")}"
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label for="profileUserType" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">User type</label>
          <select id="profileUserType" name="user_type" ${pending ? "disabled" : ""}
            class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select…</option>
            ${userTypeOptionsHtml}
          </select>
        </div>
      </div>

      <div>
        <label for="profileAddress" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Address</label>
        <textarea id="profileAddress" name="address" autocomplete="street-address" ${pending ? "disabled" : ""}
          class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-y">${escape(profile.address ?? "")}</textarea>
      </div>

      <div>
        <label for="profileLink" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Personal link (URL)</label>
        <input id="profileLink" name="user_link" type="url" autocomplete="url" placeholder="https://" ${pending ? "disabled" : ""}
          value="${escape(profile.user_link ?? "")}"
          class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="profileEditCancel" ${pending ? "disabled" : ""}
          class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
          Cancel
        </button>
        <button type="submit" ${pending ? "disabled" : ""}
          class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold shadow-sm transition-colors">
          ${pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  `;
}

export function renderProfilePage(state) {
  if (!state.user) {
    return `
      <div class="flex flex-col items-center justify-center py-24 text-center gap-6">
        <div class="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
          ${ICONS.droplet}
        </div>
        <div>
          <h2 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">Sign in to view your profile</h2>
          <p class="text-slate-600 dark:text-slate-400 max-w-sm">
            Create an account or sign in to manage your GEOGLOWS profile.
          </p>
        </div>
        <button id="signIn"
          class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors">
          Sign in
        </button>
      </div>
    `;
  }

  const editing = state.profileEditing === true;

  return `
    <section>
      <div class="mb-5">
        <p class="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Profile</p>
        <h2 class="text-3xl font-bold text-slate-800 dark:text-white">Your Profile</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Manage your GEOGloWS account details. Your information is private to you.
        </p>
      </div>
      ${editing ? "" : renderCompletionBanner(state)}
      ${editing ? renderEditMode(state) : renderViewMode(state)}
    </section>
  `;
}
