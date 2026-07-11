import { createClient } from '@supabase/supabase-js';

// Lazy-initialized via Proxy to avoid throwing at module scope: Next.js
// evaluates this during build-time page-data collection, before env vars
// are guaranteed present. Same root-cause bug already fixed on
// math-mastery and morpheus-scheduler - don't reintroduce it here.
// The Proxy preserves the original `supabase.from(...)` call-site API so
// nothing downstream needs to change.
function makeLazyClient(getKey) {
  let client = null;
  return new Proxy({}, {
    get(_target, prop) {
      if (!client) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const key = getKey();
        if (!supabaseUrl || !key) {
          throw new Error('Missing Supabase environment variables (SUPABASE_URL and an anon/service key)');
        }
        client = createClient(supabaseUrl, key);
      }
      return client[prop];
    },
  });
}

export const supabase = makeLazyClient(() => process.env.SUPABASE_ANON_KEY);
export const supabaseAdmin = makeLazyClient(
  () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default supabase;
