<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { DeletionPreview, NotificationDefaults, PlacementMode, PlanningSettings } from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Toggle from "../components/Toggle.vue"
import Segmented from "../components/Segmented.vue"
import Feedback from "../components/Feedback.vue"
import Credits from "../components/Credits.vue"
import Modal from "../components/Modal.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage } from "../stores/work.ts"
import { useSession } from "../stores/session.ts"
import { useAccount } from "../stores/account.ts"

/**
 * Settings: capture, notifications, time zone, what goes on the calendar,
 * working hours, theme, and the way out.
 *
 * Every hour Pawalist shows or plans in (working hours, the calendar, Today,
 * reminders) is read in the account's time zone, not the browser's. The zone
 * is set from the device at setup; here it can be changed, and when the
 * device reports a different one (travel, a new laptop) the screen says so
 * and offers to switch in one tap.
 *
 * Deletion is the careful part. The confirmation stays unavailable until the
 * person has downloaded a completed export or said explicitly that they will
 * go without one, and it states the exact credit balance that permanent
 * deletion forfeits.
 */
const router = useRouter()
const { account } = useSession()
const accountStore = useAccount()

const planning = remembered<PlanningSettings | null>("settings.planning", null)
const notifications = remembered<NotificationDefaults | null>("settings.notifications", null)
const deletion = ref<DeletionPreview | null>(null)
const error = ref<string | null>(null)
const acknowledged = ref(false)
const deleteOpen = ref(false)
const confirmEmail = ref("")
const busy = ref(false)
/** Until the settings answer, every field they fill is a skeleton; a failed load stops the pulsing. */
const loading = computed(() => !planning.value && !error.value)

const DETECTED_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const zoneChoice = ref("")
const savingZone = ref(false)
const zoneOptions = computed(() => {
  const listed = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  const current = planning.value?.timeZone
  return [...new Set([...listed, "UTC", DETECTED_ZONE, ...(current ? [current] : [])])].sort()
})
/** "UTC+07:00" beside a zone name, so the list can be scanned by offset as well as by city. */
const offsetOf = (zone: string): string => {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((entry) => entry.type === "timeZoneName")?.value
    return part === "GMT" ? "UTC" : (part?.replace("GMT", "UTC") ?? "")
  } catch {
    return ""
  }
}

const saveZone = async (zone: string): Promise<void> => {
  if (!planning.value || zone === planning.value.timeZone) return
  savingZone.value = true
  error.value = null
  try {
    await api("/account", { method: "PATCH", body: { timeZone: zone } })
    await Promise.all([load(), accountStore.load()])
  } catch (zoneError) {
    error.value = errorMessage(zoneError)
    zoneChoice.value = planning.value.timeZone
  } finally {
    savingZone.value = false
  }
}

const start = ref("09:00")
const end = ref("17:00")
const days = ref<number[]>([1, 2, 3, 4, 5])
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const theme = computed({
  get: () => account.value?.theme ?? "system",
  set: (value: string) => {
    void setTheme(value)
  },
})

/** The form's fields follow the settings they edit, whether just loaded or kept from the last visit. */
const fill = (settings: PlanningSettings): void => {
  zoneChoice.value = settings.timeZone
  if (settings.workingWindows.length > 0) {
    start.value = settings.workingWindows[0]!.start
    end.value = settings.workingWindows[0]!.end
    days.value = [...new Set(settings.workingWindows.map((window) => window.weekday))].sort()
  }
}
if (planning.value) fill(planning.value)

