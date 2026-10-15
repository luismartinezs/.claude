<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import Icon from "./components/Icon.vue"
import type { IconName } from "./components/Icon.vue"
import type { AgentFocus, Attention } from "@pawalist/contracts"
import QuickAdd from "./components/QuickAdd.vue"
import Modal from "./components/Modal.vue"
import Credits from "./components/Credits.vue"
import Skeleton from "./components/Skeleton.vue"
import ScreenSkeleton from "./components/ScreenSkeleton.vue"
import { lastCaptureAccountId, useSession } from "./stores/session.ts"
import { useAccount } from "./stores/account.ts"
import { useToast } from "./stores/toast.ts"
import { useWork } from "./stores/work.ts"
import { useQuickAddDraft } from "./stores/quickAdd.ts"
import { api, onSignedOut } from "./lib/api.ts"
import { forgetRemembered } from "./stores/remembered.ts"
import { onCaptureSynced, syncCaptures } from "./lib/captureOutbox.ts"

const AgentChat = defineAsyncComponent(() => import("./components/AgentChat.vue"))
const TaskForm = defineAsyncComponent(() => import("./components/TaskForm.vue"))

/**
 * The shell. Two layouts share one content grammar, switched at 900px: a
 * bottom tab bar with five destinations at narrow widths, a 240px sidebar at
 * wide ones, and the global add action present on every main view either way.
 *
 * The add action opens Quick Add straight away: a menu in front of it cost a
 * second tap on the one action that has to take two seconds. The full form
 * stays one button away in the sidebar, and on every project.
 *
 * Beside it, on every screen but the Agent screen itself, is the agent
 * button. It opens the agent in a dialog that knows what is on screen (the
 * focus), so the person says what happened with "this" task and the agent
 * does the rearranging. When the agent changes something, the screen behind
 * is drawn again from the server, so it never shows records that moved.
 *
 * The shell draws on the first frame, before the session is checked: every
 * control stands where it will stay, Quick Add works at once, and what is not
 * known yet (the account, the screen) is a skeleton until it arrives.
 */
const route = useRoute()
const router = useRouter()
const { account, loaded, unavailable, load, pendingLoginToken, redirectError, signOut } = useSession()
const accountStore = useAccount()
const work = useWork()
const toast = useToast()

const quickAddDraft = useQuickAddDraft()
const moreOpen = ref(false)
const quickAddOpen = ref(false)
const captureRoute = computed(() => route.name === "capture")
const openQuickAdd = (): void => {
  performance.mark("pawalist.capture.open_requested")
  quickAddOpen.value = true
}
const taskFormOpen = ref(false)
const agentOpen = ref(false)
/** Bumped when the agent changed something, so the screen behind reloads what it shows. */
const viewRevision = ref(0)

/** What the person is looking at, named for the agent; the server reads the records itself. */
const agentFocus = computed<AgentFocus>(() => {
  const screen = String(route.name ?? "today")
  const id = typeof route.params.id === "string" ? route.params.id : null
  return {
    screen,
    taskId: screen === "task" ? id : null,
    projectId: screen === "project" ? id : null,
  }
})
const agentAvailable = computed(() => route.name !== "agent" && route.name !== "setup" && route.name !== "approve")

const TABS: ReadonlyArray<{ to: string; label: string; icon: IconName }> = [
  { to: "/", label: "Today", icon: "today" },
  { to: "/upcoming", label: "Upcoming", icon: "upcoming" },
  { to: "/inbox", label: "Inbox", icon: "inbox" },
  { to: "/projects", label: "Projects", icon: "projects" },
  { to: "/agent", label: "Agent", icon: "agent" },
]

