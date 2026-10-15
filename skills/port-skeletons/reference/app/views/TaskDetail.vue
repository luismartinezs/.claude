<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { TASK_STATE_LABELS, VALUE_CLASS_LABELS, type OutcomeFeedback, type Task } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Badge from "../components/Badge.vue"
import Feedback from "../components/Feedback.vue"
import Icon from "../components/Icon.vue"
import LinkedText from "../components/LinkedText.vue"
import Modal from "../components/Modal.vue"
import Priority from "../components/Priority.vue"
import TaskForm from "../components/TaskForm.vue"
import Skeleton from "../components/Skeleton.vue"
import SkeletonRows from "../components/SkeletonRows.vue"
import { api, isApiError } from "../lib/api.ts"
import { recalculatePlan } from "../lib/recalculatePlan.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { useToast } from "../stores/toast.ts"
import { formatDuration, formatTime, relativeDay, todayIn } from "../lib/format.ts"

/**
 * One task: its details, its context, its subtasks, its prerequisites, its
 * history, and its completion control.
 *
 * The stale-update case is handled here rather than pushed at the person: a
 * rejected write shows the current record beside what they tried, marks the
 * fields that differ, and lets them retry, because losing typed text to a
 * reload is worse than any conflict.
 */
const route = useRoute()
const router = useRouter()
const work = useWork()
const account = useAccount()
const toast = useToast()

type HistoryEntry = { id: string; event: string; actor: string; actorLabel: string | null; detail: Record<string, unknown>; at: string }

const task = ref<Task | null>(null)
const history = ref<HistoryEntry[]>([])
const outcomes = ref<OutcomeFeedback[]>([])
const error = ref<string | null>(null)
const conflict = ref<{ current: Task; fields: string[] } | null>(null)
const editing = ref(false)
const outcomeOpen = ref(false)
const dependencyOpen = ref(false)
const subtaskTitle = ref("")
const outcomeReason = ref<"blocked" | "no_longer_needed" | "underestimated" | "overestimated" | "incorrectly_defined" | "other">("blocked")
const outcomeNote = ref("")
const outcomeOccasion = ref<"completed" | "deferred" | "rescheduled" | "abandoned">("abandoned")
const dependencyQuery = ref("")

const taskId = computed(() => route.params.id as string)
const todayDate = computed(() => work.today.value?.date ?? todayIn(account.timeZone.value))

/**
 * A task opened before shows as it was at once, then updates. Only its reads
 * come from here: every write still sends the version the server returns, and
 * a write against a version that moved gets the conflict view below.
 */
const visited = remembered<Record<string, { task: Task; history: HistoryEntry[] }>>("task.visits", {})

const load = async (): Promise<void> => {
  const id = taskId.value
  const kept = visited.value[id]
  if (task.value?.id !== id) {
    task.value = kept?.task ?? null
    history.value = kept?.history ?? []
  }
  try {
    const [found, entries, recorded] = await Promise.all([
      work.findTask(id),
      api<{ items: HistoryEntry[] }>(`/work/tasks/${id}/history`),
      api<{ items: OutcomeFeedback[] }>(`/agent/outcomes?taskId=${encodeURIComponent(id)}`),
      work.projects.value.length === 0 ? work.loadProjects() : undefined,
    ])
    visited.value = { ...visited.value, [id]: { task: found, history: entries.items } }
    // An answer for the task just left must not land on the one now open.
    if (taskId.value !== id) return
    task.value = found
    history.value = entries.items
    outcomes.value = recorded.items
  } catch (loadError) {
    // A task that is gone is not shown from memory beside the error saying so.
    if (isApiError(loadError) && loadError.status === 404) {
      const { [id]: _gone, ...rest } = visited.value
      visited.value = rest
      if (taskId.value === id) task.value = null
    }
    error.value = errorMessage(loadError)
  }
}

onMounted(load)
watch(taskId, load)

