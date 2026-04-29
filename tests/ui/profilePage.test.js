import { afterEach, describe, expect, it } from "vitest";
import { renderProfilePage } from "../../src/ui/profilePage.js";

function buildState(overrides = {}) {
  return {
    user: {
      sub: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    },
    account: {
      profile: {
        id: "user-1",
        email: "ada@example.com",
        display_name: "Ada Lovelace",
        first_name: "Ada",
        last_name: "Lovelace",
        ...overrides.profile,
      },
    },
    profileEditing: false,
    profileBannerDismissed: false,
    action: null,
    error: null,
    ...overrides,
  };
}

function render(state) {
  document.body.innerHTML = `<main>${renderProfilePage(state)}</main>`;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderProfilePage — signed-out", () => {
  it("shows the sign-in CTA when no user is present", () => {
    const dom = render({ user: null });
    expect(dom.textContent).toMatch(/sign in to view your profile/i);
    expect(dom.querySelector("#signIn")).not.toBeNull();
  });
});

describe("renderProfilePage — view mode (signed in)", () => {
  it("renders the user's display name and email in the header", () => {
    const dom = render(buildState());
    // Two <h2>: the section title ("Your Profile") and the user's name.
    const headings = [...dom.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Ada Lovelace");
    expect(dom.textContent).toContain("ada@example.com");
  });

  it("formats user_type using the human-readable label", () => {
    const dom = render(buildState({ profile: { user_type: "agency_staff" } }));
    expect(dom.textContent).toContain("Agency staff");
    expect(dom.textContent).not.toContain("agency_staff");
  });

  it("falls back to the raw user_type value when no label is registered", () => {
    const dom = render(buildState({ profile: { user_type: "unknown_role" } }));
    expect(dom.textContent).toContain("unknown_role");
  });

  it("renders the personal link as a clickable anchor (regression: COR-001)", () => {
    const dom = render(
      buildState({ profile: { user_link: "https://example.com/me" } }),
    );
    const anchor = dom.querySelector('a[href="https://example.com/me"]');
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.textContent.trim()).toBe("https://example.com/me");
    // The bug we fixed produced literal "&lt;a href=...&gt;" text. Make
    // sure no escaped tag survives anywhere on the page.
    expect(dom.innerHTML).not.toContain("&lt;a ");
  });

  it("escapes XSS payloads in display_name (regression: SEC-001)", () => {
    const dom = render(
      buildState({
        account: {
          profile: {
            id: "user-1",
            email: "ada@example.com",
            display_name: "<img src=x onerror=alert(1)>",
            first_name: "<img src=x onerror=alert(1)>",
            last_name: "Lovelace",
          },
        },
      }),
    );
    // The <img> must NOT appear as a real DOM node — only as escaped text.
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.innerHTML).toContain("&lt;img");
  });

  it("escapes XSS payloads in user_link href (regression: SEC-001)", () => {
    const payload = 'https://example.com" onmouseover="alert(1)';
    const dom = render(buildState({ profile: { user_link: payload } }));
    const anchor = dom.querySelector("a[href]");
    // The injected attribute must not have escaped the href quoting.
    expect(anchor).not.toBeNull();
    expect(anchor.hasAttribute("onmouseover")).toBe(false);
  });

  it('shows "Not provided" for missing first_name and last_name', () => {
    const dom = render(
      buildState({
        account: {
          profile: {
            id: "user-1",
            email: "ada@example.com",
            display_name: null,
            first_name: null,
            last_name: null,
          },
        },
      }),
    );
    const matches = dom.innerHTML.match(/Not provided/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the empty placeholder "—" for optional fields when blank', () => {
    const dom = render(
      buildState({ profile: { phone_number: null, address: null } }),
    );
    expect(dom.innerHTML).toContain("—");
  });
});

describe("renderProfilePage — completion banner", () => {
  it("hides the banner when the profile is complete", () => {
    const dom = render(buildState());
    expect(dom.querySelector('[role="alert"]')).toBeNull();
  });

  it("hides the banner when the user has dismissed it", () => {
    const dom = render(
      buildState({
        profile: { first_name: null, last_name: null },
        profileBannerDismissed: true,
      }),
    );
    expect(dom.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows the banner when the profile is incomplete and not dismissed", () => {
    const dom = render(
      buildState({ profile: { first_name: null, last_name: null } }),
    );
    const banner = dom.querySelector('[role="alert"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toMatch(/profile is missing/i);
    expect(banner.querySelector("#profileBannerDismiss")).not.toBeNull();
    expect(banner.querySelector("#profileBannerComplete")).not.toBeNull();
  });
});

describe("renderProfilePage — edit mode", () => {
  it("pre-fills inputs from the profile", () => {
    const dom = render(
      buildState({
        profileEditing: true,
        profile: {
          first_name: "Ada",
          middle_name: "Augusta",
          last_name: "Lovelace",
          phone_number: "+44 20 7946 0000",
          user_type: "researcher",
          address: "London",
          user_link: "https://example.com",
        },
      }),
    );
    expect(dom.querySelector('input[name="first_name"]').value).toBe("Ada");
    expect(dom.querySelector('input[name="middle_name"]').value).toBe(
      "Augusta",
    );
    expect(dom.querySelector('input[name="last_name"]').value).toBe(
      "Lovelace",
    );
    expect(dom.querySelector('input[name="phone_number"]').value).toBe(
      "+44 20 7946 0000",
    );
    const userTypeSelect = dom.querySelector('select[name="user_type"]');
    expect(userTypeSelect.value).toBe("researcher");
    expect(dom.querySelector('textarea[name="address"]').value).toBe("London");
    expect(dom.querySelector('input[name="user_link"]').value).toBe(
      "https://example.com",
    );
  });

  it("disables every form control while saving", () => {
    const dom = render(
      buildState({ profileEditing: true, action: "saving_profile" }),
    );
    const form = dom.querySelector("#profileEditForm");
    const inputs = form.querySelectorAll(
      "input, textarea, select, button",
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const el of inputs) {
      expect(el.disabled).toBe(true);
    }
    expect(form.querySelector('button[type="submit"]').textContent).toMatch(
      /saving/i,
    );
  });

  it("renders the error banner when state.error is set", () => {
    const dom = render(
      buildState({
        profileEditing: true,
        error: "We couldn't save your profile. Please try again.",
      }),
    );
    const alert = dom.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toMatch(/couldn't save your profile/i);
  });

  it("escapes errors before injecting them into the DOM", () => {
    const dom = render(
      buildState({
        profileEditing: true,
        error: "<img src=x onerror=alert(1)>",
      }),
    );
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.innerHTML).toContain("&lt;img");
  });
});
