import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"

const API_TARGET = process.env.API_TARGET ?? "http://localhost:8787"
const SITE_TARGET = process.env.SITE_TARGET ?? "http://localhost:4321"

export default defineConfig({
  base: "/app/",
  plugins: [vue(), tailwindcss()],
  server: {
    // The site proxies /app to this exact port, so fail loudly on a conflict
    // rather than drifting to another port.
    strictPort: true,
    proxy: {
      // Proxying keeps the session cookie same-origin in development.
      "/api": { target: API_TARGET, changeOrigin: true },
      // In production one reverse proxy serves the site and the SPA from one
      // origin, so the legal links are plain paths. This mirrors that locally.
      "/privacy": { target: SITE_TARGET, changeOrigin: true },
      "/terms": { target: SITE_TARGET, changeOrigin: true },
    },
  },
})
