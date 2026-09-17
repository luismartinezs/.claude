import { z } from "zod"

export const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  picture: z.string().nullable(),
})

export type Account = z.infer<typeof AccountSchema>

export const SessionSchema = z.object({
  account: AccountSchema.nullable(),
  /** Which sign-in methods the server has configured, so the screen offers only those. */
  methods: z.object({ google: z.boolean(), email: z.literal(true) }),
})

export type Session = z.infer<typeof SessionSchema>

/** Addresses compare case-insensitively everywhere, so they are normalized once, here. */
export const EmailAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))

export const EmailLinkRequestSchema = z.object({ email: EmailAddressSchema })

export const EmailLinkVerifySchema = z.object({ token: z.string().min(32).max(128) })

/** The query parameter the API adds to /app/ when a redirect-based sign-in fails. */
export const AUTH_ERROR_PARAM = "auth_error"

/** The URL fragment key that carries a magic-link token to the SPA. */
export const LOGIN_TOKEN_FRAGMENT = "login_token"
