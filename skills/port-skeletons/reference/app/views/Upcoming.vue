<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { PlacementConflict, ScheduleBlock, Task } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Segmented from "../components/Segmented.vue"
import CapacityMeter from "../components/CapacityMeter.vue"
import EmptyState from "../components/EmptyState.vue"
import Feedback from "../components/Feedback.vue"
import Icon from "../components/Icon.vue"
import TaskRow from "../components/TaskRow.vue"
import Skeleton from "../components/Skeleton.vue"
import SkeletonRows from "../components/SkeletonRows.vue"
import { inOrder } from "../lib/order.ts"
import { recalculatePlan } from "../lib/recalculatePlan.ts"
import Modal from "../components/Modal.vue"
import { api, isApiError } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { PLAN_HORIZON_DAYS } from "@pawalist/contracts"
import { addDaysTo, formatDayName, formatDuration, formatTime, todayIn } from "../lib/format.ts"

/**
 * Upcoming: what to do next, in order.
 *
 * The order is the screen. Work is done from the top down, and the number on
 * each row is its place in that order, drawn in the dashed computed recipe
 * because Pawalist worked it out rather than the person (planning/order.ts).
 * Beside it sits what the work is worth, which is the first thing the order is
 * decided by.
 *
 * Above the order is the short list of things that happen at a stated hour: an
 * appointment, an occurrence of "every Sunday at 11". Only those are placed,
 * and the calendar and the capacity meter describe only them. A proposed block
 * is dashed and unfilled, an accepted one solid, a missed one carries a warning
 * edge with its time struck through, and accepting is the only thing that makes
 * a placement count against capacity.
 */
const router = useRouter()
const work = useWork()
const account = useAccount()

const layout = ref<"list" | "calendar">("list")
const horizon = ref<"day" | "week">("week")
const error = ref<string | null>(null)
const rescheduling = ref(false)
const accepting = ref(false)
const dismissedRun = ref<string | null>(null)
const conflict = ref<PlacementConflict | null>(null)
const moving = ref<{ block: ScheduleBlock; title: string } | null>(null)
const moveDate = ref("")
const moveTime = ref("")
const moveDuration = ref("")

const plan = computed(() => work.plan.value)
/** Null until the first answer, so an order that has not loaded is not drawn as an empty one. */
const openTasks = remembered<Task[] | null>("upcoming.openTasks", null)
const today = computed(() => todayIn(account.timeZone.value))

/**
 * The order, exactly as the server ranked it: the request asks for `sort=rank`,
 * so nothing is re-sorted here and the numbers on screen are the ranks that
 * were written. What leaves it, and why, is in `lib/order.ts`.
 */
const ordered = computed(() => inOrder(openTasks.value ?? [], today.value))

/** The clock, refreshed every minute, so the calendar's now line keeps up. */
const now = ref(new Date())
const clock = window.setInterval(() => {
  now.value = new Date()
}, 60_000)
onUnmounted(() => window.clearInterval(clock))

const nowMinutes = computed(() => {
  const [hour, minute] = formatTime(now.value.toISOString(), account.timeZone.value).split(":").map(Number)
  return hour! * 60 + minute!
})
const hourOf = (iso: string | null): number => Number(formatTime(iso, account.timeZone.value).slice(0, 2))

/**
 * The calendar's rows: 08:00 to 19:00, widened to take in any block that sits
 * outside those hours, so early or late work is never simply not drawn.
 */
const hours = computed(() => {
  const timed = days.value.flatMap((day) => day.timed)
  const first = Math.min(8, ...timed.map((block) => hourOf(block.startsAt)))
  const last = Math.max(19, ...timed.map((block) => Math.min(23, hourOf(block.endsAt))))
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
})

const openTask = (block: ScheduleBlock): void => {
  void router.push(`/tasks/${block.taskId}`)
}

