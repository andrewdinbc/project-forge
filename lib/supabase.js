import { createClient } from '@supabase/supabase-js';

// Lazy-initialized clients - creating these at module scope throws before
// env vars are guaranteed present during Next.js build-time static page
// prerendering (dashboard pages import this and get statically rendered).
// Same root-cause fix already applied on math-mastery and morpheus-scheduler.
// Use Proxy so `import { supabase } from '@/lib/supabase'` call sites work
// completely unchanged - only actually connects on first real property access.

function createLazyClient(getUrl, getKey) {
  let client = null;
  return new Proxy({}, {
    get(target, prop) {
      if (!client) {
        const url = getUrl();
        const key = getKey();
        if (!url || !key) {
          throw new Error('Missing Supabase environment variables');
        }
        client = createClient(url, key);
      }
      return client[prop];
    },
  });
}

export const supabase = createLazyClient(
  () => process.env.SUPABASE_URL,
  () => process.env.SUPABASE_ANON_KEY
);

export const supabaseAdmin = createLazyClient(
  () => process.env.SUPABASE_URL,
  () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default supabase;