const load = async (): Promise<void> => {
  try {
    // Both leave together; the settings are applied even if the preview fails.
    const preview = api<DeletionPreview>(`/account/deletion?acknowledged=${acknowledged.value}`)
    preview.catch(() => undefined)
    const data = await api<{ planning: PlanningSettings; notifications: NotificationDefaults }>("/planning/settings")
    planning.value = data.planning
    notifications.value = data.notifications
    fill(data.planning)
    deletion.value = await preview
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

const setTheme = async (value: string): Promise<void> => {
  await api("/account", { method: "PATCH", body: { theme: value === "system" ? null : value } })
  if (value === "system") document.documentElement.removeAttribute("data-theme")
  else document.documentElement.setAttribute("data-theme", value)
  if (account.value) account.value = { ...account.value, theme: value === "system" ? null : (value as "dark") }
}

const saveHours = async (): Promise<void> => {
  if (!planning.value) return
  busy.value = true
  try {
    planning.value = await api<PlanningSettings>("/planning/settings", {
      method: "PATCH",
      body: {
        version: planning.value.version,
        workingWindows: days.value.map((weekday) => ({ weekday, start: start.value, end: end.value })),
      },
    })
  } catch (saveError) {
    error.value = errorMessage(saveError)
  } finally {
    busy.value = false
  }
}

/**
 * What the planner may put on a calendar. The default places only work with a
 * stated hour and orders the rest; the other setting lays out the whole week as
 * Pawalist did before the order became the plan.
 */
const PLACEMENT_CHOICES: Array<{ value: PlacementMode; title: string; detail: string }> = [
  {
    value: "fixed_only",
    title: "Only work with a set time",
    detail:
      'Everything else is put in order instead. An appointment, a deadline with an hour on it, or a rule like "every Sunday at 11" gets a place; the rest is a list you work down from the top.',
  },
  {
    value: "everything",
    title: "Lay out the whole week",
    detail:
      "Pawalist estimates how long each task takes and proposes an hour for it. Useful when a week genuinely has to be planned out hour by hour.",
  },
]

const savePlacementMode = async (mode: PlacementMode): Promise<void> => {
  if (!planning.value || planning.value.placementMode === mode) return
  busy.value = true
  try {
    planning.value = await api<PlanningSettings>("/planning/settings", {
      method: "PATCH",
      body: { version: planning.value.version, placementMode: mode },
    })
  } catch (saveError) {
    error.value = errorMessage(saveError)
  } finally {
    busy.value = false
  }
}

const saveNotifications = async (patch: Partial<NotificationDefaults>): Promise<void> => {
  notifications.value = await api<NotificationDefaults>("/planning/notifications", { method: "PATCH", body: patch })
}

const askPermission = async (): Promise<void> => {
  // Permission is asked for only when the person turns notifications on,
  // which is the spec's rule and also the only way a browser will grant it.
  const outcome = await Notification.requestPermission().catch(() => "denied" as NotificationPermission)
  await saveNotifications({ permissionGranted: outcome === "granted" })
}

const acknowledgeWithoutExport = async (): Promise<void> => {
  acknowledged.value = true
  deletion.value = await api<DeletionPreview>("/account/deletion?acknowledged=true")
}

const confirmDelete = async (): Promise<void> => {
  busy.value = true
  try {
    await api(`/account/deletion?acknowledged=${acknowledged.value}`, {
      method: "POST",
      body: { confirmEmail: confirmEmail.value.trim().toLowerCase() },
    })
    window.location.assign("/app/signin")
  } catch (deleteError) {
    error.value = errorMessage(deleteError)
    busy.value = false
  }
}

const toggleDay = (day: number): void => {
  days.value = days.value.includes(day) ? days.value.filter((value) => value !== day) : [...days.value, day].sort()
}
</script>

<template>
  <h1 class="t-screen mb-6 hidden lg:block">Settings</h1>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="section-stack">
    <Panel title="Capture">
      <dl class="datalist">
        <div class="flex justify-between gap-4 border-b border-line px-4 py-2">
          <dt class="t-body flex-none">Keyboard shortcut</dt>
          <dd class="t-mono">Ctrl / Cmd + Shift + K</dd>
        </div>
        <div class="flex justify-between gap-4 border-b border-line px-4 py-2">
          <dt class="t-body flex-none">Add button</dt>
          <dd class="t-body">Every main view</dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-2">
          <dt class="t-body flex-none">Install</dt>
          <dd class="t-body text-right">Add to home screen for a one-tap capture</dd>
        </div>
      </dl>
      <p class="t-small mt-3">
        A platform that cannot give Pawalist a system-wide shortcut keeps the in-app add action, which is always there.
      </p>
    </Panel>

    <!--
      The panels the settings fill are drawn from the first frame with their
      labels; until the settings answer, each value stands as a skeleton where
      the field will be. Hidden until then, they arrived above Appearance and
      the way out and pushed both off the screen.
    -->
    <Panel v-if="notifications || !error" title="Notifications">
      <Toggle
        v-if="notifications"
        :model-value="notifications.permissionGranted"
        label="Reminders"
        hint="Pawalist asks your browser for permission only when you turn this on."
        @update:model-value="askPermission"
      />
      <div v-else class="flex items-start justify-between gap-4 py-2" aria-busy="true">
        <div class="min-w-0">
          <p class="t-body text-ink">Reminders</p>
          <p class="t-small text-ink-muted">Pawalist asks your browser for permission only when you turn this on.</p>
        </div>
        <Skeleton class="mt-0.5 h-5 w-9 flex-none rounded-full" />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="lead">Minutes before a timed block</label>
          <input
            v-if="notifications"
            id="lead"
            type="number"
            min="0"
            max="1440"
            class="input input-mono"
            :value="notifications.timedLeadMinutes"
            @change="saveNotifications({ timedLeadMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
          <span v-else class="input input-mono flex items-center" aria-busy="true"><Skeleton class="w-8" /></span>
        </div>
        <div>
          <label class="field-label" for="allday">Reminder time for tasks without a start time</label>
          <input
            v-if="notifications"
            id="allday"
            type="time"
            class="input input-mono"
            :value="notifications.allDayTime"
            @change="saveNotifications({ allDayTime: ($event.target as HTMLInputElement).value })"
          />
          <span v-else class="input input-mono flex items-center" aria-busy="true"><Skeleton class="w-12" /></span>
          <p class="t-small mt-2">
            When reminders are on, a task planned for Friday with no start time will remind you at this time on Friday.
          </p>
        </div>
      </div>
      <Toggle
        v-if="notifications"
        :model-value="notifications.deadlineReminders"
        label="Deadline reminders"
        hint="Off unless you turn them on. Any task can override this."
        class="mt-4"
        @update:model-value="(value) => saveNotifications({ deadlineReminders: value })"
      />
      <div v-else class="mt-4 flex items-start justify-between gap-4 py-2" aria-busy="true">
        <div class="min-w-0">
          <p class="t-body text-ink">Deadline reminders</p>
          <p class="t-small text-ink-muted">Off unless you turn them on. Any task can override this.</p>
        </div>
        <Skeleton class="mt-0.5 h-5 w-9 flex-none rounded-full" />
      </div>
    </Panel>

    <Panel v-if="planning || !error" title="Time zone">
      <label class="field-label" for="time-zone">Your hours are read in</label>
      <select
        v-if="planning"
        id="time-zone"
        v-model="zoneChoice"
        class="select"
        :disabled="savingZone"
        data-testid="time-zone"
        @change="saveZone(zoneChoice)"
      >
        <option v-for="zone in zoneOptions" :key="zone" :value="zone">
          {{ zone.replaceAll("_", " ") }} ({{ offsetOf(zone) }})
        </option>
      </select>
      <span v-else class="select flex items-center" aria-busy="true"><Skeleton class="w-48" /></span>
      <p class="t-small mt-3">
        Working hours, the calendar, Today and reminders all use this zone.
      </p>
      <Feedback
        v-if="planning && planning.timeZone !== DETECTED_ZONE"
        tone="info"
        title="This device is in a different time zone"
        icon="overdue"
        class="mt-4"
      >
        It reports {{ DETECTED_ZONE.replaceAll("_", " ") }} ({{ offsetOf(DETECTED_ZONE) }}).
        <template #actions>
          <button
            type="button"
            class="btn btn-secondary btn-compact"
            :disabled="savingZone"
            data-testid="use-detected-zone"
            @click="saveZone(DETECTED_ZONE)"
          >
            Use {{ DETECTED_ZONE.replaceAll("_", " ") }}
          </button>
        </template>
      </Feedback>
    </Panel>

    <Panel v-if="planning || !error" title="What goes on the calendar">
      <div class="flex flex-col gap-3" :aria-busy="loading">
        <label
          v-for="option in PLACEMENT_CHOICES"
          :key="option.value"
          class="-mx-2 flex items-start gap-3 px-2"
        >
          <input
            v-if="planning"
            type="radio"
            name="placement-mode"
            class="mt-1 h-4 w-4 flex-none"
            :value="option.value"
            :checked="planning.placementMode === option.value"
            :disabled="busy"
            @change="savePlacementMode(option.value)"
          />
          <Skeleton v-else class="mt-1 h-4 w-4 flex-none rounded-full" />
          <span>
            <span class="t-strong block">{{ option.title }}</span>
            <span class="t-small">{{ option.detail }}</span>
          </span>
        </label>
      </div>
    </Panel>

    <Panel v-if="planning || !error" title="Working hours">
      <p class="t-small mb-3">
        The planner only proposes work inside these, in
        <template v-if="planning">{{ planning.timeZone.replaceAll("_", " ") }}</template>
        <Skeleton v-else class="w-24" />
        time.
      </p>
      <div v-if="planning" class="flex flex-wrap gap-2">
        <button
          v-for="(name, day) in DAY_NAMES"
          :key="day"
          type="button"
          :class="['btn btn-compact', days.includes(day) ? 'btn-secondary' : 'btn-tertiary provisional']"
          :aria-pressed="days.includes(day)"
          @click="toggleDay(day)"
        >
          {{ name }}
        </button>
      </div>
      <div v-else class="flex flex-wrap gap-2" aria-busy="true">
        <Skeleton v-for="name in DAY_NAMES" :key="name" class="h-7 w-12" />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="hours-start">From</label>
          <input v-if="planning" id="hours-start" v-model="start" type="time" class="input input-mono" />
          <span v-else class="input input-mono flex items-center" aria-busy="true"><Skeleton class="w-12" /></span>
        </div>
        <div>
          <label class="field-label" for="hours-end">To</label>
          <input v-if="planning" id="hours-end" v-model="end" type="time" class="input input-mono" />
          <span v-else class="input input-mono flex items-center" aria-busy="true"><Skeleton class="w-12" /></span>
        </div>
      </div>
      <button type="button" class="btn btn-primary mt-4" :disabled="busy || !planning" @click="saveHours">
        Save working hours
      </button>
      <button type="button" class="btn btn-tertiary mt-4 ml-2" @click="router.push('/context')">
        Dated exceptions
      </button>
    </Panel>

    <Panel title="Appearance">
      <Segmented
        v-model="theme"
        :options="[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'Follow the system' },
        ]"
      />
      <p class="t-small mt-3">Pawalist is dark by default. The choice lives on your account, not on this browser.</p>
    </Panel>

    <Panel title="Delete your account">
      <p class="t-body t-prose">
        Deleting signs you out right away, cancels renewal, revokes every credential and MCP connection, and cancels all
        work in flight. Your content survives 30 days: signing in again with the same identity restores it, with your
        purchased credits intact.
      </p>

      <div v-if="!deletion && !error" class="mt-4" aria-busy="true">
        <dl class="datalist">
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">Credits you would forfeit</dt>
            <dd><Skeleton class="w-12" /></dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">API credentials revoked</dt>
            <dd class="t-mono"><Skeleton class="w-4" /></dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">MCP connections revoked</dt>
            <dd class="t-mono"><Skeleton class="w-4" /></dd>
          </div>
          <div class="flex justify-between px-4 py-2">
            <dt class="t-body">Background jobs cancelled</dt>
            <dd class="t-mono"><Skeleton class="w-4" /></dd>
          </div>
        </dl>
        <button type="button" class="btn btn-destructive mt-4" disabled>Delete my account</button>
      </div>

      <div v-else-if="deletion" class="mt-4">
        <dl class="datalist">
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">Credits you would forfeit</dt>
            <dd><Credits :amount="deletion.forfeitedCredits" /></dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">API credentials revoked</dt>
            <dd class="t-mono">{{ deletion.apiCredentials }}</dd>
          </div>
          <div class="flex justify-between border-b border-line px-4 py-2">
            <dt class="t-body">MCP connections revoked</dt>
            <dd class="t-mono">{{ deletion.mcpConnections }}</dd>
          </div>
          <div class="flex justify-between px-4 py-2">
            <dt class="t-body">Background jobs cancelled</dt>
            <dd class="t-mono">{{ deletion.pendingOperations }}</dd>
          </div>
        </dl>

        <Feedback
          v-if="!deletion.exportSatisfied"
          tone="info"
          title="Take a copy first"
          icon="download"
          class="mt-4"
        >
          Deletion stays unavailable until you have downloaded a completed export, or decided to go without one.
          <template #actions>
            <button type="button" class="btn btn-primary" @click="router.push('/export')">Export my data</button>
            <button type="button" class="btn btn-secondary" data-testid="skip-export" @click="acknowledgeWithoutExport">
              Continue without an export
            </button>
          </template>
        </Feedback>

        <button
          type="button"
          class="btn btn-destructive mt-4"
          :disabled="!deletion.exportSatisfied"
          data-testid="open-delete"
          @click="deleteOpen = true"
        >
          Delete my account
        </button>
      </div>
    </Panel>
  </div>

  <Modal v-if="deleteOpen && deletion" title="Delete your account" @close="deleteOpen = false">
    <p class="t-body">
      This forfeits <Credits :amount="deletion.forfeitedCredits" /> without a cash refund, ends your subscription, and
      schedules your content for permanent deletion in {{ deletion.restorationDays }} days.
    </p>
    <label class="field-label mt-4" for="confirm-email">Type {{ account?.email }} to confirm</label>
    <input id="confirm-email" v-model="confirmEmail" class="input input-mono" data-testid="confirm-email" />
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="deleteOpen = false">Keep my account</button>
      <button
        type="button"
        class="btn btn-destructive"
        :disabled="busy || confirmEmail.trim().toLowerCase() !== account?.email.toLowerCase()"
        data-testid="confirm-delete"
        @click="confirmDelete"
      >
        Delete it
      </button>
    </template>
  </Modal>
</template>
