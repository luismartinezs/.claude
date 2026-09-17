import { Hono } from "hono"
import { apiSecurityHeaders, requireSameOrigin } from "./platform/http.ts"
import { log } from "./platform/logger.ts"
import { authApi } from "./domains/auth/api.ts"
import { profileApi } from "./domains/profile/api.ts"
import { recipesApi } from "./domains/recipes/api.ts"
import { assistantApi } from "./domains/assistant/api.ts"

/**
 * The HTTP application, separate from the listener so tests can drive it
 * in-process. There is deliberately no CORS middleware: the site, the SPA and
 * the API share one origin, so no other origin is ever granted access.
 */
export const app = new Hono()

app.use("*", apiSecurityHeaders)
app.use("/api/*", requireSameOrigin)

app.get("/healthz", (c) => c.json({ ok: true }))

app.route("/api/auth", authApi)
app.route("/api/profile", profileApi)
app.route("/api/recipes", recipesApi)
app.route("/api/assistant", assistantApi)

app.onError((error, c) => {
  log.error("request.unhandled", { error: error.message, path: c.req.path })
  return c.json({ error: "unavailable", message: "Recipe service unavailable" }, 500)
})
