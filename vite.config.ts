import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Sent with every page, API response and static file. Vercel adds HSTS on its own.
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // No other site may frame iCoach (clickjacking); the mobile apps load it directly, not in a frame.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  "Permissions-Policy":
    "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
};

// Nitro's deploy target defaults to a Node server. Hosting platforms pick theirs with the
// NITRO_PRESET env var (see vercel.json / netlify.toml).
export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Server-only modules must never be pulled into the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build"
      ? [
          nitro({
            vercel: {
              // Run the server in Frankfurt, next to the Supabase database (eu-central-1). The
              // default (Washington, iad1) added a transatlantic round trip to every query.
              functions: { regions: ["fra1"] },
              // Written as a Vercel route rather than a Nitro routeRule: Nitro's version omits
              // `continue`, which would end routing before pages reach the server function.
              config: {
                version: 3,
                routes: [{ src: "/(.*)", headers: securityHeaders, continue: true }],
              },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
