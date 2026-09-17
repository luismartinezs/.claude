import { describe, expect, test } from "vitest"
import { isAllowedOrigin } from "./http.ts"

describe("isAllowedOrigin", () => {
  const app = "https://pawacook.app"

  test("production accepts only the app origin", () => {
    expect(isAllowedOrigin(app, true, app)).toBe(true)
    expect(isAllowedOrigin("https://evil.example", true, app)).toBe(false)
    expect(isAllowedOrigin("https://pawacook.app.evil.example", true, app)).toBe(false)
    expect(isAllowedOrigin("http://localhost:4321", true, app)).toBe(false)
    expect(isAllowedOrigin("null", true, app)).toBe(false)
    expect(isAllowedOrigin(undefined, true, app)).toBe(false)
  })

  test("development also accepts localhost dev servers, nothing else", () => {
    expect(isAllowedOrigin("http://localhost:5173", false, app)).toBe(true)
    expect(isAllowedOrigin("http://127.0.0.1:4321", false, app)).toBe(true)
    expect(isAllowedOrigin("http://localhost.evil.example", false, app)).toBe(false)
    expect(isAllowedOrigin(undefined, false, app)).toBe(false)
  })
})
