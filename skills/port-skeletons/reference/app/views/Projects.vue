<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { Project } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import EmptyState from "../components/EmptyState.vue"
import Feedback from "../components/Feedback.vue"
import Modal from "../components/Modal.vue"
import Icon from "../components/Icon.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { errorMessage, useWork } from "../stores/work.ts"

/**
 * Projects and labels. Archiving changes navigation only: an archived
 * project's tasks keep their state, their placements, their reminders and
 * their eligibility for Today, which is why archiving is not a destructive
 * action and deleting is.
 */
const router = useRouter()
const work = useWork()

const error = ref<string | null>(null)
const showArchived = ref(false)
const creating = ref(false)
const newName = ref("")
const renaming = ref<Project | null>(null)
const renameValue = ref("")
const deleting = ref<Project | null>(null)
const mergeSource = ref<string | null>(null)

const active = computed(() => work.projects.value.filter((project) => !project.archived))
const archived = computed(() => work.projects.value.filter((project) => project.archived))

const load = async (): Promise<void> => {
  try {
    await Promise.all([work.loadProjects(true), work.loadLabels()])
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

const create = async (): Promise<void> => {
  if (newName.value.trim() === "") return
  try {
    await api("/work/projects", { method: "POST", body: { name: newName.value.trim() } })
    newName.value = ""
    creating.value = false
    await load()
  } catch (createError) {
    error.value = errorMessage(createError)
  }
}

const setArchived = async (project: Project, archivedNext: boolean): Promise<void> => {
  try {
    await api(`/work/projects/${project.id}`, {
      method: "PATCH",
      body: { version: project.version, archived: archivedNext },
    })
    await load()
  } catch (archiveError) {
    error.value = errorMessage(archiveError)
  }
}

const rename = async (): Promise<void> => {
  if (!renaming.value || renameValue.value.trim() === "") return
  try {
    await api(`/work/projects/${renaming.value.id}`, {
      method: "PATCH",
      body: { version: renaming.value.version, name: renameValue.value.trim() },
    })
    renaming.value = null
    await load()
  } catch (renameError) {
    error.value = errorMessage(renameError)
  }
}

const remove = async (): Promise<void> => {
  if (!deleting.value) return
  try {
    await api(`/work/projects/${deleting.value.id}`, { method: "DELETE" })
    deleting.value = null
    await load()
  } catch (deleteError) {
    error.value = errorMessage(deleteError)
    deleting.value = null
  }
}

const renameLabel = async (id: string, name: string): Promise<void> => {
  try {
    await api(`/work/labels/${id}`, { method: "PATCH", body: { name } })
    await work.loadLabels()
  } catch (labelError) {
    error.value = errorMessage(labelError)
  }
}

const mergeInto = async (targetId: string): Promise<void> => {
  if (!mergeSource.value || mergeSource.value === targetId) return
  try {
    await api(`/work/labels/${mergeSource.value}/merge`, { method: "POST", body: { into: targetId } })
    mergeSource.value = null
    await work.loadLabels()
  } catch (mergeError) {
    error.value = errorMessage(mergeError)
  }
}

const deleteLabel = async (id: string): Promise<void> => {
  try {
    await api(`/work/labels/${id}`, { method: "DELETE" })
    await work.loadLabels()
  } catch (labelError) {
    error.value = errorMessage(labelError)
  }
}
</script>

<template>
  <div class="mb-6 hidden items-center justify-between lg:flex">
    <h1 class="t-screen">Projects</h1>
    <button type="button" class="btn btn-secondary" @click="creating = true">New project</button>
  </div>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="section-stack">
    <Panel title="Active projects" flush>
      <template #actions>
        <button type="button" class="btn btn-tertiary btn-compact lg:hidden" @click="creating = true">New</button>
      </template>

      <div v-if="active.length > 0" class="list" data-testid="project-list">
        <!--
          The three actions wrap under the name when the row cannot hold both:
          at 360px they took every pixel and left the name one letter wide. The
          name is a 28px target reaching 4px into the row's padding, which
          still leaves 4px to the actions when they wrap beneath it.
        -->
        <div v-for="project in active" :key="project.id" class="row flex-wrap">
          <span class="chip-dot" :style="{ background: `var(--color-project-${project.colorIndex})` }" />
          <button
            type="button"
            class="-my-1 flex min-h-7 min-w-40 flex-1 items-center text-left"
            @click="router.push(`/projects/${project.id}`)"
          >
            <span class="row-title">{{ project.name }}</span>
          </button>
          <span class="t-mono text-ink-muted">{{ project.openTaskCount }}</span>
          <div class="ml-auto flex gap-2">
            <button
              type="button"
              class="btn btn-tertiary btn-compact"
              @click="((renaming = project), (renameValue = project.name))"
            >
              Rename
            </button>
            <button type="button" class="btn btn-tertiary btn-compact" @click="setArchived(project, true)">
              Archive
            </button>
            <button type="button" class="btn btn-destructive btn-compact" @click="deleting = project">Delete</button>
          </div>
        </div>
      </div>

      <div v-else-if="!work.loaded.value.projects && !error" class="list" aria-busy="true">
        <div v-for="width in ['w-40', 'w-28', 'w-52']" :key="width" class="row flex-wrap">
          <Skeleton class="h-1.5 w-1.5 flex-none rounded-full" />
          <span class="flex min-h-7 min-w-40 flex-1 items-center"><Skeleton :class="width" /></span>
          <div class="ml-auto flex gap-2">
            <Skeleton v-for="action in 3" :key="action" class="h-7 w-16" />
          </div>
        </div>
      </div>

      <EmptyState v-else message="No projects yet. Triage makes one when work clearly belongs to a named effort.">
        <button type="button" class="btn btn-secondary" @click="creating = true">New project</button>
      </EmptyState>
    </Panel>

    <Panel v-if="archived.length > 0" title="Archived" flush>
      <template #actions>
        <button type="button" class="btn btn-tertiary btn-compact" @click="showArchived = !showArchived">
          <Icon name="chevron" :size="16" :style="showArchived ? 'transform: rotate(90deg)' : ''" />
          {{ archived.length }}
        </button>
      </template>
      <div v-if="showArchived" class="list">
        <div v-for="project in archived" :key="project.id" class="row">
          <span class="chip-dot" :style="{ background: `var(--color-project-${project.colorIndex})` }" />
          <span class="row-title flex-1">{{ project.name }}</span>
          <span class="badge">Archived</span>
          <button type="button" class="btn btn-tertiary btn-compact" @click="setArchived(project, false)">
            Restore
          </button>
        </div>
      </div>
      <p v-else class="panel-body t-small">
        Archived projects keep every task exactly as it was, including its place in Today.
      </p>
    </Panel>

    <Panel title="Labels" flush>
      <div v-if="work.labels.value.length > 0" class="list">
        <div v-for="label in work.labels.value" :key="label.id" class="row">
          <input
            class="input input-mono flex-1"
            :value="label.name"
            @change="renameLabel(label.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="t-mono text-ink-muted">{{ label.taskCount }}</span>
          <button
            v-if="mergeSource === null"
            type="button"
            class="btn btn-tertiary btn-compact"
            @click="mergeSource = label.id"
          >
            Merge
          </button>
          <button
            v-else-if="mergeSource !== label.id"
            type="button"
            class="btn btn-secondary btn-compact"
            @click="mergeInto(label.id)"
          >
            Merge into this
          </button>
          <button v-else type="button" class="btn btn-tertiary btn-compact" @click="mergeSource = null">Cancel</button>
          <button type="button" class="btn btn-destructive btn-compact" @click="deleteLabel(label.id)">Delete</button>
        </div>
      </div>
      <div v-else-if="!work.loaded.value.labels && !error" class="list" aria-busy="true">
        <div v-for="width in ['w-32', 'w-24']" :key="width" class="row">
          <span class="input flex flex-1 items-center"><Skeleton :class="width" /></span>
          <Skeleton class="h-7 w-16" />
          <Skeleton class="h-7 w-16" />
        </div>
      </div>
      <EmptyState v-else message="No labels yet. Triage reuses yours before inventing one." />
    </Panel>
  </div>

  <Modal v-if="creating" title="New project" @close="creating = false">
    <label class="field-label" for="project-name">Name</label>
    <input
      id="project-name"
      v-model="newName"
      class="input"
      data-testid="project-name"
      @keydown.enter="create"
    />
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="creating = false">Cancel</button>
      <button type="button" class="btn btn-primary" data-testid="project-create" @click="create">Create</button>
    </template>
  </Modal>

  <Modal v-if="renaming" title="Rename project" @close="renaming = null">
    <input v-model="renameValue" class="input" @keydown.enter="rename" />
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="renaming = null">Cancel</button>
      <button type="button" class="btn btn-primary" @click="rename">Save</button>
    </template>
  </Modal>

  <Modal v-if="deleting" title="Delete project" @close="deleting = null">
    <p class="t-body">
      Deleting "{{ deleting.name }}" is permanent. Pawalist refuses while it still holds active tasks, so move, trash or
      delete those first.
    </p>
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="deleting = null">Cancel</button>
      <button type="button" class="btn btn-destructive" @click="remove">Delete it</button>
    </template>
  </Modal>
</template>
