<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AgentSelectors from './AgentSelectors.vue';
import Markdown from './Markdown.vue';
import {
  ask,
  chatError,
  chatOpen,
  chatSelection,
  clearConversation,
  conversationOf,
  pending,
  stop,
} from './state/chat.ts';

// A button in the corner of a screen that opens a chat. The agent is told which screen the operator
// is on, so "what does this mean?" needs no further explanation.
//
// NO STYLES IN THIS FILE, deliberately. Every class below resolves against the app's own stylesheet,
// which is how the same component looks like four different products in four different repositories.
// Port the structure and the behaviour; write the CSS in the app.
const props = defineProps<{
  /** Scopes the conversation. One per screen, record or project, as the app needs. */
  conversationId: string;
  /** Where the operator is, in words a person would use. Shown, and sent as context. */
  context: string;
  /** What the empty state says this chat is good for. Product copy, so the app supplies it. */
  invitation?: string;
}>();

const draft = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const log = ref<HTMLElement | null>(null);

const messages = computed(() => conversationOf(props.conversationId));
const waiting = computed(() => pending.value?.conversationId === props.conversationId);

// A new answer is read from its first line, so the log shows where it starts rather than where it
// ends. Scrolling to the bottom of a long answer puts the operator at the conclusion of something
// they have not read yet.
const scrollToLatest = async (): Promise<void> => {
  await nextTick();
  const element = log.value;
  if (!element) return;
  const latest = element.querySelector<HTMLElement>('.chat-message:last-of-type');
  const top = latest?.dataset.role === 'agent' && !waiting.value ? latest.offsetTop - 16 : element.scrollHeight;
  element.scrollTo({ top });
};

watch(() => [messages.value.length, waiting.value], () => void scrollToLatest());

const open = async (): Promise<void> => {
  chatOpen.value = true;
  await nextTick();
  input.value?.focus();
  void scrollToLatest();
};

const send = async (): Promise<void> => {
  const text = draft.value.trim();
  if (!text || pending.value) return;
  // Cleared before the await, so a slow request cannot have the operator typing into a box that is
  // about to be emptied under them.
  draft.value = '';
  await ask(props.conversationId, props.context, text);
  input.value?.focus();
};

// Enter sends, as in any chat; Shift+Enter starts a new line. isComposing matters for every input
// method that composes characters, where Enter commits the character rather than the message.
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  void send();
};
</script>

<template>
  <button
    v-if="!chatOpen"
    type="button"
    class="chat-launcher"
    aria-controls="chat-panel"
    :aria-expanded="false"
    @click="open"
  >
    Ask the agent
  </button>

  <section
    v-else
    id="chat-panel"
    class="chat-panel"
    aria-label="Ask the agent about this screen"
    @keydown.esc="chatOpen = false"
  >
    <header class="chat-header">
      <div>
        <h2>Ask the agent</h2>
        <p class="chat-context" :title="context">Looking at: {{ context }}</p>
      </div>
      <button
        v-if="messages.length && !waiting"
        type="button"
        class="chat-new"
        @click="clearConversation(conversationId)"
      >
        New
      </button>
      <button type="button" class="chat-close" aria-label="Close" @click="chatOpen = false">&times;</button>
    </header>

    <div class="chat-agent">
      <AgentSelectors v-model="chatSelection" />
    </div>

    <div ref="log" class="chat-log" aria-live="polite">
      <p v-if="!messages.length" class="chat-empty">
        {{ invitation ?? 'Ask about anything on this screen. The agent reads what you are looking at and changes nothing.' }}
      </p>
      <article
        v-for="(message, index) in messages"
        :key="index"
        class="chat-message"
        :data-role="message.role"
      >
        <!-- The operator's own words are interpolated. The agent's go through Markdown, which
             renders a tree of components: never v-html, on either side. -->
        <p v-if="message.role === 'operator'">{{ message.text }}</p>
        <Markdown v-else :text="message.text" />
      </article>
      <p v-if="waiting" class="chat-waiting" role="status">
        <span class="chat-dot" aria-hidden="true"></span>The agent is reading the screen.
      </p>
      <p v-if="chatError" class="chat-error" role="alert">{{ chatError }}</p>
    </div>

    <form class="chat-form" @submit.prevent="send">
      <textarea
        ref="input"
        aria-label="Your question"
        v-model="draft"
        rows="2"
        placeholder="What would you like explained?"
        :disabled="waiting"
        @keydown="onKeydown"
      ></textarea>
      <button v-if="waiting" type="button" @click="stop">Stop</button>
      <button v-else type="submit" :disabled="!draft.trim()">Ask</button>
    </form>
  </section>
</template>