const SECONDARY: ReadonlyArray<{ to: string; label: string; icon: IconName }> = [
  { to: "/search", label: "Search", icon: "search" },
  { to: "/clarifications", label: "Clarifications", icon: "overdue" },
  { to: "/context", label: "Agent context", icon: "memory" },
  { to: "/billing", label: "Billing and credits", icon: "credits" },
  { to: "/developer", label: "Developer access", icon: "key" },
  { to: "/export", label: "Export data", icon: "download" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/trash", label: "Trash", icon: "trash" },
  { to: "/settings", label: "Settings", icon: "settings" },
]

/**
 * What waits on the person, as a dot beside Inbox and Clarifications. It is
 * read again on every screen change, which is when someone would look at the
 * navigation, and after a capture is saved.
 */
const attention = ref<Attention>({ inbox: 0, clarifications: 0 })
const loadAttention = async (): Promise<void> => {
  if (!account.value) return
  try {
    attention.value = await api<Attention>("/captures/attention")
  } catch {
    // A missing dot is not worth an error on every screen.
  }
}
const needsYou = (to: string): boolean =>
  (to === "/inbox" && attention.value.inbox > 0) || (to === "/clarifications" && attention.value.clarifications > 0)
watch(() => [route.fullPath, account.value?.id], () => void loadAttention(), { immediate: true })

const isActive = (to: string): boolean => (to === "/" ? route.path === "/" : route.path.startsWith(to))

/**
 * The name of the screen, for the narrow top bar the contract says holds it.
 *
 * Each view draws its own `title.screen` at wide widths and hides it at narrow
 * ones, where the bar is the only place a title fits. The bar used to read
 * "Pawalist" on all nineteen of them, which told nobody where they were.
 */
const SCREEN_TITLES: Record<string, string> = {
  today: "Today",
  upcoming: "Upcoming",
  inbox: "Inbox",
  search: "Search",
  clarifications: "Clarifications",
  projects: "Projects",
  project: "Project",
  task: "Task",
  series: "Recurring task",
  trash: "Trash",
  agent: "Pawalist Agent",
  context: "Agent context",
  memory: "Outcome and memory",
  billing: "Billing and credits",
  developer: "Developer access",
  export: "Export data",
  activity: "Activity and operations",
  settings: "Settings",
  setup: "Set up Pawalist",
  approve: "Confirm this change",
}

const screenTitle = computed(() => SCREEN_TITLES[String(route.name ?? "")] ?? "Pawalist")

// A destination chosen from the top-bar menu closes it, including the one that
// re-enters the screen it was opened from.
watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
  },
)

/**
 * Signed out, anywhere but the sign-in screen, goes to the sign-in screen: a
 * session that ended (or never began) used to leave the person on a view whose
 * every request answered "Sign in to continue", with no way to.
 */
onSignedOut(() => {
  account.value = null
})
const AFTER_SIGN_IN = "pawalist.after-sign-in"
watch(
  () => [loaded.value, account.value === null, route.name] as const,
  ([ready, signedOut, name]) => {
    if (!ready || !signedOut || unavailable.value || name === "signin" || name === "capture") return
    // Where they were going comes back after sign-in: an approval link opened
    // while signed out must still end on that approval.
    try {
      if (route.fullPath !== "/") sessionStorage.setItem(AFTER_SIGN_IN, route.fullPath)
    } catch {
      // Without storage they land on Today, which is still better than stuck.
    }
    void router.replace("/signin")
  },
  { immediate: true },
)
const takeAfterSignIn = (): string | null => {
  try {
    const path = sessionStorage.getItem(AFTER_SIGN_IN)
    sessionStorage.removeItem(AFTER_SIGN_IN)
    return path
  } catch {
    return null
  }
}

/** Quick Add stays two actions away, so the shortcut works from every screen. */
const onKeydown = (event: KeyboardEvent): void => {
  const target = event.target as HTMLElement | null
  const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
  if (typing) return
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault()
    openQuickAdd()
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j" && agentAvailable.value) {
    event.preventDefault()
    agentOpen.value = true
  }
}

