// Stub the Vite env vars `src/supabase.js` reads at module load time.
// Real Supabase calls are mocked in individual tests; the URL/key here
// just need to be syntactically valid so client construction doesn't
// throw during module import.
import.meta.env.VITE_SUPABASE_URL ??= "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test_key";

// jsdom 26 ships HTMLDialogElement without showModal/close. Patch the
// prototype so any test that mounts a <dialog> can call .showModal() and
// .close() without crashing. See:
//   docs/solutions/test-failures/jsdom-26-htmldialogelement-undefined-2026-04-29.md
if (typeof HTMLDialogElement !== "undefined") {
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
      this.open = true;
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== "function") {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

// jsdom 26 in this vitest config exposes `localStorage` / `sessionStorage`
// as plain empty objects with no Storage methods. Polyfill a minimal
// Map-backed Storage implementation so tests that exercise localStorage
// (e.g. tests/disclaimer.test.js — first consumer) work.
function createStoragePolyfill() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

if (typeof globalThis.localStorage === "undefined" ||
    typeof globalThis.localStorage.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStoragePolyfill(),
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.sessionStorage === "undefined" ||
    typeof globalThis.sessionStorage.getItem !== "function") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createStoragePolyfill(),
    configurable: true,
    writable: true,
  });
}
