<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { Task } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import TaskRow from "../components/TaskRow.vue"
import CapacityMeter from "../components/CapacityMeter.vue"
import EmptyState from "../components/EmptyState.vue"
import Feedback from "../components/Feedback.vue"
import Icon from "../components/Icon.vue"
import Modal from "../components/Modal.vue"
import Skeleton from "../components/Skeleton.vue"
import SkeletonRows from "../components/SkeletonRows.vue"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { useToast } from "../stores/toast.ts"
import { formatDayName } from "../lib/format.ts"

/**
 * Today: what is owed today, then what is next.
 *
 * The first list is work that is actually due: an accepted placement for today,
 * plus every active, incomplete, unblocked task whose placement has elapsed or
 * whose deadline has passed. The second is the top of the order, which is what
 * answers "and now?" on a day with nothing at a set hour — most days. Blocked
 * overdue work sits in a collapsed section outside both, and Inbox, Needs
 * Clarification, Completed and Trashed records never appear at all.
 */
const router = useRouter()
const work = useWork()
const account = useAccount()
const toast = useToast()

const error = ref<string | null>(null)
const blockedOpen = ref(false)
const subtaskPrompt = ref<{ task: Task; remaining: number; points: number } | null>(null)
const explaining = ref<Task | null>(null)

const today = computed(() => work.today.value)

