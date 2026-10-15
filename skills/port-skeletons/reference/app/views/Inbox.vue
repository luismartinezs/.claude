<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import type { Capture, GoalStatus } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Badge from "../components/Badge.vue"
import EmptyState from "../components/EmptyState.vue"
import Feedback from "../components/Feedback.vue"
import Icon from "../components/Icon.vue"
import Credits from "../components/Credits.vue"
import QuickAdd from "../components/QuickAdd.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { onOutboxChanged, pendingCaptureCount, syncCaptures } from "../lib/captureOutbox.ts"
import { whereItWent } from "../lib/receipt.ts"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { useSession } from "../stores/session.ts"

/**
 * Inbox: the durable captures and what the agents are doing with them.
 *
 * Every capture here is already saved. The operation badges say whether
 * parsing and triage are queued, running, blocked on credits, or failed, so
 * nothing is ever silently stuck, and manual conversion is always available on
 * every plan, because losing a thought to a paywall would be unforgivable.
 */
const router = useRouter()
const work = useWork()
const account = useAccount()
const session = useSession()

const error = ref<string | null>(null)
const quickAddOpen = ref(false)
const pendingOnDevice = ref(0)
const loadPending = async (): Promise<void> => {
  pendingOnDevice.value = await pendingCaptureCount(session.account.value?.id ?? null).catch(() => 0)
}
const stopOutboxNotice = onOutboxChanged(() => { void loadPending() })
const converting = ref<string | null>(null)

const captures = computed(() => work.captures.value)
const filedCaptures = computed(() => work.filedCaptures.value)
/** Goals whose steps Pawalist is working out, or that wait for the person. */
const goals = ref<GoalStatus[]>([])

const loadGoals = async (): Promise<void> => {
  goals.value = (await api<{ items: GoalStatus[] }>("/captures/goals")).items
}

