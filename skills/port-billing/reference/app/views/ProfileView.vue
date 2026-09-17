<script setup lang="ts">
import ProfileSection from "../components/ProfileSection.vue"
import Icon from "../components/Icon.vue"
import { useProfile } from "../stores/profile.ts"
import { useSession } from "../stores/session.ts"
import { useBilling } from "../stores/billing.ts"
import { useToasts } from "../stores/toasts.ts"

const { preferences, cookware, pantry, syncFailure, retrySync, dismissSyncFailure } = useProfile()
const { account, signOut } = useSession()
const billing = useBilling()
const { push } = useToasts()

const manageSubscription = async (): Promise<void> => {
  try {
    await billing.openPortal()
  } catch {
    push("error", "Could not open subscription settings")
  }
}
</script>

<template>
  <div class="p-4">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="t-eyebrow text-accent">Household profile</p>
        <h1 class="t-display mt-2">Your kitchen</h1>
      </div>
      <div class="flex items-center gap-3">
        <span class="t-small text-ink-muted">{{ account?.email }}</span>
        <button v-if="billing.manageable.value" type="button" class="btn btn-secondary" @click="manageSubscription">
          Manage subscription
        </button>
        <button type="button" class="btn btn-secondary" @click="signOut">Sign out</button>
      </div>
    </header>

    <!-- A sync failure is visible but never discards the data already on screen. -->
    <div v-if="syncFailure" class="alert alert-warning mt-6 flex items-start gap-3">
      <Icon name="alert" :size="16" class="mt-0.5 text-warning" />
      <div class="flex-1">
        <p class="t-label text-warning">{{ syncFailure.message }}</p>
        <p class="t-small mt-1 text-warning/80">
          Your last loaded kitchen is still shown. Nothing was discarded.
        </p>
      </div>
      <button type="button" class="btn btn-secondary h-8 px-3" @click="retrySync">Retry</button>
      <button type="button" class="btn-icon btn-icon-sm border-transparent" aria-label="Dismiss" @click="dismissSyncFailure">
        <Icon name="close" :size="16" />
      </button>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      <ProfileSection
        kind="preference"
        title="Preferences"
        add-label="Add a preference"
        empty-hint="Tastes, dislikes, dietary needs and serving defaults all live here."
        :items="preferences"
      />
      <ProfileSection
        kind="cookware"
        title="Cookware"
        add-label="Add cookware"
        empty-hint="List what you can cook with, including sizes and capacities."
        :items="cookware"
      />
      <ProfileSection
        kind="pantry"
        title="Pantry"
        add-label="Add an ingredient"
        empty-hint="Recipes use only what is listed here, plus water."
        :items="pantry"
        class="lg:col-span-2"
      />
    </div>
  </div>
</template>
