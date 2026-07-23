import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Circle server SDKs are resolved by Node at runtime instead of being
  // bundled — their optional Solana path would otherwise break the build.
  serverExternalPackages: [
    "@circle-fin/developer-controlled-wallets",
    "@circle-fin/adapter-circle-wallets",
    "@circle-fin/app-kit",
    "@circle-fin/x402-batching",
  ],
};

export default nextConfig;
