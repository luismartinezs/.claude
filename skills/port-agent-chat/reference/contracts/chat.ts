import { z } from 'zod';
// The runtime/model/effort contract comes from port-agent-runtime. One definition, read by the
// selector in the SPA and by the validation in the API.
import { agentSelectionSchema, agentImageSchema, agentImageMetadataSchema, MAX_AGENT_IMAGES } from './agent.ts';

// What the chat sends and what it shows.

export const MAX_CHAT_MESSAGE_CHARS = 8_000;
/** Enough history for a follow-up question, bounded so a long conversation cannot grow the prompt
 *  until the CLI refuses it. The oldest turns fall off; the app decides whether to say so. */
export const MAX_CHAT_HISTORY_TURNS = 12;

export const chatRoleSchema = z.enum(['operator', 'agent']);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  text: z.string().min(1).max(MAX_CHAT_MESSAGE_CHARS),
  /** Which screen the operator was looking at when they wrote it. Shown in the log so a
   *  conversation read later still makes sense. */
  context: z.string().max(200).optional(),
  // Metadata only. The bytes were sent once, with the question; keeping them in the log would hold
  // every image of a long conversation in memory, and .omit() cannot strip them from the schema that
  // validates them anyway (it carries a refinement).
  images: z.array(agentImageMetadataSchema).max(MAX_AGENT_IMAGES).optional(),
}).strict();
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  /** Which conversation this belongs to. Scoped per screen, record or project, as the app needs. */
  conversationId: z.string().trim().min(1),
  selection: agentSelectionSchema,
  question: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
  history: z.array(chatMessageSchema).max(MAX_CHAT_HISTORY_TURNS),
  images: z.array(agentImageSchema).max(MAX_AGENT_IMAGES).optional(),
}).strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** The agent's answer. ONE STRING, deliberately.
 *
 *  A chat that returns anything the app then acts on is not a chat, it is an unaudited write path.
 *  If the app wants the agent to change something, that is a task with its own schema, its own
 *  validation and its own record of what it did — not a field smuggled through the chat reply. */
export const chatAnswerSchema = z.object({
  answer: z.string().min(1),
}).strict();
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;

export const chatJobSchema = z.object({
  id: z.string().trim().min(1),
  conversationId: z.string().trim().min(1),
  state: z.enum(['running', 'complete', 'failed', 'canceled']),
  selection: agentSelectionSchema,
  answer: z.string().default(''),
  error: z.string().default(''),
  createdAt: z.string(),
}).strict();
export type ChatJob = z.infer<typeof chatJobSchema>;
