import { ref } from "vue"
import { AUTH_ERROR_PARAM, LOGIN_TOKEN_FRAGMENT, type Account, type Session } from "@pawacook/contracts"
import { api } from "../lib/api.ts"

/**
 * Reads the one-time values a sign-in redirect leaves in the URL and removes
 * them straight away, so a magic-link token never lingers in the address bar,
 * the history entry, or a bookmark.
 */
const takeUrlSignInState = (): { loginToken: string | null; authError: string | null } => {
  const url = new URL(window.location.href)
  const loginToken = new URLSearchParams(url.hash.slice(1)).get(LOGIN_TOKEN_FRAGMENT)
  const authError = url.searchParams.get(AUTH_ERROR_PARAM)
  if (loginToken !== null || authError !== null) {
    url.hash = ""
    url.searchParams.delete(AUTH_ERROR_PARAM)
    window.history.replaceState(window.history.state, "", url.pathname + url.search)
  }
  return { loginToken, authError }
}

const initial = takeUrlSignInState()

const account = ref<Account | null>(null)
const methods = ref<Session["methods"]>({ google: false, email: true })
const loaded = ref(false)
const pendingLoginToken = ref<string | null>(initial.loginToken)
const redirectError = ref<string | null>(initial.authError)

export const GOOGLE_START_URL = "/api/auth/google/start"

export const useSession = () => {
  const load = async (): Promise<void> => {
    const data = await api<Session>("/auth/session")
    account.value = data.account
    methods.value = data.methods
    loaded.value = true
  }

  const requestEmailLink = async (email: string): Promise<void> => {
    await api("/auth/email/request", { method: "POST", body: { email } })
  }

  /** Spends the pending magic-link token, whatever the outcome: a token is only ever tried once. */
  const finishEmailSignIn = async (): Promise<void> => {
    const token = pendingLoginToken.value
    pendingLoginToken.value = null
    if (token === null) return
    const data = await api<{ account: Account }>("/auth/email/verify", { method: "POST", body: { token } })
    account.value = data.account
  }

  const signOut = async (): Promise<void> => {
    await api("/auth/signout", { method: "POST" })
    account.value = null
  }

  return {
    account,
    methods,
    loaded,
    pendingLoginToken,
    redirectError,
    load,
    requestEmailLink,
    finishEmailSignIn,
    signOut,
  }
}
