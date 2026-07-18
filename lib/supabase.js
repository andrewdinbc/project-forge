import { createClient } from '@supabase/supabase-js';

// Lazy-initialized clients - creating these at module scope throws before
// env vars are guaranteed present during Next.js build-time static page
// prerendering (dashboard pages import this and get statically rendered).
// Same root-cause fix already applied on math-mastery and morpheus-scheduler.
// Use Proxy so `import { supabase } from '@/lib/supabase'` call sites work
// completely unchanged - only actually connects on first real property access.
//
// Fixed 2026-07-18: `supabase` (the anon-key client) is used directly in
// 'use client' components -- login/signup pages, dashboard layout's
// getCurrentUser(), Products page, etc. -- so it genuinely runs in the
// BROWSER. Next.js only exposes env vars prefixed NEXT_PUBLIC_ to client
// bundles; the unprefixed SUPABASE_URL/SUPABASE_ANON_KEY this used to read
// are server-only and come back undefined in the browser, which is why
// every login attempt failed with "Missing Supabase environment variables"
// even though the vars existed under their unprefixed names. `supabaseAdmin`
// (service-role client) stays server-only, unprefixed names are correct
// there since it's never imported into a 'use client' file.

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

// Client-safe (browser) instance -- needs NEXT_PUBLIC_ prefixed vars.
export const supabase = createLazyClient(
  () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

// Server-only instance (API routes) -- unprefixed vars are correct here,
// and using the service role key here is intentional/safe since this never
// reaches the browser.
export const supabaseAdmin = createLazyClient(
  () => process.env.SUPABASE_URL,
  () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default supabase;
