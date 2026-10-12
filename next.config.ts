import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-nice-avatar's bundled ESM default class component ("extends
  // Component") evaluates to "Super expression must be null or a function" in
  // Next's server/build module graph — its genConfig helper and <Avatar> are
  // imported by server code (lib/avatar.ts → roster, home). Keeping it
  // external makes the server load its CJS build via native require, where the
  // React interop resolves correctly.
  serverExternalPackages: ["react-nice-avatar"],
};

export default nextConfig;
