<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import type { AgentFocus, Conversation, CostDisclosure, Message, Snippet, UndoReport } from "@pawalist/contracts"
import Badge from "./Badge.vue"
import Credits from "./Credits.vue"
import Feedback from "./Feedback.vue"
import Icon from "./Icon.vue"
import EmptyState from "./EmptyState.vue"
import Skeleton from "./Skeleton.vue"
import { api, isApiError } from "../lib/api.ts"
import { errorMessage, useWork } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"
import { useToast } from "../stores/toast.ts"
import { remembered } from "../stores/remembered.ts"

/**
 * One conversation with the agent: the transcript, its snippets, and the
 * composer. Used full-size on the Agent screen and inside the agent dialog
 * that every other screen opens, which is the same agent with a `focus`: the
 * screen and record the person was looking at, so "this" means something.
 *
 * Chat is a single column of full-width turns rather than bubbles, because a
 * snippet has to sit between text sections as a real control. The composer
 * shows the current balance and the maximum reservation inline, before the
 * request is submitted, which keeps a surprise charge impossible.
 *
 * The agent acts without asking when the request is clear; what makes that
 * safe is the Undo on every turn that changed something.
 *
 * `place` names where this conversation is remembered. The dialog keeps one
 * conversation per focus: opening it on another task starts a new one, so
 * "this" never drifts to what the last conversation was about.
 */
const props = withDefaults(defineProps<{ place: "screen" | "dialog"; focus?: AgentFocus | null }>(), { focus: null })
const emit = defineEmits<{ changed: [] }>()

const router = useRouter()
const account = useAccount()
const work = useWork()
const toast = useToast()

const conversation = remembered<Conversation | null>(`agent.${props.place}.conversation`, null)
const conversationFocus = remembered<string | null>(`agent.${props.place}.focus`, null)
const cost = remembered<CostDisclosure | null>("agent.cost", null)
const draft = ref("")
const sending = ref(false)
const acting = ref<string | null>(null)
const error = ref<string | null>(null)
const shortfall = ref<number | null>(null)
const transcript = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)

const focusKey = computed(() => (props.focus ? `${props.focus.screen}:${props.focus.taskId ?? props.focus.projectId ?? ""}` : null))
const messages = computed(() => conversation.value?.messages ?? [])

const scrollDown = async (): Promise<void> => {
  await nextTick()
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight })
}

const refresh = async (): Promise<void> => {
  if (conversation.value) conversation.value = await api<Conversation>(`/agent/conversations/${conversation.value.id}`)
}

const start = async (): Promise<void> => {
  const created = await api<{ id: string }>("/agent/conversations", { method: "POST" })
  conversation.value = await api<Conversation>(`/agent/conversations/${created.id}`)
  conversationFocus.value = focusKey.value
}

const loadCost = async (): Promise<void> => {
  cost.value = await api<CostDisclosure>("/agent/cost?kind=chat")
}

const openConversation = async (): Promise<void> => {
  if (props.place === "dialog") {
    // Same thing on screen: carry on. Anything else: a fresh conversation.
    if (conversation.value && conversationFocus.value === focusKey.value && conversation.value.state === "open") {
      await refresh()
    } else {
      await start()
    }
    return
  }
  const list = await api<{ items: Array<{ id: string; state: string; origin: string }> }>("/agent/conversations")
  const open = list.items.find((item) => item.state === "open" && item.origin === "interface")
  if (open) conversation.value = await api<Conversation>(`/agent/conversations/${open.id}`)
  else await start()
}

