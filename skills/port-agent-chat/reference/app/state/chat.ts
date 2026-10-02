import { reactive, ref } from 'vue';
import { chatAnswerSchema, type ChatMessage } from '../../contracts/chat.ts';
import { defaultAgentSelection, type AgentSelection } from '../../contracts/agent.ts';
import { cancelChat, readChat, startChat } from '../api/chat.ts';

// The chat's client half. One conversation per key; nothing of it is saved, because it explains the
// app rather than being part of it.
//
// If an app does want a conversation kept, keep it somewhere that is clearly NOT a domain record.
// An agent's sentence about an event is not evidence about that event, and storing it next to one
// invites a later reader to treat it as if it were.

export const chatOpen = ref(false);
export const chatError = ref('');
/** Which agent answers, until the page is reloaded. */
export const chatSelection = ref<AgentSelection>(defaultAgentSelection());
export const conversations = reactive<Record<string, ChatMessage[]>>({});
/** The answer being waited for, and which conversation it belongs to. */
export const pending = ref<null | { conversationId: string; jobId: string }>(null);

const POLL_MS = 500;
/** A wait this long means something is wrong that polling will not fix. The task's own timeout is
 *  shorter; this is only the client giving up on a server that stopped answering. */
const MAX_WAIT_MS = 300_000;

export const conversationOf = (conversationId: string): ChatMessage[] => conversations[conversationId] ?? [];

const waitForAnswer = async (conversationId: string, jobId: string): Promise<string | null> => {
  const start = Date.now();
  for (;;) {
    // The operator pressed Stop, or asked in another conversation. Either way this poll is no
    // longer the one anybody is waiting for.
    if (pending.value?.jobId !== jobId) return null;
    if (Date.now() - start > MAX_WAIT_MS) throw new Error('The agent stopped responding. Ask again.');
    const job = await readChat(jobId);
    if (!job) throw new Error('The server restarted before the agent answered. Ask again.');
    if (job.state === 'running') {
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
      continue;
    }
    if (job.state === 'canceled') return null;
    if (job.state === 'failed') throw new Error(job.error || 'The agent could not answer.');
    return chatAnswerSchema.parse({ answer: job.answer }).answer;
  }
};

export const ask = async (conversationId: string, context: string, question: string): Promise<void> => {
  const text = question.trim();
  if (!text || pending.value) return;
  chatError.value = '';
  const history = conversationOf(conversationId);
  // The question goes into the log before the request is sent, so the operator sees what they asked
  // even if the request fails.
  conversations[conversationId] = [...history, { role: 'operator', text, context }];
  try {
    const jobId = await startChat({
      conversationId,
      selection: chatSelection.value,
      question: text,
      history,
    });
    pending.value = { conversationId, jobId };
    const answer = await waitForAnswer(conversationId, jobId);
    if (answer) {
      conversations[conversationId] = [...conversationOf(conversationId), { role: 'agent', text: answer }];
    }
  } catch (error) {
    // SHOWN, never swallowed. A chat that silently does nothing is indistinguishable from one that
    // is slow, and the operator's next move is to ask again, which spends the subscription twice.
    chatError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (pending.value?.conversationId === conversationId) pending.value = null;
  }
};

export const stop = async (): Promise<void> => {
  const current = pending.value;
  if (!current) return;
  // Cleared first: the poll loop reads this and stops, so the UI is responsive whether or not the
  // cancel request itself succeeds.
  pending.value = null;
  await cancelChat(current.jobId).catch(() => undefined);
};

export const clearConversation = (conversationId: string): void => {
  delete conversations[conversationId];
  chatError.value = '';
};
