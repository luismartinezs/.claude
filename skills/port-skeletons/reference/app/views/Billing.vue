<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import { CREDIT_PACKS, GIFT_TRIAL, PLAN, type BillingStatus, type CreditLedgerEntry, type GiftCodeSummary } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Badge from "../components/Badge.vue"
import Credits from "../components/Credits.vue"
import Feedback from "../components/Feedback.vue"
import Modal from "../components/Modal.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"

/**
 * Billing and credits.
 *
 * Every number here is exact and stated before anything is bought: the price,
 * the renewal date, the included grant, the current balance, and each pack's
 * price and credit amount. A top-up is confirmed by the person, and credits
 * appear only after Stripe verifies the payment.
 */
const route = useRoute()
const account = useAccount()

const status = remembered<BillingStatus | null>("billing.status", null)
/** Null until the first answer, so a ledger that has not loaded is not drawn as an empty one. */
const ledger = remembered<CreditLedgerEntry[] | null>("billing.ledger", null)
const error = ref<string | null>(null)
const busy = ref(false)
const confirming = ref<(typeof CREDIT_PACKS)[number] | null>(null)
const giftCode = ref("")
const giftRedeemed = ref(false)
const issuedGiftCode = ref<string | null>(null)
const giftCodes = ref<GiftCodeSummary[] | null>(null)
const newGiftAlias = ref("")
const editingGiftId = ref<string | null>(null)
const editingAlias = ref("")

const justSubscribed = computed(() => route.query.checkout === "success")
const justToppedUp = computed(() => route.query.topup === "success")
/** Until the status answers, what it decides is drawn as a skeleton; a failed load stops the pulsing. */
const loading = computed(() => !status.value && !error.value)

