<script setup lang="ts">
import { onMounted, watch } from "vue"
import AppNav from "./components/AppNav.vue"
import ToastHost from "./components/ToastHost.vue"
import SignIn from "./views/SignIn.vue"
import Subscribe from "./views/Subscribe.vue"
import { useSession } from "./stores/session.ts"
import { useBilling } from "./stores/billing.ts"
import { useProfile } from "./stores/profile.ts"
import { useLibrary } from "./stores/library.ts"

const { account, loaded, load } = useSession()
const billing = useBilling()
const profile = useProfile()
const library = useLibrary()

onMounted(load)

// Every sign-in, however it happened, reads the new account's subscription.
watch(
  () => account.value?.id,
  async (id) => {
    billing.reset()
    if (id) await billing.load()
  },
)

// An active subscription restores the household profile and library without an interstitial.
watch(billing.active, async (active) => {
  if (active) await Promise.all([profile.load(), library.load()])
})
</script>

<template>
  <div v-if="!loaded" class="flex min-h-dvh items-center justify-center">
    <span class="t-eyebrow text-ink-muted">Loading</span>
  </div>

  <SignIn v-else-if="!account" />

  <div v-else-if="!billing.loaded.value" class="flex min-h-dvh items-center justify-center">
    <span class="t-eyebrow text-ink-muted">Loading</span>
  </div>

  <Subscribe v-else-if="!billing.active.value" />

  <div v-else class="flex min-h-dvh">
    <AppNav />
    <main class="min-w-0 flex-1 pb-20 md:pb-0">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