const act = async (
  action: "start" | "stop" | "complete" | "uncomplete" | "trash" | "restore",
  extra: { subtasks?: "complete_remaining" | "leave_active"; reason?: string } = {},
): Promise<void> => {
  if (!task.value) return
  try {
    const outcome = await work.act(task.value.id, action, task.value.version, extra)
    if ("kind" in outcome && outcome.kind === "subtasks_pending") {
      // Completing a parent asks first; leaving them active is the safe default here.
      await work.act(task.value.id, "complete", task.value.version, { subtasks: "leave_active" })
    }
    if (action === "complete") toast.show({ tone: "success", title: "Completed. 1 point." })
    await load()
  } catch (actError) {
    if (isApiError(actError) && actError.error === "conflict" && actError.current) {
      conflict.value = { current: actError.current as Task, fields: actError.conflictingFields ?? [] }
      return
    }
    error.value = errorMessage(actError)
  }
}

/** Steps an agent researched and proposed, which count for nothing until accepted. */
const proposedSteps = computed(() => task.value?.subtasks.filter((subtask) => subtask.proposed) ?? [])
const settlingSteps = ref(false)

const settleSteps = async (action: "accept" | "discard"): Promise<void> => {
  if (!task.value) return
  settlingSteps.value = true
  try {
    await api(`/work/tasks/${task.value.id}/proposed-steps`, { method: "POST", body: { action } })
    if (action === "accept") {
      // Accepted steps are real work now, so the planner places them. A plan
      // that cannot run (no AI access) leaves them to be placed by hand.
      const planned = await recalculatePlan().then(() => true).catch(() => false)
      toast.show({
        tone: "success",
        title: "Steps accepted",
        detail: planned ? "The planner proposed times for them in Upcoming." : "Open Upcoming to plan times for them.",
      })
    } else {
      toast.show({ tone: "info", title: "Steps discarded", detail: "They are in the trash for 30 days." })
    }
    await load()
  } catch (settleError) {
    error.value = errorMessage(settleError)
  } finally {
    settlingSteps.value = false
  }
}

const addSubtask = async (): Promise<void> => {
  if (!task.value || subtaskTitle.value.trim() === "") return
  try {
    await work.createTask({
      title: subtaskTitle.value.trim(),
      parentId: task.value.id,
      projectId: task.value.projectId,
      labels: [],
      splitAllowed: true,
      priority: task.value.priority,
    })
    subtaskTitle.value = ""
    await load()
  } catch (subtaskError) {
    error.value = errorMessage(subtaskError)
  }
}

const candidates = computed(() =>
  work.tasks.value
    .filter((candidate) => candidate.id !== task.value?.id && candidate.state !== "trashed")
    .filter((candidate) => candidate.title.toLowerCase().includes(dependencyQuery.value.toLowerCase()))
    .slice(0, 12),
)

const openDependencies = async (): Promise<void> => {
  dependencyOpen.value = true
  await work.loadTasks({ states: ["open", "planned", "in_progress", "needs_clarification"] })
}

const addDependency = async (otherId: string): Promise<void> => {
  if (!task.value) return
  try {
    await api(`/work/tasks/${task.value.id}/dependencies`, { method: "POST", body: { dependsOnTaskId: otherId } })
    dependencyOpen.value = false
    await load()
  } catch (dependencyError) {
    // A cycle is refused with an explanation naming both tasks.
    error.value = errorMessage(dependencyError)
    dependencyOpen.value = false
  }
}

const removeDependency = async (otherId: string): Promise<void> => {
  if (!task.value) return
  await api(`/work/tasks/${task.value.id}/dependencies/${otherId}`, { method: "DELETE" })
  await load()
}

const recordOutcome = async (): Promise<void> => {
  if (!task.value) return
  try {
    await api(`/work/tasks/${task.value.id}/outcome`, {
      method: "POST",
      body: { reason: outcomeReason.value, note: outcomeNote.value.trim() || null, occasion: outcomeOccasion.value },
    })
    outcomeOpen.value = false
    outcomeNote.value = ""
    if (outcomeOccasion.value === "abandoned") {
      toast.show({ tone: "info", title: "Moved to the trash", detail: "Recoverable for 30 days." })
      await router.push("/trash")
      return
    }
    toast.show({ tone: "success", title: "Outcome recorded", detail: "Pawalist keeps it as a memory. See it under Memory." })
    await load()
  } catch (outcomeError) {
    error.value = errorMessage(outcomeError)
  }
}

