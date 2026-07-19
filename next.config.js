/** @type {import('next').NextConfig} */
const nextConfig = {
  // @napi-rs/canvas ships prebuilt native .node binaries (platform-specific
  // Rust/Skia bindings). Webpack tries to parse everything it bundles as
  // JS/text, which fails hard on a raw binary file -- these packages need
  // to stay external (loaded via Node's native require at runtime, not
  // bundled) instead. unpdf dynamically imports @napi-rs/canvas, so it's
  // included too even though it has no native code of its own. Added
  // 2026-07-19 for the PDF page-crop tool (lib/pdf-page-render.js).
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'unpdf'],
  },
};
module.exports = nextConfig;
