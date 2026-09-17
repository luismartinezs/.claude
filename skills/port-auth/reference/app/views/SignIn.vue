<script setup lang="ts">
import { ref } from "vue"
import Icon from "./../components/Icon.vue"
import { GOOGLE_START_URL, useSession } from "../stores/session.ts"
import { useProfile } from "../stores/profile.ts"
import { useLibrary } from "../stores/library.ts"
import { isApiError } from "../lib/api.ts"

const { methods, pendingLoginToken, redirectError, requestEmailLink, finishEmailSignIn } = useSession()
const profile = useProfile()
const library = useLibrary()

const email = ref("")
const sentTo = ref<string | null>(null)
const busy = ref(false)
const failure = ref<string | null>(redirectError.value === null ? null : "Google sign-in failed. Try again.")

const messageFor = (error: unknown, fallback: string): string =>
  isApiError(error) && error.status !== 500 ? error.message : fallback

const sendLink = async (): Promise<void> => {
  if (busy.value) return
  const address = email.value.trim()
  if (address === "") {
    failure.value = "Enter your email address"
    return
  }
  failure.value = null
  busy.value = true
  try {
    await requestEmailLink(address)
    sentTo.value = address
  } catch (error) {
    failure.value = messageFor(error, "Could not send the sign-in email. Try again.")
  } finally {
    busy.value = false
  }
}

/**
 * The link opens this screen instead of signing in on load: mail scanners
 * fetch links automatically, and only a person clicks this button.
 */
const finish = async (): Promise<void> => {
  if (busy.value) return
  failure.value = null
  busy.value = true
  try {
    await finishEmailSignIn()
    // The workspace opens straight into the restored data, with no success message.
    await Promise.all([profile.load(), library.load()])
  } catch (error) {
    failure.value = messageFor(error, "Sign-in failed. Request a new link.")
  } finally {
    busy.value = false
  }
}

const useDifferentEmail = (): void => {
  sentTo.value = null
  failure.value = null
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-16 items-center border-b border-line px-4">
      <span class="t-eyebrow text-accent">Pawacook</span>
    </header>

    <main class="flex flex-1 items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <p class="t-eyebrow text-accent">Welcome to Pawacook</p>
        <h1 class="t-display mt-4">Cook what you have</h1>
        <p class="mt-4 text-ink-2">
          Your preferences, cookware and pantry stay saved, so every recipe starts from the kitchen you
          actually have.
        </p>

        <div class="panel panel-body mt-6">
          <template v-if="pendingLoginToken">
            <p class="t-label">Finish signing in</p>
            <p class="t-small mt-2 text-ink-muted">You opened a sign-in link for Pawacook.</p>
            <button type="button" class="btn btn-primary mt-4 w-full" :disabled="busy" @click="finish">
              {{ busy ? "Signing in" : "Continue to Pawacook" }}
            </button>
          </template>

          <template v-else-if="sentTo">
            <p class="t-label">Check your email</p>
            <p class="t-small mt-2 text-ink-muted">
              We sent a sign-in link to <span class="text-ink wrap-anywhere">{{ sentTo }}</span>. It works once
              and expires in 15 minutes.
            </p>
            <button type="button" class="btn btn-secondary mt-4 w-full" @click="useDifferentEmail">
              Use a different email
            </button>
          </template>

          <template v-else>
            <template v-if="methods.google">
              <a :href="GOOGLE_START_URL" class="btn btn-primary w-full">
                <Icon name="google" :size="18" />
                Continue with Google
              </a>
              <p class="t-small my-4 text-center text-ink-muted">or</p>
            </template>

            <form novalidate @submit.prevent="sendLink">
              <label class="block">
                <span class="t-eyebrow text-ink-muted">Email</span>
                <input
                  v-model="email"
                  type="email"
                  class="input mt-2"
                  placeholder="you@example.com"
                  autocomplete="email"
                />
              </label>
              <button
                type="submit"
                class="btn mt-3 w-full"
                :class="methods.google ? 'btn-secondary' : 'btn-primary'"
                :disabled="busy"
              >
                {{ busy ? "Sending" : "Email me a sign-in link" }}
              </button>
            </form>
          </template>

          <p v-if="failure" class="t-small mt-3 text-error" role="alert">{{ failure }}</p>

          <!-- Plain muted inline links: no border, background, fill or padding. -->
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
