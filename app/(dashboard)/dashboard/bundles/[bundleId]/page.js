import BundleBuilder from '@/components/BundleBuilder';

// This page didn't exist before (2026-07-18) -- clicking a bundle card on
// the Bundles list 404'd. Loads the existing bundle (title/description/
// items) into BundleBuilder for editing.
//
// Known follow-up: editing an existing bundle's product list currently only
// updates title/description/price on save -- it does not diff and rewrite
// bundle_items (add/remove products) the way NewBundlePage's create flow
// does. Wire that up in lib/bundles.js (removeProductFromBundle for items
// no longer in the list, addProductToBundle for new ones) before relying on
// edit mode to change bundle contents.
export default function EditBundlePage({ params }) {
  return <BundleBuilder bundleId={params.bundleId} />;
}