const load = async (): Promise<void> => {
  try {
    const [billing, entries] = await Promise.all([
      api<BillingStatus>("/billing"),
      api<{ items: CreditLedgerEntry[] }>("/billing/ledger"),
      account.load(),
    ])
    status.value = billing
    ledger.value = entries.items
    if (billing.ownerGrant) await loadGiftCodes()
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

const loadGiftCodes = async (): Promise<void> => {
  const result = await api<{ items: GiftCodeSummary[] }>("/billing/gift/codes")
  giftCodes.value = result.items
}

onMounted(load)

const go = async (path: string, body?: unknown): Promise<void> => {
  busy.value = true
  error.value = null
  try {
    const result = await api<{ url: string }>(path, { method: "POST", body })
    window.location.assign(result.url)
  } catch (goError) {
    error.value = errorMessage(goError)
    busy.value = false
  }
}

const redeemGift = async (): Promise<void> => {
  busy.value = true
  error.value = null
  try {
    await api("/billing/gift", { method: "POST", body: { code: giftCode.value.trim() } })
    giftCode.value = ""
    giftRedeemed.value = true
    await load()
  } catch (redeemError) {
    error.value = errorMessage(redeemError)
  } finally {
    busy.value = false
  }
}

const issueGift = async (): Promise<void> => {
  busy.value = true
  error.value = null
  try {
    const result = await api<{ code: string }>("/billing/gift/issue", {
      method: "POST",
      body: { alias: newGiftAlias.value },
    })
    issuedGiftCode.value = result.code
    newGiftAlias.value = ""
    await loadGiftCodes()
  } catch (issueError) {
    error.value = errorMessage(issueError)
  } finally {
    busy.value = false
  }
}

const beginAliasEdit = (gift: GiftCodeSummary): void => {
  editingGiftId.value = gift.id
  editingAlias.value = gift.alias ?? ""
}

const saveAlias = async (id: string): Promise<void> => {
  busy.value = true
  error.value = null
  try {
    await api(`/billing/gift/codes/${id}`, { method: "PATCH", body: { alias: editingAlias.value } })
    editingGiftId.value = null
    await loadGiftCodes()
  } catch (saveError) {
    error.value = errorMessage(saveError)
  } finally {
    busy.value = false
  }
}

const accessLabel = computed(() => {
  if (status.value?.trialEndsAt) return "Gift trial"
  switch (status.value?.access) {
    case "paid":
      return "Active"
    case "recovering":
      return "Payment retrying"
    case "suspended":
      return "Suspended"
    default:
      return "Free"
  }
})

const accessTone = computed(() => {
  switch (status.value?.access) {
    case "paid":
      return "success" as const
    case "recovering":
      return "warning" as const
    case "suspended":
      return "error" as const
    default:
      return "neutral" as const
  }
})

const kindLabel: Record<CreditLedgerEntry["kind"], string> = {
  grant: "Credit grant",
  purchase: "Top-up",
  reservation: "Reserved",
  release: "Released",
  charge: "Used",
  expiry: "Expired",
  refund: "Refunded",
  adjustment: "Adjusted",
}
</script>

<template>
  <h1 class="t-screen mb-6 hidden lg:block">Billing and credits</h1>

  <Feedback v-if="justSubscribed" tone="success" title="Payment verified" icon="check" class="mb-6">
    Your plan is active and this period's <Credits :amount="PLAN.includedCredits" /> have been granted.
  </Feedback>
  <Feedback v-if="justToppedUp" tone="success" title="Top-up verified" icon="check" class="mb-6">
    The credits are on your balance, and anything that was queued waiting for them has started.
  </Feedback>
  <Feedback v-if="giftRedeemed" tone="success" title="Gift code redeemed" icon="check" class="mb-6">
    You have Pro access for {{ GIFT_TRIAL.accessDays }} days and <Credits :amount="GIFT_TRIAL.credits" />.
  </Feedback>
  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="detail-split">
    <div class="section-stack">
      <Panel title="Your plan">
        <!-- Inside the panel, under its header: they arrive with the status and
             push only the plan's own lines down, never the panels. -->
        <Feedback
          v-if="status?.access === 'recovering'"
          tone="warning"
          title="Your last renewal did not go through"
          icon="overdue"
          class="mb-4"
        >
          Stripe is still retrying, so the agent, the API and MCP keep working. No new included credits are granted until the
          payment succeeds, and every AI operation needs a balance that covers its whole reservation.
          <template #actions>
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="go('/billing/portal')">
              Update payment details
            </button>
          </template>
        </Feedback>

        <Feedback
          v-if="status?.access === 'suspended'"
          tone="error"
          title="Paid features are suspended"
          icon="overdue"
          class="mb-4"
        >
          Your data is untouched and the free manual core still works. Purchased credits stay on the account and can fund AI
          again the moment the plan is active.
          <template #actions>
            <button type="button" class="btn btn-primary" :disabled="busy" @click="go('/billing/checkout')">
              Start the plan again
            </button>
          </template>
        </Feedback>

        <div class="flex flex-wrap items-center gap-3">
          <Badge v-if="status" :tone="accessTone">{{ accessLabel }}</Badge>
          <Skeleton v-else-if="loading" class="h-5 w-14" />
          <span v-if="status?.ownerGrant" class="badge" data-testid="owner-grant">Owner</span>
          <span v-if="status?.trialEndsAt" class="t-mono text-ink-2">
            ends {{ status.trialEndsAt.slice(0, 10) }}
          </span>
          <span v-else-if="status?.renewsAt" class="t-mono text-ink-2">
            renews {{ status.renewsAt.slice(0, 10) }}
          </span>
        </div>

        <dl class="datalist mt-4">
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">Price</dt>
            <dd v-if="loading" class="t-mono"><Skeleton class="w-24" /></dd>
            <dd v-else class="t-mono">{{ status?.trialEndsAt ? "Free gift trial" : `${PLAN.priceLabel} / ${PLAN.period}` }}</dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">
              <Skeleton v-if="loading" class="w-36" />
              <template v-else>{{ status?.trialEndsAt ? "Gift credits" : "Included each period" }}</template>
            </dt>
            <dd v-if="loading"><Skeleton class="w-16" /></dd>
            <dd v-else><Credits :amount="status?.trialEndsAt ? GIFT_TRIAL.credits : PLAN.includedCredits" /></dd>
          </div>
          <div class="flex justify-between px-4 py-2">
            <dt class="t-body">What that funds</dt>
            <dd v-if="loading" class="t-mono"><Skeleton class="w-28" /></dd>
            <dd v-else class="t-mono">${{ status?.trialEndsAt ? GIFT_TRIAL.credits / PLAN.creditsPerUsdCost : PLAN.includedCostUsd }} of model cost</dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-2">
          <Skeleton v-if="loading" class="h-9 w-56" />
          <button
            v-if="status && (status.access === 'free' || status.trialEndsAt)"
            type="button"
            class="btn btn-primary"
            :disabled="busy"
            data-testid="subscribe"
            @click="go('/billing/checkout')"
          >
            <span v-if="busy" class="btn-spinner" aria-hidden="true" />
            {{ status?.trialEndsAt ? "Subscribe after the gift trial" : `Start the plan, ${PLAN.priceLabel} a month` }}
          </button>
          <button
            v-if="status?.manageable"
            type="button"
            class="btn btn-secondary"
            :disabled="busy"
            data-testid="manage-billing"
            @click="go('/billing/portal')"
          >
            Manage subscription
          </button>
        </div>
        <p v-if="status?.trialEndsAt" class="t-small mt-3">
          Gift access and unused gift credits expire on {{ status.trialEndsAt.slice(0, 10) }}. No payment method is needed
          for the gift.
        </p>
        <p v-else-if="status?.access === 'paid'" class="t-small mt-3">
          Cancelling keeps everything until the end of the period you have paid for, then returns you to the free manual
          core.
        </p>
      </Panel>

      <Panel title="Credit packs">
        <p class="t-small mb-4">
          Packs sell credits at {{ PLAN.creditsPerUsdPurchase }} per US$1. Usage is charged at
          {{ PLAN.creditsPerUsdCost }} per US$1 of measured model cost, rounded up to the next whole credit.
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="pack in CREDIT_PACKS"
            :key="pack.key"
            type="button"
            class="card p-4 text-left"
            :disabled="!status || !!status.trialEndsAt || (status.access !== 'paid' && status.access !== 'recovering')"
            :data-testid="`pack-${pack.key}`"
            @click="confirming = pack"
          >
            <span class="flex items-end justify-between gap-3">
              <span>
                <span class="t-figure block"><Credits :amount="pack.credits" figure /></span>
                <span class="t-mono mt-2 block">{{ pack.priceLabel }}</span>
              </span>
              <span class="btn btn-secondary btn-compact">Top up</span>
            </span>
          </button>
        </div>
        <p
          v-if="status && (status.trialEndsAt || (status.access !== 'paid' && status.access !== 'recovering'))"
          class="t-small mt-3 text-ink-muted"
        >
          Packs need a monthly subscription. Gift access includes its own credits.
        </p>
      </Panel>

      <Panel title="Credit activity" flush>
        <table class="table">
          <thead>
            <tr>
              <th>What</th>
              <th class="col-wide">Detail</th>
              <th class="num">Change</th>
              <th class="num">Balance</th>
              <th class="num col-wide">When</th>
            </tr>
          </thead>
          <tbody v-if="!ledger && !error" aria-busy="true">
            <tr v-for="width in ['w-24', 'w-40', 'w-32']" :key="width">
              <td><Skeleton class="w-16" /></td>
              <td class="t-small col-wide"><Skeleton :class="width" /></td>
              <td class="num"><Skeleton class="w-10" /></td>
              <td class="num"><Skeleton class="w-12" /></td>
              <td class="num t-mono-sm col-wide"><Skeleton class="w-24" /></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="entry in ledger" :key="entry.id">
              <td>{{ kindLabel[entry.kind] }}</td>
              <td class="t-small col-wide">{{ entry.description }}</td>
              <td class="num">{{ entry.amount > 0 ? "+" : "" }}{{ entry.amount.toLocaleString("en-US") }}</td>
              <td class="num">{{ entry.balanceAfter.toLocaleString("en-US") }}</td>
              <td class="num t-mono-sm col-wide">{{ entry.createdAt.slice(0, 16).replace("T", " ") }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="ledger?.length === 0" class="empty">Nothing spent or granted yet.</p>
      </Panel>
    </div>

    <div class="section-stack">
      <Panel title="Balance">
        <p v-if="loading"><span class="credits-figure"><Skeleton class="h-7 w-24" /></span></p>
        <p v-else><Credits :amount="status?.credits.available ?? 0" figure /></p>
        <p class="t-label">available</p>
        <dl class="datalist mt-4">
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">Included</dt>
            <dd v-if="loading"><Skeleton class="w-12" /></dd>
            <dd v-else><Credits :amount="status?.credits.included ?? 0" /></dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">Purchased</dt>
            <dd v-if="loading"><Skeleton class="w-12" /></dd>
            <dd v-else><Credits :amount="status?.credits.purchased ?? 0" /></dd>
          </div>
          <div class="flex justify-between px-4 py-2">
            <dt class="t-body">Held by running work</dt>
            <dd v-if="loading"><Skeleton class="w-12" /></dd>
            <dd v-else><Credits :amount="status?.credits.reserved ?? 0" /></dd>
          </div>
        </dl>
        <p class="t-small mt-4">
          Included credits are spent first and expire with
          <Skeleton v-if="loading" class="w-24" />
          <template v-else>{{ status?.trialEndsAt ? "gift access" : "the billing period" }}</template>.
          Purchased credits do not expire while your account is open.
        </p>
      </Panel>

      <!-- Below the balance, not between the plan and the packs: whether they
           exist depends on the status, and up there they pushed the packs and
           the ledger down when it arrived. -->
      <Panel v-if="status && (status.access === 'free' || status.access === 'suspended')" title="Redeem a gift code">
        <p class="t-small mb-4">A gift code grants {{ GIFT_TRIAL.accessDays }} days of Pro access and <Credits :amount="GIFT_TRIAL.credits" />. Each code works once.</p>
        <form class="flex flex-wrap gap-2" @submit.prevent="redeemGift">
          <input v-model="giftCode" class="input min-w-48 flex-1" aria-label="Gift code" autocomplete="off" required />
          <button type="submit" class="btn btn-secondary" :disabled="busy || !giftCode.trim()">Redeem code</button>
        </form>
      </Panel>

      <Panel v-if="status?.ownerGrant" title="Create a gift code">
        <p class="t-small mb-4">Choose a code to share. Each code grants its first redeemer {{ GIFT_TRIAL.accessDays }} days of Pro and <Credits :amount="GIFT_TRIAL.credits" />. Codes use 4 to 40 letters, numbers, or hyphens.</p>
        <form class="flex flex-wrap gap-2" @submit.prevent="issueGift">
          <input v-model="newGiftAlias" class="input min-w-48 flex-1" aria-label="New gift code" autocomplete="off" placeholder="FRIENDXYZ" minlength="4" maxlength="40" pattern="[A-Za-z0-9-]+" required />
          <button type="submit" class="btn btn-secondary" :disabled="busy || !newGiftAlias.trim()">Create code</button>
        </form>
        <p v-if="issuedGiftCode" class="t-small mt-3" data-testid="issued-gift-code">Created <strong>{{ issuedGiftCode }}</strong>. Share this code with your friend.</p>

        <h2 class="t-label mt-6 mb-3">Existing codes</h2>
        <div v-if="!giftCodes && !error" aria-busy="true">
          <div v-for="width in ['w-32', 'w-24']" :key="width" class="border-t border-line py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="t-mono"><Skeleton :class="width" /></span>
              <Skeleton class="h-7 w-24" />
            </div>
            <p class="t-small mt-2"><Skeleton class="w-40" /></p>
          </div>
        </div>
        <p v-else-if="giftCodes?.length === 0" class="t-small">No gift codes have been created yet.</p>
        <div v-for="gift in giftCodes ?? []" :key="gift.id" class="border-t border-line py-3">
          <form v-if="editingGiftId === gift.id" class="flex flex-wrap gap-2" @submit.prevent="saveAlias(gift.id)">
            <input v-model="editingAlias" class="input min-w-48 flex-1" :aria-label="`Code for gift created ${gift.createdAt.slice(0, 10)}`" minlength="4" maxlength="40" pattern="[A-Za-z0-9-]+" required />
            <button type="submit" class="btn btn-secondary" :disabled="busy || !editingAlias.trim()">Save</button>
            <button type="button" class="btn btn-secondary" @click="editingGiftId = null">Cancel</button>
          </form>
          <div v-else class="flex flex-wrap items-center justify-between gap-2">
            <span class="t-mono break-all">{{ gift.alias ?? "No shareable code yet" }}</span>
            <button type="button" class="btn btn-secondary btn-compact" :disabled="busy" @click="beginAliasEdit(gift)">{{ gift.alias ? "Change code" : "Set code" }}</button>
          </div>
          <p class="t-small mt-2">
            {{ gift.redeemedAt ? "Redeemed" : "Unused" }} · Created {{ gift.createdAt.slice(0, 10) }}
            <template v-if="gift.redeemedEmail"> · {{ gift.redeemedEmail }}</template>
            <template v-if="gift.expiresAt"> · Pro ends {{ gift.expiresAt.slice(0, 10) }}</template>
          </p>
        </div>
      </Panel>
    </div>
  </div>

  <Modal v-if="confirming" title="Confirm this top-up" @close="confirming = null">
    <p class="t-body">
      <Credits :amount="confirming.credits" /> for {{ confirming.priceLabel }}, as a one-time payment. The credits
      appear once Stripe verifies it, and anything queued waiting for credits starts on its own.
    </p>
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="confirming = null">Cancel</button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        data-testid="confirm-topup"
        @click="go('/billing/credits', { pack: confirming!.key })"
      >
        Pay {{ confirming.priceLabel }}
      </button>
    </template>
  </Modal>
</template>
