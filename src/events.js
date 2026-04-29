import { signInRedirect, signOutRedirect } from "./auth.js";
import { loadAccountSummary, updateProfile } from "./account.js";
import { toggleTheme } from "./theme.js";

export function bindWorkspaceEvents(setState) {
  document.getElementById("signIn")?.addEventListener("click", async () => {
    try {
      // The wrapper from auth.js dispatches the geoglows:sign-in-requested
      // event the inline modal listens for.
      await signInRedirect();
    } catch (error) {
      console.error("Sign in failed:", error);
      setState({ error });
    }
  });

  document.getElementById("signOut")?.addEventListener("click", async () => {
    setState({ action: "signing_out" });
    try {
      await signOutRedirect();
    } catch (error) {
      console.error("Sign out failed:", error);
      setState({ action: null, error });
    }
  });

  // Profile page — completion banner handlers
  document
    .getElementById("profileBannerDismiss")
    ?.addEventListener("click", () => {
      setState({ profileBannerDismissed: true });
    });

  document
    .getElementById("profileBannerComplete")
    ?.addEventListener("click", () => {
      setState({ profileEditing: true, error: null });
    });

  // Profile page — view <-> edit toggle
  document.getElementById("profileEditButton")?.addEventListener("click", () => {
    setState({ profileEditing: true, error: null });
  });

  document
    .getElementById("profileEditCancel")
    ?.addEventListener("click", () => {
      setState({ profileEditing: false, error: null });
    });

  document
    .getElementById("profileEditForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const firstName = form.elements.first_name.value.trim();
      const lastName = form.elements.last_name.value.trim();
      const middleName = form.elements.middle_name.value.trim();
      const phoneNumber = form.elements.phone_number.value.trim();
      const userType = form.elements.user_type.value;
      const address = form.elements.address.value.trim();
      const userLink = form.elements.user_link.value.trim();

      if (!firstName) {
        setState({ error: "Please enter your first name." });
        return;
      }
      if (!lastName) {
        setState({ error: "Please enter your last name." });
        return;
      }
      if (userLink && !/^https?:\/\//i.test(userLink)) {
        setState({
          error: "Personal link must start with http:// or https://",
        });
        return;
      }

      setState({ action: "saving_profile", error: null });
      try {
        await updateProfile({
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          phone_number: phoneNumber || null,
          user_type: userType || null,
          address: address || null,
          user_link: userLink || null,
        });
        const account = await loadAccountSummary();
        setState({
          account,
          action: null,
          profileEditing: false,
          profileBannerDismissed: false,
        });
      } catch (error) {
        console.error("Profile update failed:", error);
        setState({
          action: null,
          error: "We couldn't save your profile. Please try again.",
        });
      }
    });

  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);
}
