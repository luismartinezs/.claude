<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { ActivityEntry, CompletionEntry, Operation } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Badge from "../components/Badge.vue"
import Credits from "../components/Credits.vue"
import Feedback from "../components/Feedback.vue"
import EmptyState from "../components/EmptyState.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage } from "../stores/work.ts"

/**
 * Activity and operations: everything the agents did, everything they are
 * waiting on, and everything that failed.
 *
 * A failure states what failed and offers retry where retrying is safe. A job
 * waiting for credits names the exact top-up that would release it, and a job
 * waiting for the plan says so, because neither is a failure the person can
 * fix by trying again.
 */
/** Null until the first answer, so work that has not loaded is not drawn as none. */
const operations = remembered<Operation[] | null>("activity.operations", null)
const activity = remembered<ActivityEntry[] | null>("activity.entries", null)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

const blocked = computed(() => (operations.value ?? []).filter((operation) => operation.blockedReason !== null))
const failed = computed(() => (operations.value ?? []).filter((operation) => operation.status === "failed"))

const load = async (): Promise<void> => {
  try {
    const [ops, entries] = await Promise.all([
      api<{ items: Operation[] }>("/agent/operations"),
      api<{ items: ActivityEntry[] }>("/agent/activity"),
    ])
    operations.value = ops.items
    activity.value = entries.items
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

const act = async (operation: Operation, action: "retry" | "cancel"): Promise<void> => {
  busy.value = operation.id
  try {
    await api(`/agent/operations/${operation.id}/${action}`, { method: "POST" })
    await load()
  } catch (actError) {
    error.value = errorMessage(actError)
  } finally {
    busy.value = null
  }
}

const tone = (operation: Operation): "proposed" | "running" | "success" | "error" | "neutral" => {
  if (operation.status === "pending") return "proposed"
  if (operation.status === "running") return "running"
  if (operation.status === "succeeded") return "success"
  if (operation.status === "failed") return "error"
  return "neutral"
}

const KIND_LABELS: Record<string, string> = {
  capture_transcribe: "Listening to a voice note",
  capture_parse: "Reading a capture",
  capture_triage: "Filing a capture",
  clarification_resume: "Resuming triage with your answer",
  goal_plan: "Researching and planning the steps of a goal",
  plan_recalculate: "Recalculating the plan",
  agent_chat: "A conversation turn",
  export_archive: "Building an export",
}

const statusLabel = (operation: Operation): string => {
  if (operation.blockedReason === "credits") return "Waiting for credits"
  if (operation.blockedReason === "access") return "Waiting for the plan"
  if (operation.status === "pending" && operation.attempts > 0) return `Retrying, attempt ${operation.attempts + 1}`
  return operation.status
}
</script>

<template>
  <h1 class="t-screen mb-6 hidden lg:block">Activity and operations</h1>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="section-stack">
    <Panel title="Operations" flush>
      <!-- Inside the panel, under its header: it arrives with the operations and
           pushes only them down, never the panel itself. -->
      <Feedback v-if="blocked.length > 0" tone="warning" title="Work is waiting" icon="credits" class="m-4">
        {{ blocked.length }} job{{ blocked.length === 1 ? " is" : "s are" }} held up. Nothing is lost: each one keeps its
        input and starts on its own once the reason clears.
      </Feedback>

      <table v-if="operations && operations.length > 0" class="table">
        <thead>
          <tr>
            <th>What</th>
            <th class="col-wide">About</th>
            <th>Status</th>
            <th class="num col-wide">Cost</th>
            <th class="num col-wide">When</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="operation in operations.slice(0, 60)" :key="operation.id">
            <td class="t-strong">{{ KIND_LABELS[operation.kind] ?? operation.kind }}</td>
            <td class="t-small col-wide">{{ operation.subjectTitle ?? operation.subjectType }}</td>
            <td>
              <Badge :tone="tone(operation)" :dot="operation.status === 'running'">{{ statusLabel(operation) }}</Badge>
              <Badge v-if="operation.partial" tone="warning">Partial</Badge>
              <p v-if="operation.error" class="t-small mt-1 text-error">{{ operation.error }}</p>
              <p v-if="operation.shortfall" class="t-small mt-1">
                Needs <Credits :amount="operation.shortfall" /> more.
              </p>
              <p v-if="operation.requestedBy !== 'user'" class="t-caption mt-1">
                Asked for by {{ operation.requestedByLabel ?? operation.requestedBy }}
              </p>
            </td>
            <td class="num col-wide">
              <Credits v-if="operation.chargedCredits !== null" :amount="operation.chargedCredits" />
              <span v-else class="t-mono-sm">up to {{ operation.maxReservation }}</span>
            </td>
            <td class="num t-mono-sm col-wide">{{ operation.createdAt.slice(0, 16).replace("T", " ") }}</td>
            <td class="num">
              <button
                v-if="operation.status === 'failed' && operation.kind !== 'agent_chat'"
                type="button"
                class="btn btn-secondary btn-compact"
                :disabled="busy === operation.id"
                data-testid="retry-operation"
                @click="act(operation, 'retry')"
              >
                Retry
              </button>
              <button
                v-else-if="operation.status === 'pending'"
                type="button"
                class="btn btn-tertiary btn-compact"
                :disabled="busy === operation.id"
                @click="act(operation, 'cancel')"
              >
                Cancel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Rows without a header: the columns size to what arrives, and a header
           drawn over skeletons would slide sideways when they do. -->
      <table v-else-if="!operations && !error" class="table" aria-busy="true">
        <tbody>
          <tr v-for="width in ['w-40', 'w-28', 'w-36']" :key="width">
            <td><Skeleton :class="width" /></td>
            <td class="col-wide"><Skeleton class="w-32" /></td>
            <td><Skeleton class="h-5 w-20" /></td>
            <td class="num col-wide"><Skeleton class="w-12" /></td>
            <td class="num col-wide"><Skeleton class="w-28" /></td>
            <td class="num"><Skeleton class="h-7 w-16" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="Nothing has run yet. Capture something and the agents get to work." />
    </Panel>

    <Panel title="Agent activity" flush>
      <table v-if="activity && activity.length > 0" class="table">
        <thead>
          <tr>
            <th>Who</th>
            <th>What</th>
            <th>Result</th>
            <th class="num col-wide">When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in activity.slice(0, 60)" :key="entry.id">
            <td class="cell-token">
              {{ entry.channel === "interface" ? "You" : entry.channel === "agent" ? "Agent" : entry.channel.toUpperCase() }}
              <span v-if="entry.channelLabel" class="t-caption">: {{ entry.channelLabel }}</span>
            </td>
            <td class="t-small">{{ entry.operation }}</td>
            <td>
              <Badge :tone="entry.result === 'complete' ? 'success' : entry.result === 'partial' ? 'warning' : 'error'">
                {{ entry.result }}
              </Badge>
            </td>
            <td class="num t-mono-sm col-wide">{{ entry.at.slice(0, 16).replace("T", " ") }}</td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="!activity && !error" class="table" aria-busy="true">
        <tbody>
          <tr v-for="width in ['w-40', 'w-28', 'w-36']" :key="width">
            <td><Skeleton class="w-16" /></td>
            <td><Skeleton :class="width" /></td>
            <td><Skeleton class="h-5 w-16" /></td>
            <td class="num col-wide"><Skeleton class="w-28" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="No agent changes recorded yet." />
    </Panel>
  </div>
</template>
