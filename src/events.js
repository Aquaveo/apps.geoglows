import { auth } from "./auth.js";
import { loadAccountSummary, createOrganization, selectActiveOrg } from "./account.js";
import { toggleTheme } from "./theme.js";

export function bindWorkspaceEvents(setState) {
  document.getElementById("signIn")?.addEventListener("click", async () => {
    try {
      await auth.signInRedirect();
    } catch (error) {
      console.error("Sign in failed:", error);
      setState({ error });
    }
  });

  document.getElementById("signOut")?.addEventListener("click", async () => {
    setState({ action: "signing_out" });
    try {
      await auth.signOutRedirect();
    } catch (error) {
      console.error("Sign out failed:", error);
      setState({ action: null, error });
    }
  });

  document.getElementById("orgSelector")?.addEventListener("change", async (e) => {
    const orgId = e.target.value;
    if (!orgId) return;

    setState({ action: "switching_org", error: null });
    try {
      selectActiveOrg(orgId);
      const account = await loadAccountSummary();
      setState({ account, action: null });
    } catch (error) {
      console.error("Failed to switch organization:", error);
      setState({ action: null, error });
    }
  });

  document.getElementById("createOrgForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = document.getElementById("createOrgName");
    const name = input?.value?.trim();
    if (!name) return;

    setState({ action: "creating_org", error: null });
    try {
      await createOrganization(name);
      const account = await loadAccountSummary();
      setState({ account, action: null });
    } catch (error) {
      console.error("Failed to create organization:", error);
      setState({ action: null, error });
    }
  });

  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);
}