const refresh = async (): Promise<void> => {
  try {
    await Promise.all([work.loadToday(), account.load()])
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(async () => {
  await Promise.all([refresh(), work.loadProjects().catch(() => undefined)])
})

/**
 * Completion: the row leaves immediately and the point arrives with the
 * response, because the spec requires the visible transition not to wait for
 * the score. Undo stays directly available for ten seconds.
 */
const complete = async (task: Task, subtasks?: "complete_remaining" | "leave_active"): Promise<void> => {
  try {
    const outcome = await work.act(task.id, "complete", task.version, subtasks ? { subtasks } : {})
    if ("kind" in outcome && outcome.kind === "subtasks_pending") {
      subtaskPrompt.value = { task, remaining: outcome.remaining, points: outcome.points }
      return
    }
    subtaskPrompt.value = null
    work.forget(task.id)
    const points = "kind" in outcome && outcome.kind === "completed" ? outcome.points : 1
    toast.show(
      {
        tone: "success",
        title: `Completed. ${points} point${points === 1 ? "" : "s"}.`,
        action: {
          label: "Undo",
          run: async () => {
            const current = await work.findTask(task.id)
            await work.act(task.id, "uncomplete", current.version)
            await refresh()
          },
        },
      },
      10_000,
    )
    await refresh()
  } catch (actError) {
    error.value = errorMessage(actError)
    await refresh()
  }
}

const open = (task: Task): void => {
  void router.push(`/tasks/${task.id}`)
}
</script>

<template>
  <h1 class="t-screen hidden lg:block">Today</h1>
  <p v-if="today" class="t-label mb-6 hidden lg:block">{{ formatDayName(today.date, account.timeZone.value) }}</p>
  <p v-else class="t-label mb-6 hidden lg:block"><Skeleton class="h-3 w-28" /></p>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="section-stack">
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" data-bleed>
      <div class="section-stack">
        <Panel title="Due today" :busy="work.loading.value" flush>
          <template #actions>
            <span v-if="today" class="t-caption">{{ today.tasks.length }} to do</span>
            <Skeleton v-else class="w-12" />
          </template>
          <div v-if="today && today.tasks.length > 0" class="list" data-testid="today-list">
            <TaskRow
              v-for="task in today.tasks"
              :key="task.id"
              :task="task"
              :time-zone="account.timeZone.value"
              :today="today.date"
              show-state
              @complete="complete"
              @open="open"
            />
          </div>
          <EmptyState
            v-else-if="today"
            message="Nothing happens at a set time today and nothing is overdue. What is next is below."
          >
            <button type="button" class="btn btn-secondary" @click="router.push('/upcoming')">Open Upcoming</button>
          </EmptyState>
          <SkeletonRows v-else-if="!error" />
        </Panel>

        <!--
          The top of the order. Today used to be made of placements alone, which
          left it empty on a day with nothing at a set hour; what to do next is
          the order's answer, not the calendar's.
        -->
        <Panel v-if="today && today.next.length > 0" title="Next in order" flush data-testid="next-in-order">
          <template #actions>
            <button type="button" class="btn btn-tertiary btn-compact" @click="router.push('/upcoming')">
              The whole list
            </button>
          </template>
          <div class="list">
            <TaskRow
              v-for="(task, index) in today.next"
              :key="task.id"
              :task="task"
              :time-zone="account.timeZone.value"
              :today="today.date"
              :position="index + 1"
              show-value-class
              @complete="complete"
              @open="open"
            />
          </div>
        </Panel>

        <Panel v-if="today && today.untimed.length > 0" title="No particular time" flush>
          <div class="list">
            <TaskRow
              v-for="task in today.untimed"
              :key="task.id"
              :task="task"
              :time-zone="account.timeZone.value"
              :today="today.date"
              @complete="complete"
              @open="open"
            />
          </div>
        </Panel>

        <!-- Blocked overdue work: outside the main list, collapsed by default. -->
        <Panel v-if="today && today.blocked.length > 0" flush>
          <template #actions>
            <button type="button" class="btn btn-tertiary btn-compact" @click="blockedOpen = !blockedOpen">
              <Icon name="chevron" :size="16" :style="blockedOpen ? 'transform: rotate(90deg)' : ''" />
              {{ today.blocked.length }} blocked
            </button>
          </template>
          <div v-if="blockedOpen" class="list">
            <TaskRow
              v-for="task in today.blocked"
              :key="task.id"
              :task="task"
              :time-zone="account.timeZone.value"
              :today="today.date"
              @complete="complete"
              @open="open"
            />
          </div>
        </Panel>
      </div>

      <div class="section-stack">
        <Panel title="Progress">
          <p class="t-caption">Today</p>
          <p v-if="today" class="t-figure" data-testid="points-today">{{ today.points.today }}</p>
          <p v-else class="t-figure"><Skeleton class="h-7 w-10" /></p>
          <p class="t-label">points</p>
          <p class="t-caption mt-4">This week</p>
          <p v-if="today" class="t-figure">{{ today.points.week }}</p>
          <p v-else class="t-figure"><Skeleton class="h-7 w-10" /></p>
          <p class="t-label">points</p>
          <p class="t-small mt-4">Private to you. No rankings, no streaks, no levels.</p>
          <button type="button" class="btn btn-secondary mt-4 w-full" @click="router.push('/activity')">
            Completion history
          </button>
        </Panel>

        <Panel title="Today's capacity">
          <CapacityMeter v-if="today" :capacity="today.capacity" />
          <div v-else aria-busy="true">
            <Skeleton class="block h-2 w-full" />
            <p class="t-mono mt-2"><Skeleton class="w-1/2" /></p>
          </div>
          <p v-if="today?.capacity.overCapacity" class="t-small mt-3 text-warning">
            More accepted work than working time. Move something, or accept that the day runs long.
          </p>
        </Panel>
      </div>
    </div>
  </div>

  <!-- A parent with incomplete subtasks asks before it completes. -->
  <Modal
    v-if="subtaskPrompt"
    title="This task still has subtasks"
    @close="subtaskPrompt = null"
  >
    <p class="t-body">
      "{{ subtaskPrompt.task.title }}" has {{ subtaskPrompt.remaining }} subtask{{
        subtaskPrompt.remaining === 1 ? "" : "s"
      }}
      left. Completing all of them awards {{ subtaskPrompt.points }} points; completing only the parent awards one.
    </p>
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="subtaskPrompt = null">Cancel</button>
      <button
        type="button"
        class="btn btn-secondary"
        data-testid="leave-subtasks"
        @click="complete(subtaskPrompt!.task, 'leave_active')"
      >
        Leave them active
      </button>
      <button type="button" class="btn btn-primary" @click="complete(subtaskPrompt!.task, 'complete_remaining')">
        Complete all
      </button>
    </template>
  </Modal>

  <Modal v-if="explaining" title="Why this ranking" @close="explaining = null">
    <p class="t-body">{{ explaining.rankRationale ?? "This task has not been ranked yet." }}</p>
    <p class="t-small mt-4">
      Your own priority is separate from the computed rank and always wins when you set one.
    </p>
  </Modal>
</template>
