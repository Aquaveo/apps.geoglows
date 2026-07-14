// src/supabase.js

import { createGeoglowsSupabaseClient } from "@geoglows/geoglows-auth/core";

// Single Supabase client serves both as the data layer and (via auth.js)
// as the identity provider. No external `auth` adapter is passed here —
// Supabase Auth manages its own session natively.
export const supabase = createGeoglowsSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
