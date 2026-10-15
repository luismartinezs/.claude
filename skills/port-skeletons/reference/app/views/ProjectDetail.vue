<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { TASK_STATE_LABELS, type Task, type TaskState } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import TaskRow from "../components/TaskRow.vue"
import Segmented from "../components/Segmented.vue"
import EmptyState from "../components/EmptyState.vue"
import Feedback from "../components/Feedback.vue"
import TaskForm from "../components/TaskForm.vue"
import Icon from "../components/Icon.vue"
import Skeleton from "../components/Skeleton.vue"
import SkeletonRows from "../components/SkeletonRows.vue"
import { api } from "../lib/api.ts"
import { todayIn } from "../lib/format.ts"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { useToast } from "../stores/toast.ts"
import { remembered } from "../stores/remembered.ts"

/**
 * One project, as a list or a Kanban board.
 *
 * The board shows Open, Planned and In progress by default; Needs
 * clarification and Completed are optional columns the person turns on, and
 * the choice is remembered on the project. Inbox and Trashed are never columns
 * here, because both have their own dedicated view.
 */
const route = useRoute()
const router = useRouter()
const work = useWork()
const account = useAccount()
const toast = useToast()

const DEFAULT_COLUMNS: TaskState[] = ["open", "planned", "in_progress"]
const OPTIONAL_COLUMNS: TaskState[] = ["needs_clarification", "completed"]

const error = ref<string | null>(null)
const showCompleted = ref(false)
const formOpen = ref(false)

const projectId = computed(() => route.params.id as string)
const project = computed(() => work.projects.value.find((candidate) => candidate.id === projectId.value) ?? null)
const layout = computed(() => project.value?.layout ?? "list")
const columns = computed<TaskState[]>(() => (project.value?.kanbanColumns as TaskState[] | undefined) ?? DEFAULT_COLUMNS)

/**
 * Each project's tasks are kept under its own id rather than in the store's one
 * task list, which the task screen's dependency picker also fills: opening a
 * project shows its own tasks from the last visit, never another project's,
 * and a slow answer for the project just left cannot land on this one.
 */
const tasksByProject = remembered<Record<string, Task[]>>("project.tasks", {})
/** Null until this project's first answer, so a list that has not loaded is not drawn as an empty one. */
const tasks = computed<Task[] | null>(() => tasksByProject.value[projectId.value] ?? null)

