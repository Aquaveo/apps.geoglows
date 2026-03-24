import {
  loadAccountSummary as loadGeoglowsAccountSummary,
  createOrganization as createGeoglowsOrganization,
  setActiveOrgId,
} from "@geoglows/auth/core";
import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";

export async function loadAccountSummary() {
  const user = await getCurrentUser();
  if (!user?.sub) {
    return {
      profile: null,
      memberships: [],
      organizations: [],
      activeOrgId: null,
      activeOrg: null,
      activeRole: null,
    };
  }

  return loadGeoglowsAccountSummary(supabase, user.sub);
}

export async function createOrganization(name) {
  return createGeoglowsOrganization(supabase, name);
}

export function selectActiveOrg(orgId) {
  setActiveOrgId(orgId);
}