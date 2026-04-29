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
  phone_number = "",
  user_type = "researcher",
  address = "",
  user_link = "",
} = {}) {
  document.body.innerHTML = `
    <form id="profileEditForm">
      <input name="first_name" value="${first_name}" />
      <input name="middle_name" value="${middle_name}" />
      <input name="last_name" value="${last_name}" />
      <input name="phone_number" value="${phone_number}" />
      <select name="user_type">
        <option value="">none</option>
        <option value="researcher" ${user_type === "researcher" ? "selected" : ""}>researcher</option>
      </select>
      <textarea name="address">${address}</textarea>
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
      phone_number: "+1-555",
      user_type: "researcher",
      address: "London",
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
      phone_number: "+1-555",
      user_type: "researcher",
      address: "London",
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

  it("does NOT reset profileBannerDismissed after a successful save (MAINT-001)", async () => {
    updateProfile.mockResolvedValue({});
    loadAccountSummary.mockResolvedValue({ profile: {} });

    buildForm();
    const setState = vi.fn();
    bindWorkspaceEvents(setState);

    submitForm();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const successPatch = setState.mock.calls.at(-1)[0];
    expect(successPatch).not.toHaveProperty("profileBannerDismissed");
  });

  it("converts blank optional fields to null in the updateProfile payload", async () => {
    updateProfile.mockResolvedValue({});
    loadAccountSummary.mockResolvedValue({ profile: {} });

    buildForm({
      first_name: "Ada",
      last_name: "Lovelace",
      middle_name: "",
      phone_number: "",
      user_type: "",
      address: "",
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
      phone_number: null,
      user_type: null,
      address: null,
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