const statusOf = (block: ScheduleBlock): { label: string; cls: string } => {
  if (block.conflicted) return { label: "Conflicted", cls: "block-status block-status-conflicted" }
  if (block.status === "proposed") return { label: "Proposed", cls: "block-status block-status-proposed" }
  if (block.status === "missed") return { label: "Missed", cls: "block-status block-status-missed" }
  return { label: "Accepted", cls: "block-status" }
}

const taskOf = (block: ScheduleBlock): string =>
  plan.value?.tasks.find((task) => task.id === block.taskId)?.title ?? "Task"

const proposedCount = computed(
  () => plan.value?.days.flatMap((day) => [...day.timed, ...day.untimed]).filter((block) => block.status === "proposed").length ?? 0,
)

const unplaceable = computed(() => {
  if (!plan.value?.lastRun || dismissedRun.value === plan.value.lastRun.at) return []
  const placedTaskIds = new Set(
    plan.value.days
      .flatMap((day) => [...day.timed, ...day.untimed])
      .filter((block) => block.status === "accepted" || block.status === "proposed")
      .map((block) => block.taskId),
  )
  return plan.value.lastRun.unplaceable.filter((item) => !placedTaskIds.has(item.taskId))
})

const days = computed(() => (horizon.value === "day" ? (plan.value?.days.slice(0, 1) ?? []) : (plan.value?.days ?? [])))

/**
 * Days from today to the first day on screen. The planner places six weeks
 * ahead, and the screen pages through them a day or a week at a time.
 */
const offset = ref(0)
const step = computed(() => (horizon.value === "day" ? 1 : 7))
const canGoLater = computed(() => offset.value + step.value < PLAN_HORIZON_DAYS)
const pageLabel = computed(() => {
  if (offset.value === 0) return horizon.value === "day" ? "Today" : "This week"
  const first = addDaysTo(today.value, offset.value)
  if (horizon.value === "day") return formatDayName(first, account.timeZone.value)
  return `${formatDayName(first, account.timeZone.value)} to ${formatDayName(addDaysTo(first, 6), account.timeZone.value)}`
})

const page = async (direction: -1 | 1): Promise<void> => {
  offset.value = Math.max(0, offset.value + direction * step.value)
  await load()
}

const changeHorizon = async (): Promise<void> => {
  offset.value = 0
  await load()
}

