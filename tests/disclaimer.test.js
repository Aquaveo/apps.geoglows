import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCLAIMER_VERSION,
  DISCLAIMER_TEXT,
  getDisclaimerStatus,
  recordDisclaimerAcceptance,
  mountDisclaimerModal,
  STORAGE_KEY,
} from "../src/disclaimer.js";

const STORE_KEY = STORAGE_KEY;

describe("disclaimer state helpers", () => {
  beforeEach(() => {
    localStorage.removeItem(STORE_KEY);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.removeItem(STORE_KEY);
  });

  describe("getDisclaimerStatus", () => {
    it("returns 'pending' when localStorage is empty", () => {
      expect(getDisclaimerStatus()).toBe("pending");
    });

    it("returns 'accepted' when localStorage has a current-version accepted entry", () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          version: DISCLAIMER_VERSION,
          status: "accepted",
          timestamp: 1234567890,
        }),
      );
      expect(getDisclaimerStatus()).toBe("accepted");
    });

    it("returns 'pending' when stored version is older than current (re-prompt)", () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          version: "1999-01-01",
          status: "accepted",
          timestamp: 0,
        }),
      );
      expect(getDisclaimerStatus()).toBe("pending");
    });

    it("returns 'pending' when stored version is newer than current (strict equality, not greater-than)", () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          version: "2099-01-01",
          status: "accepted",
          timestamp: 0,
        }),
      );
      expect(getDisclaimerStatus()).toBe("pending");
    });

    it("returns 'pending' when localStorage contains malformed JSON (does NOT throw)", () => {
      localStorage.setItem(STORE_KEY, "not-json");
      expect(getDisclaimerStatus()).toBe("pending");
    });

    it("returns 'pending' when status field is unrecognized", () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          version: DISCLAIMER_VERSION,
          status: "weird",
          timestamp: 0,
        }),
      );
      expect(getDisclaimerStatus()).toBe("pending");
    });

    it("returns 'pending' when localStorage.getItem throws (Safari private mode)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(getDisclaimerStatus()).toBe("pending");
    });
  });

  describe("recordDisclaimerAcceptance", () => {
    it("writes accepted entry to localStorage with current version and a numeric timestamp", () => {
      recordDisclaimerAcceptance();
      const raw = localStorage.getItem(STORE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(DISCLAIMER_VERSION);
      expect(parsed.status).toBe("accepted");
      expect(typeof parsed.timestamp).toBe("number");
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it("after recordDisclaimerAcceptance(), getDisclaimerStatus returns 'accepted'", () => {
      recordDisclaimerAcceptance();
      expect(getDisclaimerStatus()).toBe("accepted");
    });

    it("does NOT throw when localStorage.setItem throws (quota / private mode)", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => recordDisclaimerAcceptance()).not.toThrow();
    });
  });
});

describe("mountDisclaimerModal", () => {
  beforeEach(() => {
    document.body.innerHTML = '<dialog id="geoglows-disclaimer-modal"></dialog>';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the disclaimer title and the first sentence of the body text", () => {
    mountDisclaimerModal({ onAccept: vi.fn() });
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    expect(dialog.innerHTML).toContain("Before you begin");
    expect(dialog.innerHTML).toContain(
      "The data and methods presented are generated from research areas under active development",
    );
  });

  it("renders a single 'I understand' acknowledgment button (no Reject)", () => {
    mountDisclaimerModal({ onAccept: vi.fn() });
    const acceptBtn = document.getElementById("geoglows-disclaimer-accept");
    expect(acceptBtn).not.toBeNull();
    expect(acceptBtn.textContent.trim()).toBe("I understand");
    // No reject button — rejection is deferred to a future plan.
    expect(document.getElementById("geoglows-disclaimer-reject")).toBeNull();
  });

  it("places the heading OUTSIDE the scrollable region (so it is always visible)", () => {
    mountDisclaimerModal({ onAccept: vi.fn() });
    const heading = document.querySelector("#geoglows-disclaimer-modal h2");
    expect(heading).not.toBeNull();
    const scrollContainer = heading.closest('[class*="overflow-y-auto"]');
    expect(scrollContainer).toBeNull();
  });

  it("calls onAccept when the accept button is clicked", () => {
    const onAccept = vi.fn();
    mountDisclaimerModal({ onAccept });
    document.getElementById("geoglows-disclaimer-accept").click();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("does NOT register a cancel-event preventDefault listener (Escape closes modal natively)", () => {
    const onAccept = vi.fn();
    mountDisclaimerModal({ onAccept });
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(false);
    // The acknowledge callback does not fire on Escape — user did not affirmatively click.
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("returns an open/close handle that operates on the dialog", () => {
    const handle = mountDisclaimerModal({ onAccept: vi.fn() });
    expect(typeof handle.open).toBe("function");
    expect(typeof handle.close).toBe("function");
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    handle.open();
    expect(dialog.open).toBe(true);
    handle.close();
    expect(dialog.open).toBe(false);
  });

  it("DISCLAIMER_TEXT is a non-empty string constant exported from the module", () => {
    expect(typeof DISCLAIMER_TEXT).toBe("string");
    expect(DISCLAIMER_TEXT.length).toBeGreaterThan(100);
  });
});