onMounted(async () => {
  document.addEventListener("keydown", onKeydown)
  window.addEventListener("online", retryCaptures)
  document.addEventListener("visibilitychange", retryWhenVisible)
  await load()
  if ((pendingLoginToken.value || redirectError.value) && route.name !== "signin") await router.replace("/signin")
})
const retryCaptures = (): void => {
  if (unavailable.value) {
    quickAddOpen.value = true
    void load().then(() => { if (account.value) void syncCaptures(account.value.id) })
  } else if (account.value) void syncCaptures(account.value.id)
}
const retryWhenVisible = (): void => { if (document.visibilityState === "visible") retryCaptures() }
const stopCaptureSync = onCaptureSynced(() => {
  toast.show({ tone: "success", title: "Saved to Inbox", detail: "Pawalist will sort it out in the background." })
  void work.loadInbox().catch(() => undefined)
  void loadAttention()
})
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown)
  window.removeEventListener("online", retryCaptures)
  document.removeEventListener("visibilitychange", retryWhenVisible)
  stopCaptureSync()
})

watch(
  () => [loaded.value, account.value?.id] as const,
  async ([ready, id]) => {
    if (!ready) return
    accountStore.reset()
    if (!id) return
    await accountStore.load().catch(() => undefined)
    // Applying the saved theme here keeps the choice on the account rather
    // than in one browser's storage.
    //
    // Someone signing in for the first time goes to Setup, which is where the
    // working hours the planner needs are set. It was reachable only by typing
    // its address, so every new account landed on a Today that said "no
    // working hours on this day" and offered nowhere to fix it. Setup can be
    // skipped, and is never shown twice.
    if (route.name === "signin") {
      await router.replace(accountStore.onboarded.value ? (takeAfterSignIn() ?? "/") : "/setup")
    }
  },
)

/**
 * Screens keep what they last showed, so an account that signs out, or gives
 * way to another, takes its records with it. The first sign-in of the page is
 * not a change, and clearing then would race the first screen's own load.
 */
watch(
  () => account.value?.id,
  (id, previous) => {
    if (previous === undefined || id === previous) return
    forgetRemembered()
    work.reset()
  },
)

/** A confirmed account starts any captures saved on this device. */
watch(() => account.value?.id, (id) => { if (id) void syncCaptures(id) })

watch(
  () => account.value?.theme,
  (theme) => {
    if (theme) document.documentElement.setAttribute("data-theme", theme)
    else document.documentElement.removeAttribute("data-theme")
  },
  { immediate: true },
)

const signedIn = computed(() => account.value !== null)

/**
 * Whether to draw the shell before the server has said who this is. A device
 * that has been signed in before almost always still is, so it gets the shell
 * straight away, offline included. A device that never signed in, or a launch
 * that is plainly headed for the sign-in screen, would only see the shell
 * flash and vanish, so it waits for the answer instead.
 */
const shellExpected =
  lastCaptureAccountId() !== null &&
  pendingLoginToken.value === null &&
  redirectError.value === null &&
  !window.location.pathname.startsWith("/app/signin")
const showShell = computed(() => signedIn.value || (shellExpected && (!loaded.value || unavailable.value)))
/** The shell is up but nobody is signed in yet: account-bound parts are skeletons. */
const pending = computed(() => !signedIn.value)

const leave = async (): Promise<void> => {
  quickAddDraft.clear()
  await signOut()
  window.location.assign("/app/signin")
}

const onCaptureQueued = (): void => {
  toast.show({ tone: "info", title: "Saved on this device", detail: "Pawalist is syncing the capture to Inbox." })
}
const closeQuickAdd = (): void => {
  quickAddOpen.value = false
  if (captureRoute.value) void router.replace("/")
}
const openFullForm = (): void => {
  if (!account.value) {
    void router.push("/signin")
    return
  }
  quickAddOpen.value = false
  if (captureRoute.value) void router.replace("/")
  taskFormOpen.value = true
}
</script>

