import {
  loadAccountSummary as loadGeoglowsAccountSummary,
  updateProfile as updateGeoglowsProfile,
  isProfileComplete as isGeoglowsProfileComplete,
} from "@geoglows/geoglows-auth/core";
import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";

export async function loadAccountSummary() {
  const user = await getCurrentUser();
  if (!user?.sub) {
    return { profile: null };
  }

  return loadGeoglowsAccountSummary(supabase, user.sub);
}

/**
 * Update the authenticated user's profile. Returns the updated row.
 * Respects the `profiles_update_own` RLS policy — Supabase enforces
 * that users can only update their own row.
 */
export async function updateProfile(updates) {
  const user = await getCurrentUser();
  if (!user?.sub) {
    throw new Error("Not authenticated");
  }
  return updateGeoglowsProfile(supabase, { id: user.sub, ...updates });
}

/**
 * Predicate: does the profile have the minimum required fields?
 * Re-exported from the library so the rest of the portal calls a
 * local helper.
 */
export function isProfileComplete(profile) {
  return isGeoglowsProfileComplete(profile);
}
