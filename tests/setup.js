// Stub the Vite env vars `src/supabase.js` reads at module load time.
// Real Supabase calls are mocked in individual tests; the URL/key here
// just need to be syntactically valid so client construction doesn't
// throw during module import.
import.meta.env.VITE_SUPABASE_URL ??= "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test_key";
