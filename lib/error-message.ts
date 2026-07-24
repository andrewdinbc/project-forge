// Extracts a readable message from ANY thrown value (Aj, caught 2026-07-19
// while smoke-testing Schema Lab). The `e instanceof Error ? e.message :
// String(e)` pattern used throughout this codebase's catch blocks silently
// breaks for Supabase/Postgrest errors -- those are plain objects with a
// real `.message` property, but they are NOT `instanceof Error`, so that
// pattern falls through to `String(e)`, which renders any object as the
// literally useless string "[object Object]" instead of the actual
// database error. This masks real errors as unreadable noise.
//
// Durable guard: use this in every new route's catch block instead of
// re-deriving the check inline, so the fix can't quietly regress one route
// at a time. This exact "instanceof Error ? ... : String(e)" pattern also
// exists in ~20 other, pre-existing route files across this app (found via
// a full-repo grep while fixing this) -- those are NOT touched by this
// commit; a dedicated sweep is the right way to fix those rather than
// bundling an unrelated 20-file change into this session.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return String(e);
}

// Same extraction logic as errorMessage, but for call sites that want a
// custom human-readable fallback (e.g. "Failed to save crop") instead of
// String(e) when no real message can be extracted. Added 2026-07-24 during
// the ~20-file instanceof-Error sweep flagged in lib/error-message.ts above
// -- those call sites use `e instanceof Error ? e.message : 'Some fallback'`,
// which has the same Postgrest/plain-object blind spot as the original bug,
// just with a nicer-looking fallback masking it instead of "[object Object]".
export function errorMessageOr(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return fallback;
}