const load = async (): Promise<void> => {
  try {
    await Promise.all([work.loadInbox(), loadGoals(), account.load()])
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

const GOAL_LABELS: Record<GoalStatus["status"], { text: string; tone: "running" | "warning" | "proposed" | "error" }> = {
  researching: { text: "Researching the steps", tone: "running" },
  asking: { text: "Needs your answer", tone: "warning" },
  ready: { text: "Steps to review", tone: "proposed" },
  failed: { text: "Research failed", tone: "error" },
}

/**
 * While any capture has work in flight, the list refreshes itself, so a voice
 * note moves from "Listening" to "Reading" to its tasks without the person
 * pressing Refresh. Each refresh starts any due queued work. The next check
 * waits for the last to answer, and nothing is checked for work that cannot
 * move until the person acts: a job blocked on credits or the plan.
 */
const FOLLOW_MS = 3_000
let follower: number | undefined

const inFlight = (): boolean =>
  goals.value.some((goal) => goal.status === "researching") ||
  captures.value.some((capture) =>
    capture.operations.some(
      (operation) => operation.status === "running" || (operation.status === "pending" && !operation.blockedReason),
    ),
  )

const follow = (): void => {
  window.clearTimeout(follower)
  if (!inFlight()) return
  follower = window.setTimeout(async () => {
    try {
      await Promise.all([work.loadInbox(), loadGoals()])
    } catch {
      // A missed refresh is retried by the next one; the list on screen is still true.
      follow()
    }
  }, FOLLOW_MS)
}

// Every new list (a refresh, a save from Quick Add, a conversion) decides
// whether there is still something to follow.
watch([captures, goals], follow)
onMounted(() => { void load(); void loadPending() })
onUnmounted(() => { window.clearTimeout(follower); stopOutboxNotice() })

const convert = async (capture: Capture): Promise<void> => {
  converting.value = capture.id
  try {
    const result = await api<{ taskId: string; created: boolean }>(`/captures/${capture.id}/convert`, { method: "POST" })
    // A capture already converted opens its task instead of making a second one.
    await router.push(`/tasks/${result.taskId}`)
  } catch (convertError) {
    error.value = errorMessage(convertError)
  } finally {
    converting.value = null
  }
}

const operationTone = (status: string): "proposed" | "running" | "success" | "error" | "neutral" => {
  if (status === "pending") return "proposed"
  if (status === "running") return "running"
  if (status === "succeeded") return "success"
  if (status === "failed") return "error"
  return "neutral"
}

const operationLabel = (operation: Capture["operations"][number]): string => {
  const name =
    operation.kind === "capture_transcribe" ? "Listening" : operation.kind === "capture_parse" ? "Reading" : "Filing"
  if (operation.blockedReason === "credits") return `${name}: waiting for credits`
  if (operation.blockedReason === "access") return `${name}: waiting for the plan`
  if (operation.status === "pending") return `${name}: queued`
  if (operation.status === "running") return `${name}`
  if (operation.status === "succeeded") return `${name}: done`
  if (operation.status === "failed") return `${name}: failed`
  return `${name}: cancelled`
}

const shortfall = computed(() =>
  captures.value
    .flatMap((capture) => capture.operations)
    .find((operation) => operation.blockedReason === "credits" && operation.shortfall !== null),
)
</script>

<template>
  <Feedback v-if="pendingOnDevice > 0" tone="info" title="Saved on this device" icon="inbox" class="mb-6">
    {{ pendingOnDevice }} capture{{ pendingOnDevice === 1 ? "" : "s" }} waiting to sync to Inbox.
    <template #actions>
      <button v-if="session.account.value" type="button" class="btn btn-secondary" @click="syncCaptures(session.account.value.id)">Retry sync</button>
    </template>
  </Feedback>
  <div class="mb-6 hidden items-center justify-between lg:flex">
    <h1 class="t-screen">Inbox</h1>
    <div class="flex gap-2">
      <button type="button" class="btn btn-secondary" @click="router.push('/clarifications')">Clarifications</button>
      <button type="button" class="btn btn-secondary" @click="quickAddOpen = true">Quick Add</button>
    </div>
  </div>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>


  <Panel title="Captures" flush>
    <template #actions>
      <span v-if="work.loaded.value.inbox" class="t-caption">{{ captures.length }} waiting</span>
      <span v-else class="t-caption"><Skeleton class="h-2.5 w-16" /></span>
    </template>

    <!-- Inside the panel, under its header: both arrive with the answer, and
         here they push only the captures down, never the panel itself. -->
    <Feedback
      v-if="account.summary.value && !account.aiAvailable.value"
      tone="info"
      title="Captures are saved. Sorting them needs the plan."
      icon="inbox"
      class="m-4"
    >
      Quick Add works on every plan and nothing here is lost. Reading and filing a capture uses AI, which the monthly plan
      unlocks. You can convert any capture into a task by hand right now.
      <template #actions>
        <button type="button" class="btn btn-primary" @click="router.push('/billing')">See the plan</button>
      </template>
    </Feedback>
    <Feedback
      v-if="shortfall"
      tone="warning"
      title="Work is waiting for credits"
      icon="credits"
      class="m-4"
    >
      A queued job needs <Credits :amount="shortfall.shortfall ?? 0" /> more than you have. Top up and it starts on its
      own, in the order it was queued.
      <template #actions>
        <button type="button" class="btn btn-primary" @click="router.push('/billing')">Top up credits</button>
      </template>
    </Feedback>

    <div v-if="captures.length > 0" class="list" data-testid="inbox-list">
      <div v-for="capture in captures" :key="capture.id" data-stage="inbox" class="row flex-col !items-stretch">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="row-title whitespace-normal">
              {{ capture.summary ?? (capture.text || capture.transcript || "Voice note").slice(0, 160) }}
            </p>
            <p v-if="capture.summary && capture.text" class="t-small mt-1 line-clamp-2">{{ capture.text }}</p>
            <p v-if="capture.transcript" class="t-small mt-1 line-clamp-3" data-testid="capture-transcript">
              <Icon name="mic" :size="12" /> {{ capture.transcript }}
            </p>
          </div>
          <!-- Capped, so a capture that was retried many times wraps its badges
               instead of laying them out in one line wider than the screen. -->
          <div class="flex max-w-[50%] shrink-0 flex-wrap items-center justify-end gap-2">
            <span v-if="capture.attachments.length > 0" class="chip">
              <Icon name="attachment" :size="12" /> {{ capture.attachments.length }}
            </span>
            <Badge
              v-for="operation in capture.operations"
              :key="operation.id"
              :tone="operationTone(operation.status)"
              :dot="operation.status === 'running'"
            >
              {{ operationLabel(operation) }}
            </Badge>
          </div>
        </div>

        <div v-if="capture.attachments.length > 0" class="mt-3 flex flex-wrap gap-2">
          <img
            v-for="attachment in capture.attachments.filter((entry) => entry.kind === 'image')"
            :key="attachment.id"
            :src="attachment.url"
            :alt="attachment.filename"
            class="thumb"
          />
          <audio
            v-for="attachment in capture.attachments.filter((entry) => entry.kind === 'audio')"
            :key="attachment.id"
            :src="attachment.url"
            controls
            class="h-9"
          />
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            v-if="capture.convertedTaskId"
            type="button"
            class="btn btn-secondary btn-compact"
            @click="router.push(`/tasks/${capture.convertedTaskId}`)"
          >
            Open the task it became
          </button>
          <button
            v-else
            type="button"
            class="btn btn-secondary btn-compact"
            :disabled="converting === capture.id"
            data-testid="convert-capture"
            @click="convert(capture)"
          >
            <span v-if="converting === capture.id" class="btn-spinner" aria-hidden="true" />
            Turn into one task
          </button>
          <button
            v-for="taskId in capture.taskIds.filter((id) => id !== capture.convertedTaskId).slice(0, 4)"
            :key="taskId"
            type="button"
            class="btn btn-tertiary btn-compact"
            @click="router.push(`/tasks/${taskId}`)"
          >
            Open task
          </button>
          <span v-if="capture.taskIds.length > 0" class="t-caption">
            {{ capture.taskIds.length }} task{{ capture.taskIds.length === 1 ? "" : "s" }} from this capture
          </span>
          <button type="button" class="btn btn-tertiary btn-compact ml-auto" @click="load">Refresh</button>
        </div>
      </div>
    </div>

    <div v-else-if="!work.loaded.value.inbox && !error" class="list" aria-busy="true">
      <div v-for="width in ['w-3/5', 'w-2/5', 'w-1/2']" :key="width" class="row flex-col !items-stretch">
        <p class="row-title"><Skeleton :class="width" /></p>
        <div class="mt-3 flex gap-2">
          <Skeleton class="h-7 w-32" />
          <Skeleton class="ml-auto h-7 w-20" />
        </div>
      </div>
    </div>

    <EmptyState v-else message="Nothing in the inbox. Whatever you capture lands here first.">
      <button type="button" class="btn btn-secondary" @click="quickAddOpen = true">Capture something</button>
    </EmptyState>
  </Panel>

  <!-- Below the captures, not above: it exists only once the answer says so,
       and above the list it pushed the whole inbox down when it arrived. -->
  <Panel v-if="goals.length > 0" title="Goals" flush class="mt-6">
    <div class="list" data-testid="goal-list">
      <div v-for="goal in goals" :key="goal.taskId" class="row">
        <div class="min-w-0 flex-1">
          <p class="row-title whitespace-normal">{{ goal.title }}</p>
          <p v-if="goal.status === 'researching'" class="t-caption mt-1">
            Pawalist is looking up how this is done where you live. It takes a minute or two.
          </p>
          <p v-else-if="goal.status === 'ready'" class="t-caption mt-1">
            {{ goal.proposedSteps }} proposed step{{ goal.proposedSteps === 1 ? "" : "s" }}. Nothing is scheduled until you
            accept them.
          </p>
          <p v-else-if="goal.error" class="t-caption mt-1">{{ goal.error }}</p>
        </div>
        <Badge :tone="GOAL_LABELS[goal.status].tone" :dot="goal.status === 'researching'">
          {{ GOAL_LABELS[goal.status].text }}
        </Badge>
        <button
          v-if="goal.status === 'asking'"
          type="button"
          class="btn btn-secondary btn-compact"
          @click="router.push('/clarifications')"
        >
          Answer
        </button>
        <button
          v-else-if="goal.status !== 'researching'"
          type="button"
          class="btn btn-secondary btn-compact"
          @click="router.push(`/tasks/${goal.taskId}`)"
        >
          {{ goal.status === "ready" ? "Review" : "Open" }}
        </button>
      </div>
    </div>
  </Panel>

  <QuickAdd v-if="quickAddOpen" @close="quickAddOpen = false" @queued="loadPending" />

  <Panel v-if="filedCaptures.length > 0" title="Recently filed" flush data-testid="filed-list">
    <template #actions>
      <span class="t-caption">last 7 days</span>
    </template>
    <div class="list">
      <div v-for="capture in filedCaptures" :key="capture.id" data-stage="triaged" class="row flex-col !items-stretch">
        <p class="t-small line-clamp-1">{{ (capture.text || capture.transcript || "Voice note").slice(0, 160) }}</p>
        <button
          v-for="task in capture.filed"
          :key="task.id"
          type="button"
          class="row-main text-left"
          @click="router.push(`/tasks/${task.id}`)"
        >
          <span class="row-title whitespace-normal">{{ task.title }}</span>
          <span class="t-caption">{{ whereItWent(task) }}</span>
        </button>
        <p v-if="capture.filed.length === 0" class="t-caption">Nothing was filed from this.</p>
      </div>
    </div>
  </Panel>
</template>