<template>
  <template v-if="showShell">
    <!-- Wide: a 240px sidebar carrying the same five destinations plus secondary ones. -->
    <nav class="sidebar hidden lg:flex lg:flex-col" aria-label="Pawalist">
      <a href="/" class="t-screen mb-4 block px-2 text-ink">Pawalist</a>
      <button type="button" class="btn btn-primary w-full" data-testid="global-add-wide" @click="openQuickAdd">
        <Icon name="plus" :size="20" /> Add
      </button>
      <button
        type="button"
        class="btn btn-tertiary mt-1 w-full"
        data-testid="new-task-wide"
        :disabled="pending"
        @click="taskFormOpen = true"
      >
        New task
      </button>
      <button
        type="button"
        class="btn btn-secondary mt-1 mb-4 w-full"
        data-testid="agent-open-wide"
        :disabled="pending || !agentAvailable"
        @click="agentOpen = true"
      >
        <Icon name="agent" :size="20" /> Ask Pawalist
      </button>

      <RouterLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        :class="['nav-row', isActive(tab.to) ? 'is-active' : '']"
      >
        <Icon :name="tab.icon" :size="20" />
        {{ tab.label }}
        <i v-if="needsYou(tab.to)" class="nav-dot" :data-testid="`nav-dot-${tab.label.toLowerCase()}`" aria-label="Needs you" />
      </RouterLink>

      <p class="t-caption mt-6 px-2">More</p>
      <RouterLink
        v-for="link in SECONDARY"
        :key="link.to"
        :to="link.to"
        :class="['nav-row', isActive(link.to) ? 'is-active' : '']"
      >
        <Icon :name="link.icon" :size="20" />
        {{ link.label }}
        <i v-if="needsYou(link.to)" class="nav-dot" aria-label="Needs you" />
      </RouterLink>

      <div class="mt-auto border-t border-line pt-4">
        <p v-if="account" class="t-caption px-2">{{ account.email }}</p>
        <p v-else class="t-caption px-2"><Skeleton class="h-2.5 w-36" /></p>
        <p v-if="accountStore.summary.value" class="px-2 pt-1">
          <Credits :amount="accountStore.credits.value" />
          <span class="t-caption"> available</span>
        </p>
        <p v-else class="px-2 pt-1"><Skeleton class="w-24" /></p>
        <button type="button" class="btn btn-tertiary mt-2 w-full justify-start" :disabled="pending" @click="leave">Sign out</button>
      </div>
    </nav>

    <!-- Narrow: a 52px sticky top bar holding the screen title and one action. -->
    <header class="topbar lg:hidden">
      <p v-if="route.matched.length > 0" class="t-section truncate text-ink" data-testid="screen-title">{{ screenTitle }}</p>
      <Skeleton v-else class="h-4 w-28" />
      <button
        type="button"
        class="btn btn-tertiary btn-compact"
        aria-label="More"
        :aria-expanded="moreOpen"
        data-testid="open-more"
        @click="moreOpen = !moreOpen"
      >
        <span class="relative inline-flex">
          <Icon name="more" :size="20" />
          <i v-if="attention.clarifications > 0" class="nav-dot nav-dot-corner" aria-label="Needs you" />
        </span>
      </button>
    </header>

    <!--
      The secondary destinations, the balance and sign-out, at phone widths.

      They lived only in the wide sidebar, so on a 360px screen seven of the
      nineteen screens had no route to them at all and there was no way to sign
      out. The tab bar carries five destinations and the contract allows the
      top bar two actions, so the rest sit behind one of them, in the same
      dropdown recipe the add action already uses.
    -->
    <template v-if="moreOpen">
      <div class="scrim lg:hidden" @click="moreOpen = false" />
      <div class="menu more-menu lg:hidden" data-testid="more-menu">
        <RouterLink
          v-for="link in SECONDARY"
          :key="link.to"
          :to="link.to"
          :class="isActive(link.to) ? 'is-active' : ''"
          @click="moreOpen = false"
        >
          <Icon :name="link.icon" :size="20" />
          {{ link.label }}
          <i v-if="needsYou(link.to)" class="nav-dot ml-auto" aria-label="Needs you" />
        </RouterLink>
        <div class="mt-2 border-t border-line px-2 pt-2">
          <p v-if="account" class="t-caption truncate">{{ account.email }}</p>
          <p v-else class="t-caption"><Skeleton class="h-2.5 w-36" /></p>
          <p v-if="accountStore.summary.value" class="pt-1">
            <Credits :amount="accountStore.credits.value" />
            <span class="t-caption"> available</span>
          </p>
          <p v-else class="pt-1"><Skeleton class="w-24" /></p>
        </div>
        <button type="button" class="mt-2" data-testid="sign-out-narrow" :disabled="pending" @click="leave">Sign out</button>
      </div>
    </template>

    <!--
      A screen mounts once someone is signed in and its code has arrived; until
      then its place holds a skeleton. Screens fetch as they mount, so mounting
      one before the session is known would fetch as nobody.
    -->
    <main class="shell-content" data-testid="app-shell" :aria-busy="pending">
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component && !pending" :key="viewRevision" />
        <ScreenSkeleton v-else />
      </RouterView>
    </main>

    <!-- The global add action at narrow widths: one tap, straight into Quick Add. -->
    <button
      type="button"
      class="add-fab lg:hidden"
      aria-label="Quick Add"
      data-testid="global-add"
      @click="openQuickAdd"
    >
      <Icon name="plus" :size="24" />
    </button>

    <!-- The agent, one tap from every screen, beside the add action. -->
    <button
      v-if="agentAvailable"
      type="button"
      class="agent-fab lg:hidden"
      aria-label="Ask Pawalist"
      data-testid="agent-open"
      :disabled="pending"
      @click="agentOpen = true"
    >
      <Icon name="agent" :size="24" />
    </button>

    <nav class="tabbar lg:hidden" aria-label="Pawalist">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        :class="['tabbar-item', isActive(tab.to) ? 'is-active' : '']"
      >
        <span class="relative inline-flex">
          <Icon :name="tab.icon" :size="20" />
          <i v-if="needsYou(tab.to)" class="nav-dot nav-dot-corner" aria-label="Needs you" />
        </span>
        {{ tab.label }}
      </RouterLink>
    </nav>

    <Modal v-if="agentOpen" title="Pawalist Agent" wide @close="agentOpen = false">
      <AgentChat place="dialog" :focus="agentFocus" @changed="viewRevision++" />
    </Modal>
    <TaskForm
      v-if="taskFormOpen"
      :projects="work.projects.value"
      @close="taskFormOpen = false"
      @saved="work.loadToday().catch(() => undefined)"
    />

    <div v-if="toast.current.value" :class="`toast feedback-${toast.current.value.tone}`" role="status">
      <p class="feedback-title">{{ toast.current.value.title }}</p>
      <p v-if="toast.current.value.detail" class="t-small mt-1">{{ toast.current.value.detail }}</p>
      <div class="mt-3 flex justify-end gap-2">
        <button
          v-if="toast.current.value.action"
          type="button"
          class="btn btn-secondary btn-compact"
          data-testid="toast-action"
          @click="
            () => {
              void toast.current.value?.action?.run()
              toast.dismiss()
            }
          "
        >
          {{ toast.current.value.action.label }}
        </button>
        <button type="button" class="btn btn-tertiary btn-compact" @click="toast.dismiss()">Dismiss</button>
      </div>
    </div>
  </template>

  <!-- No shell expected: an empty canvas until the server answers, or Quick Add alone offline. -->
  <div v-else-if="!loaded || captureRoute || unavailable" class="min-h-dvh" />

  <RouterView v-else />

  <QuickAdd
    v-if="quickAddOpen || captureRoute || (unavailable && !signedIn)"
    @close="closeQuickAdd"
    @queued="onCaptureQueued"
    @full-form="openFullForm"
  />
</template>
