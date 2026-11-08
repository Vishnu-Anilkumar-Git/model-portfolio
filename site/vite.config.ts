import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The site is pre-rendered, so the CSP travels in the built HTML. JSON-LD is an
 * inert data block written at build time, which means executable inline scripts
 * are no longer needed. Every other source is locked to this origin plus API.
 */
function contentSecurityPolicy(apiUrl: string): Plugin {
  return {
    name: "portfolio-csp",
    apply: "build",
    transformIndexHtml() {
      let apiOrigin = "https://api.vishnuanilkumar.in";
      try {
        apiOrigin = new URL(apiUrl).origin;
      } catch {
        // Keep the production default if the URL is malformed.
      }

      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: ${apiOrigin}`,
        "font-src 'self' data:",
        `connect-src 'self' ${apiOrigin}`,
        "media-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // frame-ancestors is ignored in a meta CSP (and logs an error).
        // Clickjacking is covered by X-Frame-Options in public/_headers.
      ].join("; ");

      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: csp },
          injectTo: "head-prepend",
        },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: apiOrigin, crossorigin: "" },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(apiUrl)],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    build: {
      // Production source maps are requested so field errors stay debuggable.
      sourcemap: true,
      // HeroCanvas is a dynamic import, so three.js gets its own async chunk.
      // Do not force it through manualChunks: Rollup hoists React's CommonJS
      // wrappers into that chunk, which makes the entry import and preload it
      // on every page, including mobile where the canvas never mounts.
    },
    server: {
      port: 5173,
    },
  };
});
