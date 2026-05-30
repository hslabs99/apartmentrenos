import type { NextConfig } from "next";

/** When false, `next dev --turbopack` — omit `webpack` so Next does not warn that webpack is configured but Turbopack is not. */
const applyWebpackDevConfig = !process.argv.includes("--turbopack");

const nextConfig: NextConfig = {
  /**
   * VirtualBox host-only (and similar) IPs — otherwise HMR WebSocket is blocked when
   * the browser uses http://192.168.56.1:3000 instead of http://localhost:3000.
   */
  allowedDevOrigins: ["192.168.56.1"],
  /** Avoid bundling firebase-admin into route chunks (fixes dev/runtime failures with Turbopack). */
  serverExternalPackages: ["firebase-admin"],
  /** Declares Turbopack is intentional when using `npm run dev:turbo`; avoids mixed-config noise. */
  turbopack: {},
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
        permanent: false,
      },
    ];
  },

  /**
   * Windows polling for `npm run dev:webpack` and production webpack builds only.
   * Turbopack ignores `webpack()` anyway; including it while using `--turbopack` triggers a Next warning.
   */
  ...(applyWebpackDevConfig
    ? {
        webpack: (config, { dev }) => {
          if (dev && process.platform === "win32") {
            config.watchOptions = {
              ...config.watchOptions,
              poll: 1000,
              aggregateTimeout: 300,
            };
          }
          return config;
        },
      }
    : {}),
};

export default nextConfig;
