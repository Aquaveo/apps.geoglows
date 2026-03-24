// src/supabase.js
// import { createClient } from "@supabase/supabase-js";
// import { getCurrentUser } from "./auth.js";

// export const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
//   {
//     accessToken: async () => {
//       const user = await getCurrentUser();
//       return user?.id_token ?? user?.access_token;
//     },
//   }
// );

import { createGeoglowsSupabaseClient } from "@geoglows/auth/core";
import { auth } from "./auth.js";

export const supabase = createGeoglowsSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  auth,
  useIdToken: true,
});