const retryWithCurrent = async (): Promise<void> => {
  conflict.value = null
  await load()
}

const REASON_LABELS: Record<string, string> = {
  blocked: "Blocked",
  no_longer_needed: "No longer needed",
  underestimated: "Took longer",
  overestimated: "Took less time",
  incorrectly_defined: "Wrongly defined",
  other: "Something else",
}

const actorLabel = (actor: string, label: string | null): string => {
  if (actor === "user") return "You"
  if (actor === "agent") return "Agent"
  return label ? `${actor.toUpperCase()}: ${label}` : actor.toUpperCase()
}
</script>

<template>
  <div v-if="task">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h1 class="t-screen">{{ task.title }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <Badge :tone="task.state === 'planned' ? 'accepted' : task.state === 'in_progress' ? 'running' : 'neutral'" :dot="task.state === 'in_progress'">
            {{ TASK_STATE_LABELS[task.state] }}
          </Badge>
          <Badge v-if="task.overdue" tone="error">Overdue</Badge>
          <Badge v-if="task.blocked" tone="warning">Blocked</Badge>
          <span v-if="task.projectName" class="chip">
            <i class="chip-dot" :style="{ background: `var(--color-project-${task.projectColorIndex ?? 1})` }" />
            {{ task.projectName }}
          </span>
          <span v-for="label in task.labels" :key="label.id" class="chip">{{ label.name }}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="task.state === 'open' || task.state === 'planned'" type="button" class="btn btn-secondary" @click="act('start')">
          Start
        </button>
        <button v-if="task.state === 'in_progress'" type="button" class="btn btn-secondary" @click="act('stop')">
          Stop
        </button>
        <button type="button" class="btn btn-secondary" @click="editing = true">Edit</button>
        <button
          v-if="task.state !== 'completed'"
          type="button"
          class="btn btn-primary"
          data-testid="task-complete"
          @click="act('complete')"
        >
          <Icon name="check" :size="16" /> Complete
        </button>
        <button v-else type="button" class="btn btn-secondary" @click="act('uncomplete')">Reopen</button>
      </div>
    </div>

    <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

    <!-- The stale-update comparison: current beside attempted, changed fields marked. -->
    <Panel v-if="conflict" title="This task changed while you were editing it" class="mb-6">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="card p-3">
          <p class="t-label mb-2">Current</p>
          <p class="t-body">{{ conflict.current.title }}</p>
          <p class="t-mono-sm mt-2">version {{ conflict.current.version }}</p>
        </div>
        <div class="card p-3">
          <p class="t-label mb-2">Your change</p>
          <p class="t-body">{{ task.title }}</p>
          <p class="t-mono-sm mt-2">version {{ task.version }}</p>
        </div>
      </div>
      <p v-if="conflict.fields.length > 0" class="t-small mt-3">
        Both changed: {{ conflict.fields.join(", ") }}.
      </p>
      <button type="button" class="btn btn-secondary mt-4" @click="retryWithCurrent">Take the current version</button>
    </Panel>

    <div class="detail-split">
      <div class="section-stack">
        <Panel title="Details">
          <p v-if="task.description" class="t-body t-prose whitespace-pre-wrap"><LinkedText :text="task.description" /></p>
          <p v-else class="t-small">No description.</p>

          <dl class="mt-4 grid gap-3 sm:grid-cols-2">
            <div v-if="task.startAt">
              <dt class="t-label">Start</dt>
              <dd class="t-mono">{{ relativeDay(task.startAt, todayDate, account.timeZone.value) }}</dd>
            </div>
            <div v-if="task.deadlineAt">
              <dt class="t-label">Deadline ({{ task.deadlineFirmness }})</dt>
              <dd class="t-mono">
                {{ relativeDay(task.deadlineAt, todayDate, account.timeZone.value) }}
                <span v-if="!task.deadlineDateOnly">at {{ formatTime(task.deadlineAt, account.timeZone.value) }}</span>
              </dd>
            </div>
            <div v-if="task.durationMinutes">
              <dt class="t-label">Duration{{ task.durationSource === "agent" ? ", estimated" : "" }}</dt>
              <dd class="t-mono">{{ formatDuration(task.durationMinutes) }}</dd>
            </div>
            <div v-if="task.subtaskRemainingMinutes !== null">
              <dt class="t-label">Subtasks remaining</dt>
              <dd class="t-mono">{{ formatDuration(task.subtaskRemainingMinutes) }}</dd>
            </div>
            <div>
              <dt class="t-label">Your priority</dt>
              <dd><Priority :value="task.priority" /></dd>
            </div>
            <div v-if="task.computedRank !== null">
              <dt class="t-label">Computed rank</dt>
              <dd><span class="badge badge-proposed"><span class="t-mono">{{ task.computedRank }}</span></span></dd>
            </div>
            <div v-if="task.valueClass !== null">
              <dt class="t-label">What it is worth{{ task.valueClassByUser ? ", set by you" : "" }}</dt>
              <dd class="t-body">{{ VALUE_CLASS_LABELS[task.valueClass] }}</dd>
            </div>
            <div v-if="task.requiredConditions" class="sm:col-span-2">
              <dt class="t-label">Required conditions</dt>
              <dd class="t-body">{{ task.requiredConditions }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="t-label">Split allowed</dt>
              <dd class="t-body">{{ task.splitAllowed ? "Yes" : "No, it has to happen in one sitting" }}</dd>
            </div>
          </dl>

          <p v-if="task.rankRationale" class="t-small mt-4 border-t border-line pt-3">{{ task.rankRationale }}</p>
        </Panel>

        <Panel title="Subtasks" flush>
          <Feedback
            v-if="proposedSteps.length > 0"
            tone="info"
            title="Pawalist researched these steps"
            icon="upcoming"
            class="m-3"
            data-testid="proposed-steps"
          >
            They are proposals. Nothing is scheduled until you accept them. Open a step to change it first. The route and
            its sources are in the description above.
            <template #actions>
              <button type="button" class="btn btn-primary btn-compact" :disabled="settlingSteps" @click="settleSteps('accept')">
                Accept {{ proposedSteps.length }} step{{ proposedSteps.length === 1 ? "" : "s" }}
              </button>
              <button type="button" class="btn btn-tertiary btn-compact" :disabled="settlingSteps" @click="settleSteps('discard')">
                Discard
              </button>
            </template>
          </Feedback>
          <div v-if="task.subtasks.length > 0" class="list">
            <div
              v-for="subtask in task.subtasks"
              :key="subtask.id"
              :data-stage="subtask.state"
              :class="['row', subtask.proposed ? 'provisional' : '']"
            >
              <span :class="['circle', subtask.state === 'completed' ? 'is-complete' : '']">
                <Icon v-if="subtask.state === 'completed'" name="check" :size="12" />
              </span>
              <button type="button" class="row-title flex-1 text-left" @click="router.push(`/tasks/${subtask.id}`)">
                {{ subtask.title }}
              </button>
              <Badge v-if="subtask.proposed" tone="proposed">Proposed</Badge>
              <span v-if="subtask.durationMinutes" class="t-mono text-ink-muted">
                {{ formatDuration(subtask.durationMinutes) }}
              </span>
            </div>
          </div>
          <div class="panel-body flex gap-2">
            <input v-model="subtaskTitle" class="input" placeholder="Add a step" @keydown.enter="addSubtask" />
            <button type="button" class="btn btn-secondary" @click="addSubtask">Add</button>
          </div>
        </Panel>

        <Panel title="Dependencies">
          <template #actions>
            <button type="button" class="btn btn-tertiary btn-compact" @click="openDependencies">Add</button>
          </template>
          <p class="t-label mb-2">Waits for</p>
          <ul v-if="task.blockedBy.length > 0" class="space-y-2">
            <li v-for="prerequisite in task.blockedBy" :key="prerequisite.id" class="flex items-center gap-2">
              <Icon name="dependency" :size="16" />
              <button type="button" class="t-body flex-1 text-left" @click="router.push(`/tasks/${prerequisite.id}`)">
                {{ prerequisite.title }}
              </button>
              <Badge tone="neutral">{{ TASK_STATE_LABELS[prerequisite.state] }}</Badge>
              <button type="button" class="btn btn-tertiary btn-compact" @click="removeDependency(prerequisite.id)">
                Remove
              </button>
            </li>
          </ul>
          <p v-else class="t-small">Nothing blocks this task.</p>

          <div class="mt-4 border-t border-line pt-3">
            <p class="t-label mb-2">Blocks</p>
            <ul v-if="task.blocks.length > 0" class="space-y-2">
              <li v-for="downstream in task.blocks" :key="downstream.id" class="flex items-center gap-2">
                <Icon name="dependency" :size="16" />
                <button type="button" class="t-body flex-1 text-left" @click="router.push(`/tasks/${downstream.id}`)">
                  {{ downstream.title }}
                </button>
                <Badge tone="neutral">{{ TASK_STATE_LABELS[downstream.state] }}</Badge>
              </li>
            </ul>
            <p v-else class="t-small">Nothing waits for this task.</p>
          </div>
        </Panel>
      </div>

      <div class="section-stack">
        <Panel title="Placements">
          <ul v-if="task.scheduleBlocks.length > 0" class="block-stack">
            <li
              v-for="block in task.scheduleBlocks"
              :key="block.id"
              :class="
                block.status === 'proposed'
                  ? 'block block-proposed'
                  : block.status === 'missed'
                    ? 'block block-missed'
                    : 'block block-accepted'
              "
            >
              <p class="block-time">
                {{ block.date }}
                <span v-if="block.startsAt">{{ formatTime(block.startsAt, account.timeZone.value) }}</span>
                <span v-else>no set time</span>
              </p>
              <p class="t-caption">{{ block.status }}, {{ formatDuration(block.durationMinutes) }}</p>
            </li>
          </ul>
          <p v-else class="t-small">Not placed on any day yet.</p>
          <button type="button" class="btn btn-secondary mt-4 w-full" @click="router.push('/upcoming')">
            Open the plan
          </button>
        </Panel>

        <Panel title="Provenance">
          <dl class="space-y-2">
            <div>
              <dt class="t-label">Created by</dt>
              <dd class="t-body">{{ actorLabel(task.createdBy, task.createdByLabel) }}</dd>
            </div>
            <div v-if="task.captureId">
              <dt class="t-label">From a capture</dt>
              <dd>
                <button type="button" class="t-body text-accent-text" @click="router.push('/inbox')">
                  Open the original capture
                </button>
              </dd>
            </div>
            <div v-if="task.seriesId">
              <dt class="t-label">Recurring series</dt>
              <dd>
                <button type="button" class="t-body text-accent-text" @click="router.push(`/series/${task.seriesId}`)">
                  Open the series
                </button>
                <span v-if="task.occurrenceDate" class="t-mono-sm block">calendar date {{ task.occurrenceDate.replace("T", " ") }}</span>
              </dd>
            </div>
            <div>
              <dt class="t-label">Record version</dt>
              <dd class="t-mono-sm">{{ task.version }}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="History" flush>
          <table class="table">
            <tbody>
              <tr v-for="entry in history.slice(0, 20)" :key="entry.id">
                <td>{{ entry.event.replace(/_/g, " ") }}</td>
                <td class="cell-token">{{ actorLabel(entry.actor, entry.actorLabel) }}</td>
                <td class="num t-mono-sm">{{ entry.at.slice(0, 16).replace("T", " ") }}</td>
              </tr>
            </tbody>
          </table>
        </Panel>

        <Panel title="If it went differently">
          <p class="t-small">
            Recording an outcome is the only thing that teaches Pawalist. It becomes a memory you can read, disable or
            delete.
          </p>
          <ul v-if="outcomes.length > 0" class="mt-3 space-y-2" data-testid="task-outcomes">
            <li v-for="outcome in outcomes" :key="outcome.id" class="border-t border-line pt-2">
              <p class="flex items-center gap-2">
                <Badge tone="neutral">{{ REASON_LABELS[outcome.reason] }}</Badge>
                <span class="t-mono-sm">{{ outcome.createdAt.slice(0, 10) }}</span>
              </p>
              <p v-if="outcome.note" class="t-small mt-1">{{ outcome.note }}</p>
            </li>
            <li>
              <button type="button" class="t-small text-accent-text" @click="router.push('/memory')">Open Memory</button>
            </li>
          </ul>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              @click="((outcomeOpen = true), (outcomeOccasion = 'completed'))"
            >
              Record an outcome
            </button>
            <button
              type="button"
              class="btn btn-destructive btn-compact"
              data-testid="abandon-task"
              @click="((outcomeOpen = true), (outcomeOccasion = 'abandoned'))"
            >
              Abandon it
            </button>
            <button type="button" class="btn btn-destructive btn-compact" @click="act('trash')">Move to trash</button>
          </div>
        </Panel>
      </div>
    </div>

    <TaskForm v-if="editing" :task="task" :projects="work.projects.value" @close="editing = false" @saved="load" />

    <Modal v-if="outcomeOpen" :title="outcomeOccasion === 'abandoned' ? 'Abandon this task' : 'Record an outcome'" @close="outcomeOpen = false">
      <p v-if="outcomeOccasion === 'abandoned'" class="t-body mb-4">
        Abandoning records why and moves the task to recoverable trash. You can restore it for 30 days.
      </p>
      <label class="field-label" for="outcome-reason">What happened</label>
      <select id="outcome-reason" v-model="outcomeReason" class="select">
        <option value="blocked">It was blocked</option>
        <option value="no_longer_needed">It was no longer needed</option>
        <option value="underestimated">It took longer than estimated</option>
        <option value="overestimated">It took less time than estimated</option>
        <option value="incorrectly_defined">It was not defined correctly</option>
        <option value="other">Something else</option>
      </select>
      <label class="field-label mt-4" for="outcome-note">In your words</label>
      <textarea id="outcome-note" v-model="outcomeNote" class="textarea" rows="3" data-testid="outcome-note" />

      <template #actions>
        <button type="button" class="btn btn-secondary" @click="outcomeOpen = false">Cancel</button>
        <button type="button" class="btn btn-primary" data-testid="outcome-save" @click="recordOutcome">Save</button>
      </template>
    </Modal>

    <Modal v-if="dependencyOpen" title="What has to finish first" @close="dependencyOpen = false">
      <input v-model="dependencyQuery" class="input" placeholder="Search your tasks" />
      <ul class="mt-3 max-h-80 space-y-1 overflow-y-auto">
        <li v-for="candidate in candidates" :key="candidate.id">
          <button type="button" class="btn btn-tertiary w-full justify-start" @click="addDependency(candidate.id)">
            {{ candidate.title }}
          </button>
        </li>
      </ul>
    </Modal>
  </div>

  <!-- The same header and split as the task, a little shorter than any real
       one, so what arrives lands where the skeleton stood and only grows down. -->
  <div v-else-if="!error" aria-busy="true">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h1 class="t-screen"><Skeleton class="w-64 max-w-full" /></h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <Skeleton class="h-5 w-16" />
          <Skeleton class="h-5 w-24" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Skeleton class="h-9 w-16" />
        <Skeleton class="h-9 w-14" />
        <Skeleton class="h-9 w-28" />
      </div>
    </div>

    <div class="detail-split">
      <div class="section-stack">
        <Panel title="Details">
          <p class="t-body"><Skeleton class="w-4/5" /></p>
          <dl class="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="t-label">Your priority</dt>
              <dd class="t-body"><Skeleton class="w-16" /></dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Subtasks" flush>
          <SkeletonRows :count="2" />
        </Panel>
      </div>

      <div class="section-stack">
        <Panel title="Placements">
          <p class="t-small"><Skeleton class="w-40" /></p>
        </Panel>

        <Panel title="Provenance">
          <dl class="space-y-2">
            <div>
              <dt class="t-label">Created by</dt>
              <dd class="t-body"><Skeleton class="w-20" /></dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  </div>

  <Feedback v-else tone="error" title="That task is not here" icon="overdue">{{ error }}</Feedback>
</template>
