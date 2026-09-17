<script setup lang="ts">
import { onMounted, ref } from "vue"
import { PLAN } from "@pawacook/contracts"
import { useBilling } from "../stores/billing.ts"
import { useSession } from "../stores/session.ts"
import { isApiError } from "../lib/api.ts"

const CONFIRM_POLL_MS = 2_000
const CONFIRM_ATTEMPTS = 30

const billing = useBilling()
const { account, signOut } = useSession()

const busy = ref(false)
const confirming = ref(false)
const failure = ref<string | null>(null)

const subscribe = async (): Promise<void> => {
  if (busy.value) return
  busy.value = true
  failure.value = null
  try {
    await billing.startCheckout()
  } catch (error) {
    // The subscription became active since this screen loaded (another tab, or a late webhook).
    if (isApiError(error) && error.status === 409) {
      await billing.load().catch(() => undefined)
      if (billing.active.value) return
    }
    failure.value = "Could not open checkout. Try again."
    busy.value = false
  }
}

/**
 * Stripe redirects back before its webhook has necessarily reached the API, so
 * a completed payment waits here for the subscription to turn active.
 */
const confirmCheckout = async (): Promise<void> => {
  confirming.value = true
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS && !billing.active.value; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_MS))
    await billing.load().catch(() => undefined)
  }
  if (!billing.active.value) {
    confirming.value = false
    failure.value = "Your payment is still being confirmed. Refresh this page in a minute."
  }
}

onMounted(() => {
  const url = new URL(window.location.href)
  if (url.searchParams.get("checkout") !== "success") return
  url.searchParams.delete("checkout")
  window.history.replaceState(window.history.state, "", url.pathname + url.search)
  void confirmCheckout()
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-16 items-center justify-between border-b border-line px-4">
      <span class="t-eyebrow text-accent">Pawacook</span>
      <button type="button" class="btn btn-secondary h-8 px-3" @click="signOut">Sign out</button>
    </header>

    <main class="flex flex-1 items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <p class="t-eyebrow text-accent">Subscribe</p>
        <h1 class="t-display mt-4">Cook what you have</h1>
        <p class="mt-4 text-ink-2">
          Recipes written from your own pantry, cookware and preferences, saved and ready to reopen.
        </p>

        <div class="panel panel-body mt-6">
          <p class="t-label">
            {{ PLAN.priceLabel }} <span class="text-ink-muted">per {{ PLAN.period }}</span>
          </p>
          <p class="t-small mt-2 text-ink-muted">
            About 100 recipes a month. Cancel any time.
            <template v-if="account"> Signed in as <span class="text-ink wrap-anywhere">{{ account.email }}</span>.</template>
          </p>

          <button
            type="button"
            class="btn btn-primary mt-4 w-full"
            :disabled="busy || confirming"
            @click="subscribe"
          >
            {{ confirming ? "Confirming payment" : busy ? "Opening checkout" : "Subscribe" }}
          </button>

          <p v-if="failure" class="t-small mt-3 text-error" role="alert">{{ failure }}</p>

          <p class="t-small mt-4 text-ink-muted">
            <a href="/privacy" class="text-ink-muted underline">Privacy Policy</a>
            <span aria-hidden="true"> · </span>
            <a href="/terms" class="text-ink-muted underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
