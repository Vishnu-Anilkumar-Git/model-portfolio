import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function contentSecurityPolicy(apiUrl: string): Plugin {
  return {
    name: "portfolio-admin-csp",
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
        // The admin has no inline scripts (unlike the public site's JSON-LD).
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: ${apiOrigin}`,
        "font-src 'self' data:",
        `connect-src 'self' ${apiOrigin}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // frame-ancestors is ignored in a meta CSP; X-Frame-Options in
        // public/_headers covers framing.
      ].join("; ");

      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: csp },
          injectTo: "head-prepend",
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
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
