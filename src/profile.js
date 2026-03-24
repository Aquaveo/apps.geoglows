// src/profile.js
// import { supabase } from "./profile.js";
// import { getCurrentUser } from "./auth.js";

// export async function ensureProfile() {
//   const user = await getCurrentUser();
//   if (!user?.profile?.sub) return null;

//   const payload = {
//     id: user.profile.sub,
//     email: user.profile.email ?? "",
//     display_name:
//       user.profile.name ||
//       user.profile.preferred_username ||
//       user.profile.email ||
//       null,
//   };

//   const { error } = await supabase.from("profiles").upsert(payload, {
//     onConflict: "id",
//   });

//   if (error) {
//     console.error("Failed to upsert profile:", error);
//     throw error;
//   }

//   return payload;
// };

import { ensureProfile as ensureGeoglowsProfile } from "@geoglows/auth/core";
import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";

export async function ensureProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  return ensureGeoglowsProfile(supabase, user);
}