onMounted(async () => {
  // The conversation from the last visit is on screen before either answer.
  if (conversation.value) await scrollDown()
  if (props.place === "dialog") composer.value?.focus()
  try {
    await Promise.all([loadCost(), openConversation()])
    await scrollDown()
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
})

const changedSomething = (message: Message | undefined): boolean =>
  message !== undefined && (message.undoable || message.recordLinks.length > 0)

const send = async (): Promise<void> => {
  if (sending.value || draft.value.trim() === "" || !conversation.value) return
  const text = draft.value.trim()
  const id = conversation.value.id
  sending.value = true
  error.value = null
  shortfall.value = null

  // The person's turn appears immediately; only the agent's answer waits.
  conversation.value = {
    ...conversation.value,
    messages: [
      ...conversation.value.messages,
      {
        id: `local-${Date.now()}`,
        role: "user",
        text,
        snippets: [],
        recordLinks: [],
        operationId: null,
        creditCharge: null,
        undoable: false,
        undoneAt: null,
        createdAt: new Date().toISOString(),
      } satisfies Message,
    ],
  }
  draft.value = ""
  await scrollDown()

  try {
    const answer = await api<{ message: Message }>(`/agent/conversations/${id}/messages`, {
      method: "POST",
      body: { text, focus: props.focus },
    })
    conversation.value = await api<Conversation>(`/agent/conversations/${id}`)
    await Promise.all([loadCost(), account.load()])
    await scrollDown()
    if (changedSomething(answer.message)) emit("changed")
  } catch (sendError) {
    if (isApiError(sendError) && sendError.error === "insufficient_credits") {
      shortfall.value = sendError.shortfall ?? null
    }
    error.value = errorMessage(sendError)
    // The optimistic turn is dropped, so the transcript never shows a message
    // the agent never received.
    conversation.value = await api<Conversation>(`/agent/conversations/${id}`)
  } finally {
    sending.value = false
  }
}

const undo = async (message: Message): Promise<void> => {
  acting.value = message.id
  try {
    const { report } = await api<{ report: UndoReport }>(`/agent/messages/${message.id}/undo`, { method: "POST" })
    await refresh()
    emit("changed")
    toast.show(
      report.kept.length === 0
        ? { tone: "success", title: "Undone", detail: `${report.undone.length} change${report.undone.length === 1 ? "" : "s"} reversed.` }
        : { tone: "warning", title: "Partly undone", detail: report.kept.join(". ") },
    )
  } catch (undoError) {
    error.value = errorMessage(undoError)
  } finally {
    acting.value = null
  }
}

/** A snippet action: the same validated operation the equivalent control runs. */
const runSnippetAction = async (_snippet: Snippet, actionId: string): Promise<void> => {
  const [kind, id] = actionId.split(":")
  if (!id) return
  acting.value = actionId
  try {
    if (kind === "complete") {
      const task = await work.findTask(id)
      await work.act(id, "complete", task.version, { subtasks: "leave_active" })
      emit("changed")
    }
    if (kind === "go" || kind === "drop") {
      await api(`/agent/messages/${id}/held/${kind === "go" ? "run" : "drop"}`, { method: "POST" })
      if (kind === "go") emit("changed")
    }
    if (kind === "approve") {
      await api(`/agent/challenges/${id}/approve`, { method: "POST" })
    }
    await refresh()
    await scrollDown()
  } catch (actionError) {
    error.value = errorMessage(actionError)
  } finally {
    acting.value = null
  }
}

const openRecord = (link: { kind: string; id: string }): void => {
  void router.push(link.kind === "task" ? `/tasks/${link.id}` : link.kind === "memory" ? "/memory" : "/projects")
}

const onKeydown = (event: KeyboardEvent): void => {
  // In the dialog, Enter sends and Shift+Enter breaks the line, as in any
  // chat; the full screen keeps Cmd/Ctrl+Enter for longer messages.
  if (props.place === "dialog" && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send()
}

defineExpose({ start })
</script>

<template>
  <Feedback v-if="shortfall !== null" tone="warning" title="Not enough credits for this request" icon="credits" class="mb-4">
    You need <Credits :amount="shortfall" /> more. A top-up releases this and anything else queued, oldest first.
    <template #actions>
      <button type="button" class="btn btn-primary" @click="router.push('/billing')">Top up</button>
    </template>
  </Feedback>

  <Feedback v-else-if="error" tone="error" title="That did not go through" icon="overdue" class="mb-4">
    {{ error }}
  </Feedback>

  <!--
    At phone widths the transcript is sized so the panel, composer included,
    fits between the top bar and the add action without the page scrolling
    too: at 60dvh the page and the transcript both scrolled, and the Send
    button sat under the add action until the page was scrolled to its end.
  -->
  <div
    ref="transcript"
    :class="[
      'space-y-6 overflow-y-auto',
      place === 'dialog' ? 'max-h-[45dvh] pb-4' : 'max-h-[max(10rem,calc(100dvh-22rem))] p-4 lg:max-h-[60dvh]',
    ]"
    data-testid="agent-transcript"
  >
    <!-- The conversation is being found or started: its turns are not "nothing yet". -->
    <div v-if="!conversation && !error" class="space-y-6" aria-busy="true" data-testid="agent-skeleton">
      <div class="turn-user ml-auto w-2/3"><Skeleton class="w-full" /></div>
      <div class="space-y-2">
        <Skeleton class="block w-4/5" />
        <Skeleton class="block w-3/5" />
      </div>
    </div>
    <EmptyState
      v-else-if="messages.length === 0"
      :message="
        place === 'dialog'
          ? 'Tell Pawalist what happened or what you want. It can see what is on this screen, and anything it changes can be undone.'
          : 'Ask for anything you could do by hand. The agent reads before it answers and names what it changed.'
      "
    />

    <div v-for="message in messages" :key="message.id">
      <div v-if="message.role === 'user'" class="turn-user t-body">{{ message.text }}</div>

      <div v-else class="turn-agent space-y-3" data-testid="agent-turn">
        <p class="t-body whitespace-pre-wrap">{{ message.text }}</p>

        <!-- Snippets are bordered panels inset in the turn, never bubbles. -->
        <div v-for="snippet in message.snippets" :key="snippet.id" class="snippet">
          <p class="t-label mb-2">{{ snippet.label }}</p>

          <div v-if="snippet.stale">
            <div class="feedback feedback-warning">
              <Icon name="overdue" :size="16" />
              <div>
                <p class="feedback-title">One of these records changed</p>
                <p class="t-small mt-1">Refresh to act on what is there now.</p>
              </div>
            </div>
          </div>

          <template v-else>
            <pre class="t-small whitespace-pre-wrap">{{ snippet.textEquivalent }}</pre>
            <div v-if="snippet.actions.length > 0" class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="action in snippet.actions"
                :key="action.id"
                type="button"
                :disabled="acting !== null"
                :data-testid="`snippet-${action.id.split(':')[0]}`"
                :class="[
                  'btn btn-compact',
                  action.style === 'primary'
                    ? 'btn-primary'
                    : action.style === 'destructive'
                      ? 'btn-destructive'
                      : 'btn-secondary provisional',
                ]"
                @click="runSnippetAction(snippet, action.id)"
              >
                {{ action.label }}
              </button>
              <a
                v-if="snippet.kind === 'confirmation' && typeof snippet.data.approvalUrl === 'string'"
                :href="String(snippet.data.approvalUrl)"
                class="btn btn-secondary btn-compact"
              >
                <Icon name="external" :size="16" /> Open the approval page
              </a>
            </div>
          </template>
        </div>

        <div v-if="message.recordLinks.length > 0" class="flex flex-wrap gap-2">
          <!-- The chip is drawn at its contract 20px; the button around it is
               the 28px a thumb needs. The chip clips its own text, so the
               extra reach cannot live on the chip itself. -->
          <button
            v-for="link in message.recordLinks"
            :key="link.id"
            type="button"
            class="max-w-full py-1"
            @click="openRecord(link)"
          >
            <span class="chip">{{ link.title }}</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="message.undoable"
            type="button"
            class="btn btn-secondary btn-compact"
            data-testid="agent-undo"
            :disabled="acting !== null"
            @click="undo(message)"
          >
            <span v-if="acting === message.id" class="btn-spinner" aria-hidden="true" />
            Undo
          </button>
          <span v-else-if="message.undoneAt" class="t-caption">Undone</span>
          <p v-if="message.creditCharge !== null" class="t-caption">
            This turn cost <Credits :amount="message.creditCharge" />. Agent.
          </p>
        </div>
      </div>
    </div>

    <div v-if="sending" class="turn-agent">
      <Badge tone="running" dot>Working</Badge>
    </div>
  </div>

  <div :class="place === 'dialog' ? 'composer -mx-4 -mb-4' : 'composer'">
    <!-- Beside the box it disables, not over the conversation: it arrives with
         the cost answer, and above the transcript it pushed the conversation down. -->
    <Feedback
      v-if="cost && !cost.aiAvailable"
      tone="info"
      title="Talking to the agent needs the monthly plan"
      icon="agent"
      class="mb-3"
    >
      Everything you do by hand stays free. The agent, automatic planning, the paid API and MCP are what the plan unlocks.
      <template #actions>
        <button type="button" class="btn btn-primary" @click="router.push('/billing')">See the plan</button>
      </template>
    </Feedback>
    <!-- The inline disclosure, before the request is submitted. -->
    <div v-if="!cost" class="mb-2 flex flex-wrap items-center gap-3">
      <span class="t-caption"><Skeleton class="h-2.5 w-24" /></span>
      <span class="t-caption"><Skeleton class="h-2.5 w-48" /></span>
    </div>
    <div v-else class="mb-2 flex flex-wrap items-center gap-3">
      <span class="t-caption">
        Balance <Credits :amount="cost.availableCredits" />
      </span>
      <span class="t-caption">
        This request reserves up to <Credits :amount="cost.maxReservation" />
      </span>
      <span v-if="cost.shortfall !== null" class="badge badge-warning">
        Short by <Credits :amount="cost.shortfall" />
      </span>
    </div>

    <div class="flex gap-2">
      <textarea
        ref="composer"
        v-model="draft"
        class="textarea"
        rows="2"
        :placeholder="place === 'dialog' ? 'What happened, or what should change?' : 'Ask for anything you could do by hand.'"
        data-testid="agent-input"
        :disabled="cost?.aiAvailable === false"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="btn btn-primary self-end"
        :disabled="sending || draft.trim() === '' || cost?.aiAvailable === false"
        data-testid="agent-send"
        @click="send"
      >
        <span v-if="sending" class="btn-spinner" aria-hidden="true" />
        Send
      </button>
    </div>
  </div>
</template>
