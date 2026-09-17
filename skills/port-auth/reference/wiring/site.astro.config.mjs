import { defineConfig } from "astro/config"
import tailwindcss from "@tailwindcss/vite"

const APP_TARGET = process.env.APP_TARGET ?? "http://localhost:5173"
const API_TARGET = process.env.API_TARGET ?? "http://localhost:8787"

export default defineConfig({
  output: "static",
  vite: {
    plugins: [tailwindcss()],
    server: {
      // In production one reverse proxy serves the site and the SPA from one
      // origin, so the site links to /app/ as a plain path. This mirrors that
      // locally; ws carries the SPA's HMR socket through.
      proxy: {
        "/app": { target: APP_TARGET, changeOrigin: true, ws: true },
        "/api": { target: API_TARGET, changeOrigin: true },
      },
    },
  },
})
