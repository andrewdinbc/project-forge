import BundleBuilder from '@/components/BundleBuilder';

// This page didn't exist before (2026-07-18) -- "New Bundle" linked here
// from the Bundles list but the route was 404. BundleBuilder itself was
// always real but never saved to the database (export-only); it now saves
// via lib/bundles.js createBundle/addProductToBundle, so bundles created
// here actually show up in the Bundles list.
export default function NewBundlePage() {
  return <BundleBuilder />;
}
