<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { Task } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Feedback from "../components/Feedback.vue"
import EmptyState from "../components/EmptyState.vue"
import Modal from "../components/Modal.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage, useWork } from "../stores/work.ts"

/**
 * The global trash: everything recoverable, with why it went there and when it
 * goes for good. Restoring returns a task to Open, because entering the trash
 * cancelled its future placements.
 */
const router = useRouter()
const work = useWork()

/** Null until the first answer, so a trash that has not loaded is not drawn as an empty one. */
const items = remembered<Task[] | null>("trash.items", null)
const error = ref<string | null>(null)
const purging = ref<Task | null>(null)

const load = async (): Promise<void> => {
  try {
    items.value = (await api<{ items: Task[] }>("/work/trash")).items
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

const restore = async (task: Task): Promise<void> => {
  try {
    await work.act(task.id, "restore", task.version)
    await load()
  } catch (restoreError) {
    error.value = errorMessage(restoreError)
  }
}

const purge = async (): Promise<void> => {
  if (!purging.value) return
  try {
    await api(`/work/tasks/${purging.value.id}`, { method: "DELETE" })
    purging.value = null
    await load()
  } catch (purgeError) {
    error.value = errorMessage(purgeError)
  }
}
</script>

<template>
  <h1 class="t-screen mb-6 hidden lg:block">Trash</h1>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <Panel title="Recoverable" flush>
    <template #actions>
      <span v-if="items" class="t-caption">{{ items.length }} item{{ items.length === 1 ? "" : "s" }}</span>
      <span v-else class="t-caption"><Skeleton class="h-2.5 w-12" /></span>
    </template>

    <div v-if="items && items.length > 0" class="list" data-testid="trash-list">
      <div v-for="task in items" :key="task.id" data-stage="trashed" class="row flex-col !items-stretch">
        <div class="flex items-start gap-3">
          <p class="row-title min-w-0 flex-1">{{ task.title }}</p>
          <span class="t-mono text-ink-muted">{{ task.purgeAfter?.slice(0, 10) }}</span>
        </div>
        <p class="t-small mt-1">{{ task.trashReason ?? "Moved to the trash" }}</p>
        <p class="t-caption">Deleted {{ task.trashedAt?.slice(0, 10) }}. Gone for good on {{ task.purgeAfter?.slice(0, 10) }}.</p>
        <div class="mt-2 flex gap-2">
          <button type="button" class="btn btn-secondary btn-compact" data-testid="restore-task" @click="restore(task)">
            Restore
          </button>
          <button type="button" class="btn btn-destructive btn-compact" @click="purging = task">Delete for good</button>
        </div>
      </div>
    </div>

    <div v-else-if="!items && !error" class="list" aria-busy="true">
      <div v-for="width in ['w-3/5', 'w-2/5', 'w-1/2']" :key="width" class="row flex-col !items-stretch">
        <div class="flex items-start gap-3">
          <p class="row-title min-w-0 flex-1"><Skeleton :class="width" /></p>
          <span class="t-mono"><Skeleton class="w-20" /></span>
        </div>
        <p class="t-small mt-1"><Skeleton class="w-32" /></p>
        <p class="t-caption"><Skeleton class="w-64 max-w-full" /></p>
        <div class="mt-2 flex gap-2">
          <Skeleton class="h-7 w-20" />
          <Skeleton class="h-7 w-28" />
        </div>
      </div>
    </div>

    <EmptyState v-else message="The trash is empty. Anything you or triage discards waits here for 30 days.">
      <button type="button" class="btn btn-secondary" @click="router.push('/projects')">Open projects</button>
    </EmptyState>
  </Panel>

  <Modal v-if="purging" title="Delete for good" @close="purging = null">
    <p class="t-body">
      "{{ purging.title }}" would be gone permanently. There is no undo after this.
    </p>
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="purging = null">Keep it</button>
      <button type="button" class="btn btn-destructive" @click="purge">Delete permanently</button>
    </template>
  </Modal>
</template>
