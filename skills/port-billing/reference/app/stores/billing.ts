import { ref } from "vue"
import type { BillingStatus, Redirect } from "@pawacook/contracts"
import { api } from "../lib/api.ts"

const active = ref(false)
const manageable = ref(false)
const loaded = ref(false)

export const useBilling = () => {
  const load = async (): Promise<void> => {
    const data = await api<BillingStatus>("/billing")
    active.value = data.active
    manageable.value = data.manageable
    loaded.value = true
  }

  /** Forgets the previous account's status so the next sign-in starts from a fresh read. */
  const reset = (): void => {
    active.value = false
    manageable.value = false
    loaded.value = false
  }

  /** Stripe hosts checkout and the billing portal; both are a full-page redirect. */
  const startCheckout = async (): Promise<void> => {
    const { url } = await api<Redirect>("/billing/checkout", { method: "POST" })
    window.location.assign(url)
  }

  const openPortal = async (): Promise<void> => {
    const { url } = await api<Redirect>("/billing/portal", { method: "POST" })
    window.location.assign(url)
  }

  return { active, manageable, loaded, load, reset, startCheckout, openPortal }
}
