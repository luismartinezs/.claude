// Excerpt from Pawalist's apps/app/src/stores/work.ts: the "which lists have
// answered" pattern for server state shared by several screens. Screens that
// own their data use `null` until the first answer instead (see
// views/Upcoming.vue `openTasks`, views/Trash.vue `items`).

import { ref } from "vue"

const projects = ref<Project[]>([])
const captures = ref<Capture[]>([])

/**
 * Which lists have had an answer from the server since the account was
 * known. An empty list that has not loaded is not "nothing here": a screen
 * draws skeletons until its list is in this set, then the list or its empty
 * state.
 */
const loaded = ref({ projects: false, inbox: false })

export const useWork = () => {
  const loadProjects = async (): Promise<void> => {
    projects.value = (await api<{ items: Project[] }>("/work/projects")).items
    loaded.value = { ...loaded.value, projects: true }
  }

  const loadInbox = async (): Promise<void> => {
    captures.value = (await api<{ items: Capture[] }>("/captures")).items
    loaded.value = { ...loaded.value, inbox: true }
  }

  /** Drops every record held, when the signed-in account changes. */
  const reset = (): void => {
    projects.value = []
    captures.value = []
    loaded.value = { projects: false, inbox: false }
  }

  return { loaded, projects, captures, loadProjects, loadInbox, reset }
}

// In a screen:
//
//   <div v-if="captures.length > 0" class="list">…rows…</div>
//   <div v-else-if="!work.loaded.value.inbox && !error" class="list" aria-busy="true">…skeleton rows…</div>
//   <EmptyState v-else message="Nothing in the inbox." />
