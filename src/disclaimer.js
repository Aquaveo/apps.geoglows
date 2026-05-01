// src/disclaimer.js
//
// First-visit disclaimer modal: pure helpers + DOM mount + rejection-page renderer.
//
// Per plan docs/plans/2026-04-30-006-feat-disclaimer-acceptance-modal-plan.md.
// Recovery flow is NOT gated by the disclaimer; this module is a UI gate only.
// localStorage tampering / dev-tools bypass is acknowledged out-of-scope —
// the mechanism is informed acknowledgment, not technical enforcement.
// Audit trail / per-account enforcement / entity attribution are deferred
// to a future legal-hardening plan.

// DISCLAIMER_VERSION — string identifier for the current disclaimer text.
// BUMP this constant whenever DISCLAIMER_TEXT changes (any wording change,
// even a typo fix). Bumping forces all existing users to re-acknowledge.
// Comparison is strict equality on the version string — not greater-than/less-than.
export const DISCLAIMER_VERSION = "2026-04-30";

// localStorage key under which the user's decision is persisted.
export const STORAGE_KEY = "geoglows-disclaimer-acceptance";

// Static disclaimer text — single string constant. The rendered template
// MUST NOT contain any `${...}` interpolation of dynamic values. If you
// ever need to render a dynamic value alongside the disclaimer (user name,
// dynamic date, etc.), wrap it in `escapeHtml(...)` per the existing
// discipline at:
//   docs/solutions/security-issues/html-escape-discipline-vanilla-js-templates-2026-04-29.md
//
// Verbatim from the request that motivated this plan. Legal-text
// precision (entity attribution, exact wording) is deferred to a future
// legal-hardening plan.
export const DISCLAIMER_TEXT = `The data and methods presented are generated from research areas under active development and are provided for general reference only. They may be incomplete, inaccurate, or subject to change without notice and should not be relied upon for official, professional, or high-stakes decisions.

To the fullest extent permitted by law, we disclaim liability for any decisions or actions taken based on this data. Users assume full responsibility for any use of the data.

All datasets and services are provided "as is" without warranties of any kind. We make no guarantees regarding accuracy, completeness, reliability, or availability.

We are not responsible for outages, inaccuracies, or issues arising from third-party services or dependencies used by the platform.

We may modify, suspend, or discontinue the service, user accounts, or any data at any time without notice. Data loss may occur.

Any data, preferences, or settings associated with user accounts are not guaranteed to be secure, confidential, or continuously available. We do not guarantee the preservation or integrity of stored data. Avoid storing sensitive information.

To the fullest extent permitted by law, we disclaim liability for any data loss, unauthorized access, or exposure of data.

Users are responsible for maintaining the security of their account credentials and for any activity that occurs under their account.

Use of the service must not interfere with its operation or attempt to misuse, exploit, or disrupt the platform or its data.

Use of the website and related services must comply with applicable laws and regulations.`;

const VALID_STATUSES = new Set(["accepted", "rejected"]);

/**
 * Returns the user's recorded decision for the current disclaimer version.
 *
 * Returns 'accepted' or 'rejected' only when localStorage has an entry whose
 * version matches `DISCLAIMER_VERSION` AND whose status is recognized.
 * Returns 'pending' for anything else: missing entry, version mismatch
 * (older or newer — strict equality), malformed JSON, unknown status,
 * OR if `localStorage.getItem` itself throws (Safari private mode).
 *
 * @returns {'accepted' | 'rejected' | 'pending'}
 */
export function getDisclaimerStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "pending";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "pending";
    if (parsed.version !== DISCLAIMER_VERSION) return "pending";
    if (!VALID_STATUSES.has(parsed.status)) return "pending";
    return parsed.status;
  } catch {
    return "pending";
  }
}

/**
 * Persists the user's decision to localStorage. Silent on quota / private-mode
 * errors — the in-memory state machine still progresses; the user will simply
 * re-prompt on next visit.
 *
 * @param {'accepted' | 'rejected'} status
 */
export function recordDisclaimerDecision(status) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: DISCLAIMER_VERSION,
        status,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Silent swallow — quota exceeded, private mode, browser disabled storage.
    // Acceptable degradation: in-memory state machine still progresses; user
    // re-prompts on next visit.
  }
}

/**
 * Renders the disclaimer paragraphs as HTML. Splits DISCLAIMER_TEXT on
 * blank lines and wraps each block in a `<p>`. NO interpolation of dynamic
 * values into this template — DISCLAIMER_TEXT is a static constant.
 */
function renderDisclaimerBody() {
  return DISCLAIMER_TEXT.split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

/**
 * Renders the modal contents (header + scrollable body + sticky footer)
 * into a single HTML string. Tailwind utilities inline per the codebase
 * convention (apps.geoglows/CLAUDE.md § Conventions).
 */
function renderDisclaimerModalContents() {
  return `
    <div class="flex flex-col h-full max-h-[90vh]">
      <header class="px-6 pt-6 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 class="text-2xl font-bold text-slate-800 dark:text-white">Disclaimers</h2>
      </header>
      <div tabindex="0" class="flex-1 min-h-0 overflow-y-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-inset">
        ${renderDisclaimerBody()}
      </div>
      <footer class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-white dark:bg-slate-900">
        <button
          id="geoglows-disclaimer-reject"
          type="button"
          class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] transition-colors"
        >
          Reject
        </button>
        <button
          id="geoglows-disclaimer-accept"
          type="button"
          class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px] shadow-sm transition-colors"
        >
          Accept
        </button>
      </footer>
    </div>
  `;
}

/**
 * Mounts the disclaimer modal into the existing `<dialog id="geoglows-disclaimer-modal">`
 * element in `index.html`. Returns an `{ open, close }` handle.
 *
 * Behavior:
 * - Accept and Reject buttons are bound at mount time.
 * - NO cancel-event listener — Escape closes the modal natively (no localStorage write;
 *   user re-prompts on next visit, equivalent to never having seen the modal).
 * - NO backdrop-click listener — native `<dialog>` doesn't close on backdrop click
 *   without an explicit listener; we don't add one.
 *
 * @param {{ onAccept: () => void, onReject: () => void }} handlers
 */
export function mountDisclaimerModal({ onAccept, onReject }) {
  const dialog = document.getElementById("geoglows-disclaimer-modal");
  if (!dialog) {
    throw new Error(
      "mountDisclaimerModal: #geoglows-disclaimer-modal element not found in DOM",
    );
  }

  dialog.innerHTML = renderDisclaimerModalContents();

  dialog
    .querySelector("#geoglows-disclaimer-accept")
    ?.addEventListener("click", () => onAccept());
  dialog
    .querySelector("#geoglows-disclaimer-reject")
    ?.addEventListener("click", () => onReject());

  return {
    open() {
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}

/**
 * Renders the full-page "you've declined" view as an HTML string. Consumer
 * (`main.js`) interpolates this into `#app.innerHTML` when the user has
 * persisted a rejection. The Reconsider button's click is bound by
 * `events.js#bindWorkspaceEvents` (re-bound on every render).
 */
export function renderDisclaimerRejectedPage() {
  return `
    <div class="min-h-screen flex items-center justify-center px-6 water-mesh">
      <div class="max-w-md w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-10">
        <h1 class="text-2xl font-bold text-slate-800 dark:text-white mb-3">
          You've declined the disclaimer
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          You can review and reconsider it at any time. Until then, the GEOGLOWS app library is unavailable.
        </p>
        <button
          id="geoglows-disclaimer-reconsider"
          type="button"
          class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          Reconsider
        </button>
      </div>
    </div>
  `;
}
