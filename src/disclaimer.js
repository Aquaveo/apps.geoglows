// src/disclaimer.js
//
// First-visit disclaimer modal: pure helpers + DOM mount.
//
// Per plan docs/plans/2026-04-30-006-feat-disclaimer-acceptance-modal-plan.md.
// This is an INFORMATIVE notice (terms-of-use style): a single
// "I understand" button acknowledges the disclaimer. The user cannot
// "reject" — rejection (declining + a rejection page + Reconsider flow)
// is deferred to a future plan along with audit-trail / per-account
// enforcement / entity attribution.
//
// Recovery flow is NOT gated by the disclaimer; this module is a UI gate only.
// localStorage tampering / dev-tools bypass is acknowledged out-of-scope.

// DISCLAIMER_VERSION — string identifier for the current disclaimer text.
// BUMP this constant whenever DISCLAIMER_TEXT changes (any wording change,
// even a typo fix). Bumping forces all existing users to re-acknowledge.
// Comparison is strict equality on the version string — not greater-than/less-than.
export const DISCLAIMER_VERSION = "2026-04-30";

// localStorage key under which the user's acknowledgment is persisted.
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

/**
 * Returns the user's acknowledgment status for the current disclaimer version.
 *
 * Returns 'accepted' only when localStorage has an entry whose version matches
 * `DISCLAIMER_VERSION` AND whose status is 'accepted'.
 * Returns 'pending' for anything else: missing entry, version mismatch
 * (older or newer — strict equality), malformed JSON, unknown status,
 * OR if `localStorage.getItem` itself throws (Safari private mode).
 *
 * @returns {'accepted' | 'pending'}
 */
export function getDisclaimerStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "pending";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "pending";
    if (parsed.version !== DISCLAIMER_VERSION) return "pending";
    if (parsed.status !== "accepted") return "pending";
    return "accepted";
  } catch {
    return "pending";
  }
}

/**
 * Persists the user's acknowledgment to localStorage. Silent on quota /
 * private-mode errors — the in-memory state machine still progresses; the
 * user will simply re-prompt on next visit.
 */
export function recordDisclaimerAcceptance() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: DISCLAIMER_VERSION,
        status: "accepted",
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Silent swallow — quota exceeded, private mode, browser disabled storage.
  }
}

/**
 * Renders the disclaimer paragraphs as HTML. Splits DISCLAIMER_TEXT on
 * blank lines and wraps each block in a `<p>`. NO interpolation of dynamic
 * values into this template — DISCLAIMER_TEXT is a static constant.
 */
const DISCLAIMER_PARAGRAPHS = DISCLAIMER_TEXT.split(/\n\s*\n/);

function renderDisclaimerSection(from, to) {
  return DISCLAIMER_PARAGRAPHS.slice(from, to)
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
        <div class="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-500" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
          <span class="font-bold text-sm tracking-wider text-blue-600 dark:text-slate-400 uppercase">GEOGLOWS</span>
        </div>
        <h2 class="font-display text-2xl text-slate-800 dark:text-white">Before you begin</h2>
      </header>
      <div tabindex="0" class="flex-1 min-h-0 overflow-y-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-4 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-inset">
        <p class="text-slate-600 dark:text-slate-400">
          GEOGLOWS provides open water intelligence tools for research and exploration. Please review the following before using the platform.
        </p>

        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500 pt-2">Data accuracy</h3>
        ${renderDisclaimerSection(0, 3)}

        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500 pt-2">Service availability</h3>
        ${renderDisclaimerSection(3, 5)}

        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500 pt-2">Your account</h3>
        ${renderDisclaimerSection(5, 8)}

        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500 pt-2">Acceptable use</h3>
        ${renderDisclaimerSection(8, 10)}
      </div>
      <footer class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-white dark:bg-slate-900">
        <button
          id="geoglows-disclaimer-accept"
          type="button"
          class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[44px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          I understand
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
 * - Single "I understand" button bound at mount time.
 * - NO cancel-event listener — Escape closes the modal natively (no localStorage write;
 *   user re-prompts on next visit, equivalent to never having seen the modal).
 * - NO backdrop-click listener — native `<dialog>` doesn't close on backdrop click
 *   without an explicit listener; we don't add one.
 *
 * @param {{ onAccept: () => void }} handlers
 */
export function mountDisclaimerModal({ onAccept }) {
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

  return {
    open() {
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
