// src/supabase.js

import { createGeoglowsSupabaseClient } from "@geoglows/auth/core";
import { auth } from "./auth.js";

export const supabase = createGeoglowsSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  auth,
  useIdToken: true,
});