import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const updateProfile = vi.fn();
const loadAccountSummary = vi.fn();

vi.mock("../src/account.js", () => ({
  updateProfile,
  loadAccountSummary,
}));

vi.mock("../src/auth.js", () => ({
  signInRedirect: vi.fn(),
  signOutRedirect: vi.fn(),
  SIGN_IN_REQUESTED_EVENT: "geoglows:sign-in-requested",
}));

vi.mock("../src/theme.js", () => ({
  toggleTheme: vi.fn(),
}));

vi.mock("../src/supabase.js", () => ({
  supabase: { auth: {} },
}));

const { bindWorkspaceEvents } = await import("../src/events.js");

function buildForm({
  first_name = "Ada",
  last_name = "Lovelace",
  middle_name = "",
  user_type = "researcher",
  user_link = "",
} = {}) {
  document.body.innerHTML = `
    <form id="profileEditForm">
      <input name="first_name" value="${first_name}" />
      <input name="middle_name" value="${middle_name}" />
      <input name="last_name" value="${last_name}" />
      <select name="user_type">
        <option value="">none</option>
        <option value="researcher" ${user_type === "researcher" ? "selected" : ""}>researcher</option>
      </select>
      <input name="user_link" value="${user_link}" />
    </form>
  `;
  return document.getElementById("profileEditForm");
}

function submitForm() {
  const form = document.getElementById("profileEditForm");
  form.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("bindWorkspaceEvents — auth navbar buttons (namespaced IDs)", () => {
  // The navbar IDs are owned by @aquaveo/geoglows-auth's renderAuthAction:
  // #geoglowsSignIn (signed-out) and #geoglowsSignOut (signed-in dropdown).
  // events.js must bind those exact IDs so that clicking the navbar fires
  // signInRedirect / signOutRedirect — the bridge SIGN_IN_REQUESTED_EVENT
  // is then dispatched by signInRedirect, which main.js wires to the
  // mountSignInModal handle.

  it("clicking #geoglowsSignIn triggers signInRedirect from the lib's namespaced ID", async () => {
    const { signInRedirect } = await import("../src/auth.js");
    document.body.innerHTML = '<button id="geoglowsSignIn">Sign in</button>';
    bindWorkspaceEvents(vi.fn());

    document.getElementById("geoglowsSignIn").click();

    expect(signInRedirect).toHaveBeenCalled();
  });

  it("clicking #geoglowsSignOut triggers signOutRedirect from the lib's namespaced ID", async () => {
    const { signOutRedirect } = await import("../src/auth.js");
    document.body.innerHTML = '<button id="geoglowsSignOut">Sign out</button>';
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    document.getElementById("geoglowsSignOut").click();
    // Click handler is async; let microtasks settle.
    await Promise.resolve();

    expect(signOutRedirect).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signing_out" }),
    );
  });
});

describe("bindWorkspaceEvents — profile-edit submit", () => {
  it("rejects empty first_name and never calls updateProfile", () => {
    buildForm({ first_name: "  " });
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/first name/i) }),
    );
  });

  it("rejects empty last_name and never calls updateProfile", () => {
    buildForm({ last_name: "" });
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/last name/i) }),
    );
  });

  it("rejects a personal link without an http(s) prefix", () => {
    buildForm({ user_link: "example.com/me" });
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringMatching(/http:\/\/.*https:\/\//i),
      }),
    );
  });

  it("calls updateProfile with the form values, exits edit mode on success", async () => {
    updateProfile.mockResolvedValue({});
    const refreshedAccount = { profile: { first_name: "Ada", last_name: "Lovelace" } };
    loadAccountSummary.mockResolvedValue(refreshedAccount);

    buildForm({
      first_name: "Ada",
      middle_name: "Augusta",
      last_name: "Lovelace",
      user_type: "researcher",
      user_link: "https://example.com",
    });
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();
    // Let the submit handler resolve the awaited updateProfile + loadAccountSummary.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({
      first_name: "Ada",
      middle_name: "Augusta",
      last_name: "Lovelace",
      user_type: "researcher",
      user_link: "https://example.com",
    });

    expect(loadAccountSummary).toHaveBeenCalledTimes(1);

    // Optimistic "saving" patch first, then the success patch.
    expect(setState).toHaveBeenNthCalledWith(1, {
      action: "saving_profile",
      error: null,
    });
    const successPatch = setState.mock.calls.at(-1)[0];
    expect(successPatch).toEqual(
      expect.objectContaining({
        account: refreshedAccount,
        action: null,
        profileEditing: false,
      }),
    );
  });

  it("converts blank optional fields to null in the updateProfile payload", async () => {
    updateProfile.mockResolvedValue({});
    loadAccountSummary.mockResolvedValue({ profile: {} });

    buildForm({
      first_name: "Ada",
      last_name: "Lovelace",
      middle_name: "",
      user_type: "",
      user_link: "",
    });
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(updateProfile).toHaveBeenCalledWith({
      first_name: "Ada",
      middle_name: null,
      last_name: "Lovelace",
      user_type: null,
      user_link: null,
    });
  });

  it("sets a generic error and exits saving state when updateProfile rejects", async () => {
    updateProfile.mockRejectedValue(new Error("rls denied"));

    buildForm();
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(loadAccountSummary).not.toHaveBeenCalled();
    const errorPatch = setState.mock.calls.at(-1)[0];
    expect(errorPatch).toEqual({
      action: null,
      error: expect.stringMatching(/couldn't save your profile/i),
    });
  });
});