const load = async (): Promise<void> => {
  try {
    const [, open] = await Promise.all([
      work.loadPlan(offset.value === 0 ? undefined : addDaysTo(today.value, offset.value), step.value),
      api<{ items: Task[] }>("/work/tasks?state=open,planned,in_progress&sort=rank"),
    ])
    openTasks.value = open.items
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

/**
 * Recalculates the order over everything, and proposes placements for the work
 * that happens at a stated hour. One request, because to the person it is one
 * act: they press it and expect the list below to be right.
 */
const reprioritise = async (): Promise<void> => {
  rescheduling.value = true
  error.value = null
  try {
    await recalculatePlan()
    await load()
  } catch (reprioritiseError) {
    error.value = errorMessage(reprioritiseError)
  } finally {
    rescheduling.value = false
  }
}

const complete = async (task: Task): Promise<void> => {
  try {
    await work.act(task.id, "complete", task.version, { subtasks: "leave_active" })
    await load()
  } catch (completeError) {
    error.value = errorMessage(completeError)
  }
}

const acceptAll = async (): Promise<void> => {
  accepting.value = true
  error.value = null
  try {
    const versions: Record<string, number> = {}
    for (const day of plan.value?.days ?? []) {
      for (const block of [...day.timed, ...day.untimed]) {
        if (block.status === "proposed") versions[block.id] = block.version
      }
    }
    await api("/planning/plan/accept", { method: "POST", body: { blockIds: Object.keys(versions), versions } })
    await load()
  } catch (acceptError) {
    error.value = errorMessage(acceptError)
  } finally {
    accepting.value = false
  }
}

const acceptOne = async (block: ScheduleBlock): Promise<void> => {
  try {
    await api("/planning/plan/accept", {
      method: "POST",
      body: { blockIds: [block.id], versions: { [block.id]: block.version } },
    })
    await load()
  } catch (acceptError) {
    error.value = errorMessage(acceptError)
  }
}

const reject = async (block: ScheduleBlock): Promise<void> => {
  try {
    await api(`/planning/blocks/${block.id}`, { method: "DELETE" })
    await load()
  } catch (rejectError) {
    error.value = errorMessage(rejectError)
  }
}

const startMove = (block: ScheduleBlock): void => {
  moving.value = { block, title: taskOf(block) }
  moveDate.value = block.date
  moveTime.value = block.startsAt ? formatTime(block.startsAt, account.timeZone.value) : ""
  moveDuration.value = String(block.durationMinutes)
  conflict.value = null
}

const confirmMove = async (acceptConflict = false): Promise<void> => {
  if (!moving.value) return
  try {
    await api(`/planning/blocks/${moving.value.block.id}`, {
      method: "PATCH",
      body: {
        version: moving.value.block.version,
        kind: moveTime.value === "" ? "date_only" : "timed",
        date: moveDate.value,
        startTime: moveTime.value === "" ? null : moveTime.value,
        durationMinutes: Number(moveDuration.value),
        accept: true,
        acceptConflict,
      },
    })
    moving.value = null
    conflict.value = null
    await load()
  } catch (moveError) {
    // A conflict is a preview, not a failure: the move has not been applied.
    if (isApiError(moveError) && moveError.error === "placement_conflict") {
      conflict.value = moveError as unknown as PlacementConflict
      return
    }
    error.value = errorMessage(moveError)
  }
}

const takeAlternative = (alternative: { date: string; startTime: string | null }): void => {
  moveDate.value = alternative.date
  moveTime.value = alternative.startTime ?? ""
  conflict.value = null
}

const blockClass = (block: ScheduleBlock): string => {
  if (block.status === "missed") return "block block-missed"
  if (block.status === "proposed") return "block block-proposed"
  return block.conflicted ? "block block-conflicted" : "block block-accepted"
}
</script>

<template>
  <div class="mb-6 hidden items-center justify-between lg:flex">
    <h1 class="t-screen">Upcoming</h1>
    <button type="button" class="btn btn-secondary" :disabled="rescheduling" @click="reprioritise">
      <span v-if="rescheduling" class="btn-spinner" aria-hidden="true" />
      Reprioritise
    </button>
  </div>

  <!--
    The one control that belongs to the whole screen. It was in the wide header
    only, so asking for a fresh order was impossible on a phone.
  -->
  <div class="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
    <button type="button" class="btn btn-secondary btn-compact" :disabled="rescheduling" @click="reprioritise">
      <span v-if="rescheduling" class="btn-spinner" aria-hidden="true" />
      Reprioritise
    </button>
  </div>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <!--
    The order: the list the day is actually worked from, top down. The number is
    the place, not a score, and nothing on this screen re-sorts what the server
    ranked.
  -->
  <Panel title="In order" flush data-testid="in-order">
    <template #actions>
      <span v-if="openTasks" class="t-mono-sm">{{ ordered.length }}</span>
      <span v-else class="t-mono-sm"><Skeleton class="h-2.5 w-6" /></span>
    </template>
    <SkeletonRows v-if="!openTasks && !error" />
    <div v-else-if="ordered.length === 0" class="empty">
      <p>Nothing is waiting. Anything you capture lands here once it has been filed.</p>
    </div>
    <div v-else class="list">
      <TaskRow
        v-for="(task, index) in ordered"
        :key="task.id"
        :task="task"
        :time-zone="account.timeZone.value"
        :today="today"
        :position="index + 1"
        show-value-class
        show-state
        @complete="complete"
        @open="router.push(`/tasks/${task.id}`)"
      />
    </div>
  </Panel>

  <!--
    Work that happens at a stated hour, and only that. Under the default
    placement mode this is a short list, which is the point: a calendar of
    guesses was a timetable nobody kept.
  -->
  <div class="mb-3 mt-8 flex flex-wrap items-center justify-between gap-2">
    <h2 class="t-label">On the calendar</h2>
    <div class="flex items-center gap-2">
      <Segmented
        v-model="horizon"
        :options="[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
        ]"
        @update:model-value="changeHorizon"
      />
      <Segmented
        v-model="layout"
        :options="[
          { value: 'list', label: 'List' },
          { value: 'calendar', label: 'Calendar' },
        ]"
      />
    </div>
  </div>

  <nav class="mb-4 flex items-center justify-between gap-2" aria-label="Move through the plan">
    <button type="button" class="btn btn-tertiary btn-compact" :disabled="offset === 0" @click="page(-1)">
      ← Previous {{ horizon }}
    </button>
    <span class="t-label" data-testid="plan-page">{{ pageLabel }}</span>
    <button type="button" class="btn btn-tertiary btn-compact" :disabled="!canGoLater" @click="page(1)">
      Next {{ horizon }} →
    </button>
  </nav>

  <Feedback
    v-if="proposedCount > 0"
    tone="info"
    title="The planner has a proposal"
    icon="upcoming"
    class="mb-6"
  >
    {{ proposedCount }} placement{{ proposedCount === 1 ? "" : "s" }} are proposed. Nothing counts against your capacity
    until you accept it.
    <template #actions>
      <button type="button" class="btn btn-primary" :disabled="accepting" data-testid="accept-plan" @click="acceptAll">
        <span v-if="accepting" class="btn-spinner" aria-hidden="true" />
        Accept the plan
      </button>
    </template>
  </Feedback>

  <Feedback
    v-if="unplaceable.length > 0"
    tone="warning"
    title="Some fixed-time work has nowhere to go"
    icon="overdue"
    class="mb-6"
  >
    These tasks happen at a stated hour that the plan cannot give them. Open each one to fix the reason below, or change
    working hours if the day needs more time.
    <ul class="mt-1 space-y-1">
      <li v-for="item in unplaceable.slice(0, 5)" :key="item.taskId" class="flex flex-wrap items-baseline gap-x-2">
        <span>{{ item.title }}: {{ item.reason }}</span>
        <button
          type="button"
          class="font-semibold underline underline-offset-2"
          @click="router.push(`/tasks/${item.taskId}`)"
        >
          Open task
        </button>
      </li>
    </ul>
    <template #actions>
      <button type="button" class="btn btn-secondary btn-compact" @click="router.push('/settings')">
        Change working hours
      </button>
      <button type="button" class="btn btn-tertiary btn-compact" @click="dismissedRun = plan!.lastRun!.at">
        Dismiss
      </button>
    </template>
  </Feedback>

  <!-- List layout: one panel per day, untimed work then timed, blocks touching. -->
  <div v-if="layout === 'list'" class="section-stack">
    <template v-if="!plan && !error">
      <section v-for="index in step" :key="index" class="panel" aria-busy="true">
        <header class="panel-head">
          <h2 class="t-section"><Skeleton class="w-24" /></h2>
          <span class="t-mono"><Skeleton class="w-16" /></span>
        </header>
        <div class="px-4 py-8 text-sm leading-5"><p><Skeleton class="w-56" /></p></div>
      </section>
    </template>
    <Panel v-for="day in days" :key="day.date" :title="formatDayName(day.date, account.timeZone.value)" flush>
      <template #actions>
        <span v-if="day.capacity.overCapacity" class="badge badge-warning">Over capacity</span>
        <span class="t-mono text-ink-muted">
          {{ formatDuration(day.capacity.acceptedMinutes) }} / {{ formatDuration(day.capacity.capacityMinutes) }}
        </span>
      </template>

      <div v-if="day.timed.length + day.untimed.length === 0" class="empty">
        <p>Nothing at a stated hour on this day.</p>
      </div>

      <div v-else class="block-stack">
        <div
          v-for="block in [...day.untimed, ...day.timed]"
          :key="block.id"
          :class="[blockClass(block), '!border-x-0 !px-4 !py-3 first:!border-t-0 last:!border-b-0']"
          :data-testid="`plan-block-${block.id}`"
        >
          <div class="flex items-start justify-between gap-3">
            <button type="button" class="min-w-0 flex-1 text-left" @click="openTask(block)">
              <p class="block-title truncate">{{ taskOf(block) }}</p>
              <p v-if="block.kind === 'timed'" class="block-time">
                {{ formatTime(block.startsAt, account.timeZone.value) }}–{{
                  formatTime(block.endsAt, account.timeZone.value)
                }}
                <span v-if="block.splitCount" class="t-caption">{{ block.splitIndex }} of {{ block.splitCount }}</span>
              </p>
              <p v-else class="block-time">{{ formatDuration(block.durationMinutes) }}, no set time</p>
            </button>
            <span :class="statusOf(block).cls">{{ statusOf(block).label }}</span>
          </div>
          <p v-if="block.conflictReason" class="t-small mt-2 text-error">{{ block.conflictReason }}</p>
          <div class="mt-2 flex gap-2">
            <button
              v-if="block.status === 'proposed'"
              type="button"
              class="btn btn-secondary btn-compact"
              @click="acceptOne(block)"
            >
              Accept
            </button>
            <button type="button" class="btn btn-tertiary btn-compact" @click="startMove(block)">Move</button>
            <button
              v-if="block.status === 'proposed'"
              type="button"
              class="btn btn-tertiary btn-compact"
              @click="reject(block)"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </Panel>
  </div>

  <!--
    Calendar layout: the same data, a seven-column grid with an untimed band.
    Every block opens its task; the current time is a rule across today.
  -->
  <Panel v-else title="Week" flush>
    <div class="overflow-x-auto">
      <div class="min-w-[720px]">
        <div class="grid" style="grid-template-columns: 56px repeat(7, minmax(0, 1fr))">
          <div class="border-b border-line" />
          <div v-for="day in days" :key="day.date" class="border-b border-l border-line p-2">
            <p :class="['t-caption', day.date === today ? 'text-ink' : '']">
              {{ formatDayName(day.date, account.timeZone.value) }}
            </p>
            <p class="t-mono text-ink-muted">{{ formatDuration(day.capacity.acceptedMinutes) }}</p>
          </div>
        </div>

        <!-- The untimed band sits above the grid, for date-only placements. -->
        <div class="grid" style="grid-template-columns: 56px repeat(7, minmax(0, 1fr))">
          <div class="t-caption border-b border-line p-2">All day</div>
          <div v-for="day in days" :key="day.date" class="min-h-[44px] border-b border-l border-line p-1">
            <div class="block-stack">
              <button
                v-for="item in day.allDay"
                :key="`${item.taskId}-${item.kind}`"
                type="button"
                class="all-day-item"
                :title="`${item.title}, ${item.kind === 'deadline' ? 'due' : 'starts'}`"
                :data-testid="`all-day-${item.taskId}`"
                @click="router.push(`/tasks/${item.taskId}`)"
              >
                <Icon v-if="item.recurring" name="recurrence" :size="12" />
                <span class="truncate">{{ item.title }}</span>
              </button>
              <button
                v-for="block in day.untimed"
                :key="block.id"
                type="button"
                :class="blockClass(block)"
                class="!p-1"
                :title="`${taskOf(block)}, ${statusOf(block).label.toLowerCase()}`"
                @click="openTask(block)"
              >
                <p class="block-title truncate">{{ taskOf(block) }}</p>
              </button>
            </div>
          </div>
        </div>

        <div v-for="hour in hours" :key="hour" class="grid" style="grid-template-columns: 56px repeat(7, minmax(0, 1fr))">
          <div class="t-mono border-b border-line p-1 text-ink-muted">{{ String(hour).padStart(2, "0") }}:00</div>
          <div
            v-for="day in days"
            :key="day.date"
            :class="[
              'relative min-h-[44px] border-b border-l border-line p-1',
              day.date < today || (day.date === today && (hour + 1) * 60 <= nowMinutes) ? 'bg-sunken' : '',
            ]"
          >
            <span
              v-if="day.date === today && Math.floor(nowMinutes / 60) === hour"
              class="now-line"
              :style="{ top: `${((nowMinutes % 60) / 60) * 100}%` }"
              aria-hidden="true"
            />
            <div class="block-stack">
              <button
                v-for="block in day.timed.filter((candidate) => hourOf(candidate.startsAt) === hour)"
                :key="block.id"
                type="button"
                :class="blockClass(block)"
                class="!p-1"
                :title="`${taskOf(block)}, ${statusOf(block).label.toLowerCase()}`"
                :data-testid="`calendar-block-${block.id}`"
                @click="openTask(block)"
              >
                <p class="block-title truncate">{{ taskOf(block) }}</p>
                <p class="block-time">{{ formatTime(block.startsAt, account.timeZone.value) }}</p>
                <p v-if="block.status !== 'accepted' || block.conflicted" :class="statusOf(block).cls">
                  {{ statusOf(block).label }}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Panel>

  <!-- Capacity describes the placed work only; the order consumes nothing. -->
  <Panel v-if="days.some((day) => day.timed.length + day.untimed.length > 0)" title="Capacity" class="mt-6">
    <div class="space-y-4">
      <div v-for="day in days" :key="day.date">
        <p class="t-label mb-1">{{ formatDayName(day.date, account.timeZone.value) }}</p>
        <CapacityMeter :capacity="day.capacity" />
      </div>
    </div>
  </Panel>

  <!--
    An empty calendar is the normal state now, not a problem to solve, so this
    says what belongs here rather than offering to fill it.
  -->
  <EmptyState
    v-if="plan && plan.days.every((day) => day.timed.length + day.untimed.length === 0)"
    message="Nothing here happens at a stated hour. Give a task a time, or place one by hand, and it appears here."
    class="mt-6"
  >
    <button type="button" class="btn btn-secondary" @click="router.push('/settings')">Working hours</button>
  </EmptyState>

  <Modal v-if="moving" :title="`Move ${moving.title}`" @close="moving = null">
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="field-label" for="move-date">Day</label>
          <input id="move-date" v-model="moveDate" type="date" class="input input-mono" />
        </div>
        <div>
          <label class="field-label" for="move-time">Time</label>
          <input id="move-time" v-model="moveTime" type="time" class="input input-mono" />
        </div>
        <div>
          <label class="field-label" for="move-duration">Minutes</label>
          <input id="move-duration" v-model="moveDuration" type="number" min="5" class="input input-mono" />
        </div>
      </div>
      <p class="t-caption">Leaving the time empty makes this a date-only placement: it takes the duration from the day's capacity without claiming a time.</p>

      <Feedback v-if="conflict" tone="warning" title="That placement conflicts" icon="overdue">
        {{ conflict.message }}
        <ul v-if="conflict.overlapping.length > 0" class="mt-2 space-y-1">
          <li v-for="item in conflict.overlapping" :key="item.blockId">
            Overlaps {{ item.taskTitle }} at {{ formatTime(item.startsAt, account.timeZone.value) }}
          </li>
        </ul>
        <template #actions>
          <button
            v-for="alternative in conflict.alternatives"
            :key="`${alternative.date}${alternative.startTime}`"
            type="button"
            class="btn btn-secondary btn-compact"
            @click="takeAlternative(alternative)"
          >
            {{ formatDayName(alternative.date, account.timeZone.value) }}
            {{ alternative.startTime ?? "" }}
          </button>
          <button type="button" class="btn btn-secondary btn-compact" @click="confirmMove(true)">
            Place it anyway
          </button>
        </template>
      </Feedback>
    </div>

    <template #actions>
      <button type="button" class="btn btn-secondary" @click="moving = null">Cancel</button>
      <button type="button" class="btn btn-primary" @click="confirmMove(false)">
        <Icon name="check" :size="16" /> Move it
      </button>
    </template>
  </Modal>
</template>
