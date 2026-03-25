// src/profile.js

import { ensureProfile as ensureGeoglowsProfile } from "@aquaveo/geoglows-auth/core";
import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";

export async function ensureProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  return ensureGeoglowsProfile(supabase, user);
}