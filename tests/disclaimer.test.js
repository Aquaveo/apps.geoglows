import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCLAIMER_VERSION,
  DISCLAIMER_TEXT,
  getDisclaimerStatus,
  recordDisclaimerDecision,
  mountDisclaimerModal,
  renderDisclaimerRejectedPage,
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

    it("returns 'rejected' when localStorage has a current-version rejected entry", () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          version: DISCLAIMER_VERSION,
          status: "rejected",
          timestamp: 1234567890,
        }),
      );
      expect(getDisclaimerStatus()).toBe("rejected");
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

  describe("recordDisclaimerDecision", () => {
    it("writes accepted entry to localStorage with current version and a numeric timestamp", () => {
      recordDisclaimerDecision("accepted");
      const raw = localStorage.getItem(STORE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(DISCLAIMER_VERSION);
      expect(parsed.status).toBe("accepted");
      expect(typeof parsed.timestamp).toBe("number");
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it("writes rejected entry to localStorage", () => {
      recordDisclaimerDecision("rejected");
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      expect(parsed.version).toBe(DISCLAIMER_VERSION);
      expect(parsed.status).toBe("rejected");
    });

    it("after recordDisclaimerDecision('accepted'), getDisclaimerStatus returns 'accepted'", () => {
      recordDisclaimerDecision("accepted");
      expect(getDisclaimerStatus()).toBe("accepted");
    });

    it("after recordDisclaimerDecision('rejected'), getDisclaimerStatus returns 'rejected'", () => {
      recordDisclaimerDecision("rejected");
      expect(getDisclaimerStatus()).toBe("rejected");
    });

    it("does NOT throw when localStorage.setItem throws (quota / private mode)", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => recordDisclaimerDecision("accepted")).not.toThrow();
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
    mountDisclaimerModal({ onAccept: vi.fn(), onReject: vi.fn() });
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    expect(dialog.innerHTML).toContain("Disclaimers");
    // Match the first sentence of the disclaimer text verbatim.
    expect(dialog.innerHTML).toContain(
      "The data and methods presented are generated from research areas under active development",
    );
  });

  it("renders Accept and Reject buttons with the documented IDs", () => {
    mountDisclaimerModal({ onAccept: vi.fn(), onReject: vi.fn() });
    expect(document.getElementById("geoglows-disclaimer-accept")).not.toBeNull();
    expect(document.getElementById("geoglows-disclaimer-reject")).not.toBeNull();
  });

  it("places the heading OUTSIDE the scrollable region (so it is always visible)", () => {
    mountDisclaimerModal({ onAccept: vi.fn(), onReject: vi.fn() });
    const heading = document.querySelector(
      "#geoglows-disclaimer-modal h2",
    );
    expect(heading).not.toBeNull();
    // The heading must NOT be a descendant of an overflow-y-auto element.
    const scrollContainer = heading.closest('[class*="overflow-y-auto"]');
    expect(scrollContainer).toBeNull();
  });

  it("calls onAccept when the accept button is clicked", () => {
    const onAccept = vi.fn();
    mountDisclaimerModal({ onAccept, onReject: vi.fn() });
    document.getElementById("geoglows-disclaimer-accept").click();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onReject when the reject button is clicked", () => {
    const onReject = vi.fn();
    mountDisclaimerModal({ onAccept: vi.fn(), onReject });
    document.getElementById("geoglows-disclaimer-reject").click();
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("does NOT register a cancel-event preventDefault listener (Escape closes modal natively)", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    mountDisclaimerModal({ onAccept, onReject });
    const dialog = document.getElementById("geoglows-disclaimer-modal");
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    // Default action was not prevented — Escape would close the dialog natively.
    expect(cancelEvent.defaultPrevented).toBe(false);
    // Neither callback fires on Escape (the user did not affirmatively choose).
    expect(onAccept).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("returns an open/close handle that operates on the dialog", () => {
    const handle = mountDisclaimerModal({ onAccept: vi.fn(), onReject: vi.fn() });
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

describe("renderDisclaimerRejectedPage", () => {
  it("returns an HTML string containing the rejection message and a Reconsider button", () => {
    const html = renderDisclaimerRejectedPage();
    expect(html).toContain("declined");
    expect(html).toContain('id="geoglows-disclaimer-reconsider"');
    expect(html.toLowerCase()).toContain("reconsider");
  });
});
