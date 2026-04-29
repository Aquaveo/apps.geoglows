import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mocks must be declared before importing the module under test.
const signInWithPassword = vi.fn();
const signInWithOAuth = vi.fn();
const signUp = vi.fn();

vi.mock("../../src/auth.js", () => ({
  SIGN_IN_REQUESTED_EVENT: "geoglows:sign-in-requested",
  signInWithPassword,
  signInWithOAuth,
}));

vi.mock("../../src/supabase.js", () => ({
  supabase: { auth: { signUp } },
}));

// Some jsdom builds don't implement HTMLDialogElement methods that the
// modal uses (showModal/close). Stub them with attribute-driven proxies
// so the tests can drive the open/close lifecycle.
function patchDialogPrototype() {
  const proto = window.HTMLDialogElement?.prototype;
  if (!proto) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal() {
      this.setAttribute("open", "");
      Object.defineProperty(this, "open", {
        configurable: true,
        get: () => this.hasAttribute("open"),
      });
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}

const { mountSignInModal } = await import("../../src/ui/signInModal.js");
const { SIGN_IN_REQUESTED_EVENT } = await import("../../src/auth.js");

function openModal() {
  window.dispatchEvent(new Event(SIGN_IN_REQUESTED_EVENT));
  return document.querySelector("#signInModal");
}

function switchToSignUp(dialog) {
  dialog.querySelector("#signInToggleMode").click();
}

function fillSignUp(dialog, { firstName, lastName, email, password }) {
  if (firstName !== undefined) {
    dialog.querySelector('input[name="first_name"]').value = firstName;
  }
  if (lastName !== undefined) {
    dialog.querySelector('input[name="last_name"]').value = lastName;
  }
  if (email !== undefined) {
    dialog.querySelector('input[name="email"]').value = email;
  }
  if (password !== undefined) {
    dialog.querySelector('input[name="password"]').value = password;
  }
}

function submit(dialog) {
  const form = dialog.querySelector("#signInPasswordForm");
  form.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  return form;
}

beforeEach(() => {
  patchDialogPrototype();
  document.body.innerHTML = "";
  vi.clearAllMocks();
  mountSignInModal();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("signInModal — sign-up branch", () => {
  it("toggling to sign-up reveals first_name and last_name fields", () => {
    const dialog = openModal();
    expect(dialog.querySelector('input[name="first_name"]')).toBeNull();
    switchToSignUp(dialog);
    expect(dialog.querySelector('input[name="first_name"]')).not.toBeNull();
    expect(dialog.querySelector('input[name="last_name"]')).not.toBeNull();
  });

  it("rejects empty first_name with a visible error", async () => {
    const dialog = openModal();
    switchToSignUp(dialog);
    fillSignUp(dialog, {
      firstName: "  ",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "hunter2",
    });
    submit(dialog);
    // Wait a microtask for setModalState's re-render.
    await new Promise((r) => setTimeout(r, 0));
    const alert = dialog.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toMatch(/first name/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects empty last_name with a visible error", async () => {
    const dialog = openModal();
    switchToSignUp(dialog);
    fillSignUp(dialog, {
      firstName: "Ada",
      lastName: "  ",
      email: "ada@example.com",
      password: "hunter2",
    });
    submit(dialog);
    await new Promise((r) => setTimeout(r, 0));
    const alert = dialog.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toMatch(/last name/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("calls supabase.auth.signUp with first_name, last_name, full_name in user_metadata", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    const dialog = openModal();
    switchToSignUp(dialog);
    fillSignUp(dialog, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "hunter2",
    });
    submit(dialog);
    // Wait for the async handler.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        password: "hunter2",
        options: expect.objectContaining({
          data: {
            first_name: "Ada",
            last_name: "Lovelace",
            full_name: "Ada Lovelace",
          },
        }),
      }),
    );
  });

  it("transitions the modal to the email-confirmation view on signUp success", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    const dialog = openModal();
    switchToSignUp(dialog);
    fillSignUp(dialog, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "hunter2",
    });
    submit(dialog);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(dialog.textContent).toMatch(/check your email/i);
    expect(dialog.querySelector("#signInBackToForm")).not.toBeNull();
  });

  it("shows the generic signup error when supabase.auth.signUp rejects", async () => {
    signUp.mockResolvedValue({
      data: null,
      error: new Error("user already registered"),
    });
    const dialog = openModal();
    switchToSignUp(dialog);
    fillSignUp(dialog, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "hunter2",
    });
    submit(dialog);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toMatch(/couldn't create your account/i);
    // Form must be re-enabled so the user can retry.
    expect(
      dialog.querySelector('input[name="email"]').disabled,
    ).toBe(false);
  });
});
