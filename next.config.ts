import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  // pdfkit loads its default font metrics (Helvetica.afm etc.) from disk via
  // a `path.join(__dirname, ...)` relative to its own package directory at
  // runtime. Bundling it (the default for server code) breaks that lookup --
  // Turbopack traces the call to a virtualized path that doesn't exist on
  // disk (ENOENT for .../pdfkit/js/data/Helvetica.afm). Marking it external
  // makes Next.js `require()` it normally instead, so the real on-disk path
  // resolves correctly.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