const load = async (): Promise<void> => {
  const id = projectId.value
  const states: TaskState[] = showCompleted.value
    ? ["open", "planned", "in_progress", "needs_clarification", "completed"]
    : ["open", "planned", "in_progress", "needs_clarification"]
  try {
    const [, list] = await Promise.all([
      work.loadProjects(true),
      api<{ items: Task[] }>(`/work/tasks?${new URLSearchParams({ projectId: id, state: states.join(",") }).toString()}`),
    ])
    tasksByProject.value = { ...tasksByProject.value, [id]: list.items }
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)
watch([projectId, showCompleted], load)

const setLayout = async (next: string): Promise<void> => {
  if (!project.value) return
  await api(`/work/projects/${project.value.id}`, {
    method: "PATCH",
    body: { version: project.value.version, layout: next },
  })
  await work.loadProjects(true)
}

const toggleColumn = async (state: TaskState, on: boolean): Promise<void> => {
  if (!project.value) return
  const next = on ? [...columns.value, state] : columns.value.filter((column) => column !== state)
  await api(`/work/projects/${project.value.id}`, {
    method: "PATCH",
    body: { version: project.value.version, kanbanColumns: next },
  })
  await work.loadProjects(true)
}

/**
 * Folded columns, remembered per project on this device: a person who never
 * looks at Planned on a phone should not scroll past it every time.
 */
const collapsedKey = computed(() => `pawalist.board-collapsed.${projectId.value}`)
const readCollapsed = (): TaskState[] => {
  try {
    return JSON.parse(localStorage.getItem(collapsedKey.value) ?? "[]") as TaskState[]
  } catch {
    return []
  }
}
const collapsed = ref<TaskState[]>(readCollapsed())
watch(collapsedKey, () => {
  collapsed.value = readCollapsed()
})
const toggleCollapsed = (state: TaskState): void => {
  collapsed.value = collapsed.value.includes(state)
    ? collapsed.value.filter((entry) => entry !== state)
    : [...collapsed.value, state]
  try {
    localStorage.setItem(collapsedKey.value, JSON.stringify(collapsed.value))
  } catch {
    // Without storage the fold still works for this visit.
  }
}

const inColumn = (state: TaskState): Task[] => (tasks.value ?? []).filter((task) => task.state === state)

const complete = async (task: Task): Promise<void> => {
  try {
    const outcome = await work.act(task.id, "complete", task.version, { subtasks: "leave_active" })
    const points = "kind" in outcome && outcome.kind === "completed" ? outcome.points : 1
    toast.show({ tone: "success", title: `Completed. ${points} point${points === 1 ? "" : "s"}.` })
    await load()
  } catch (actError) {
    error.value = errorMessage(actError)
  }
}

/** The board's accessible state change, which is also the only one on touch. */
const moveTo = async (task: Task, state: TaskState): Promise<void> => {
  try {
    if (state === "in_progress") await work.act(task.id, "start", task.version)
    else if (task.state === "in_progress") await work.act(task.id, "stop", task.version)
    await load()
  } catch (moveError) {
    error.value = errorMessage(moveError)
  }
}
</script>

<template>
  <!--
    At a desk the name wraps inside its own column and the controls stay at the
    right: a long name used to push them onto the next line the moment it
    arrived, so they jumped from beside the skeleton to below the title.
  -->
  <div class="mb-6 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap lg:items-start">
    <h1 v-if="project || tasks || error" class="t-screen lg:min-w-0 lg:flex-1">{{ project?.name ?? "Project" }}</h1>
    <h1 v-else class="t-screen lg:min-w-0 lg:flex-1"><Skeleton class="w-48" /></h1>
    <div class="flex shrink-0 items-center gap-2">
      <Segmented
        :model-value="layout"
        :options="[
          { value: 'list', label: 'List' },
          { value: 'kanban', label: 'Board' },
        ]"
        @update:model-value="setLayout"
      />
      <button type="button" class="btn btn-secondary" data-testid="project-new-task" @click="formOpen = true">
        New task
      </button>
    </div>
  </div>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <!-- Each label is the target, 32px tall and reaching past its box: the 16px
       checkboxes were the whole target before, and a thumb missed them. -->
  <div class="mb-4 flex flex-wrap items-center gap-x-4">
    <label class="-ml-2 flex min-h-8 items-center gap-2 pl-2">
      <input v-model="showCompleted" type="checkbox" class="h-4 w-4" />
      <span class="t-label">Show completed</span>
    </label>
    <template v-if="layout === 'kanban'">
      <label v-for="state in OPTIONAL_COLUMNS" :key="state" class="-ml-2 flex min-h-8 items-center gap-2 pl-2">
        <input
          type="checkbox"
          class="h-4 w-4"
          :checked="columns.includes(state)"
          @change="toggleColumn(state, ($event.target as HTMLInputElement).checked)"
        />
        <span class="t-label">{{ TASK_STATE_LABELS[state] }} column</span>
      </label>
    </template>
  </div>

  <Panel v-if="layout === 'list'" title="Tasks" flush>
    <div v-if="tasks && tasks.length > 0" class="list" data-testid="project-tasks">
      <TaskRow
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :time-zone="account.timeZone.value"
        :today="work.today.value?.date ?? todayIn(account.timeZone.value)"
        show-state
        @complete="complete"
        @open="router.push(`/tasks/${task.id}`)"
      />
    </div>
    <SkeletonRows v-else-if="!tasks && !error" />
    <EmptyState v-else message="Nothing in this project yet.">
      <button type="button" class="btn btn-secondary" @click="formOpen = true">New task</button>
    </EmptyState>
  </Panel>

  <!--
    On a phone the columns stack, one under the other, and each title folds its
    column away. Wide, the board scrolls horizontally with a visible track
    rather than clipping.
  -->
  <div v-else class="lg:well lg:overflow-x-auto lg:p-3" data-bleed>
    <div class="flex flex-col lg:flex-row lg:gap-3" data-bleed>
      <div v-for="state in columns" :key="state" class="-mt-px w-full first:mt-0 lg:mt-0 lg:w-[288px] lg:flex-none" data-bleed>
        <section class="panel">
          <button
            type="button"
            class="panel-head w-full text-left"
            :aria-expanded="!collapsed.includes(state)"
            :data-testid="`board-toggle-${state}`"
            @click="toggleCollapsed(state)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Icon name="chevron" :size="16" :class="collapsed.includes(state) ? '' : 'rotate-90'" />
              <span class="t-section truncate">{{ TASK_STATE_LABELS[state] }}</span>
            </span>
            <span v-if="tasks" class="t-mono-sm">{{ inColumn(state).length }}</span>
            <span v-else class="t-mono-sm"><Skeleton class="h-2.5 w-4" /></span>
          </button>
          <template v-if="!collapsed.includes(state)">
          <div class="list">
            <div v-for="task in inColumn(state)" :key="task.id">
              <TaskRow
                :task="task"
                :time-zone="account.timeZone.value"
                :today="work.today.value?.date ?? todayIn(account.timeZone.value)"
                :expandable="false"
                @complete="complete"
                @open="router.push(`/tasks/${task.id}`)"
              />
              <!-- 4px clear of the row above, whose title is a full-height target. -->
              <div class="flex gap-1 px-3 pt-1 pb-2">
                <button
                  v-for="target in columns.filter((column) => column !== state && column !== 'completed')"
                  :key="target"
                  type="button"
                  class="btn btn-tertiary btn-compact"
                  :aria-label="`Move ${task.title} to ${TASK_STATE_LABELS[target]}`"
                  @click="moveTo(task, target)"
                >
                  → {{ TASK_STATE_LABELS[target] }}
                </button>
              </div>
            </div>
          </div>
          <SkeletonRows v-if="!tasks && !error" :count="2" />
          <div v-else-if="inColumn(state).length === 0" class="empty">
            <p>Nothing here.</p>
          </div>
          </template>
        </section>
      </div>
    </div>
  </div>

  <TaskForm
    v-if="formOpen"
    :projects="work.projects.value"
    :preset-project-id="projectId"
    @close="formOpen = false"
    @saved="load"
  />
</template>
