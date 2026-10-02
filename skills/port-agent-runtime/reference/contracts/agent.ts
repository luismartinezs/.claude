import { z } from 'zod';
import frozenAgentSelection from './agent-selection.json' with { type: 'json' };

// The selection an agent request runs with, validated against the frozen capability table.
//
// WHY A FROZEN JSON FILE AND NOT CONSTANTS IN THIS FILE: the table is a measurement taken against
// installed CLIs on a dated box (see its `source` block), and it is shared by copy between
// repositories rather than by a package. Keeping it as data means a copy can be diffed against its
// origin, and the hash in `source` says which measurement this copy inherited. Keeping it as
// TypeScript would turn a fact into code and lose that.

export const agentRuntimeSchema = z.enum(['claude-code', 'codex']);
export type AgentRuntime = z.infer<typeof agentRuntimeSchema>;

const labelListSchema = z.array(z.string().trim().min(1)).min(1);
const runtimeLabelsSchema = z.object({ models: labelListSchema, efforts: labelListSchema }).strict();

export const agentSelectionContractSchema = z.object({
  note: z.string().optional(),
  source: z.object({
    repository: z.string().trim().min(1),
    path: z.string().trim().min(1),
    commit: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    measured: z.string().trim().min(1),
    proof: z.string().trim().min(1).optional(),
  }).strict(),
  runtimes: z.object({
    codex: runtimeLabelsSchema,
    'claude-code': runtimeLabelsSchema,
  }).strict(),
  nativeModels: z.record(z.string().trim().min(1), z.string().trim().min(1)),
  capabilityOrder: z.object({
    note: z.string().optional(),
    codex: runtimeLabelsSchema,
    'claude-code': runtimeLabelsSchema,
  }).strict(),
  default: z.object({
    runtime: agentRuntimeSchema,
    model: z.string().trim().min(1),
    effort: z.string().trim().min(1),
  }).strict(),
  fallbackOrder: z.array(agentRuntimeSchema).min(1),
}).strict().superRefine((contract, context) => {
  for (const runtime of agentRuntimeSchema.options) {
    const labels = contract.runtimes[runtime];
    const order = contract.capabilityOrder[runtime];
    if (new Set(labels.models).size !== labels.models.length) {
      context.addIssue({ code: 'custom', path: ['runtimes', runtime, 'models'], message: 'Model labels must be unique.' });
    }
    if (new Set(labels.efforts).size !== labels.efforts.length) {
      context.addIssue({ code: 'custom', path: ['runtimes', runtime, 'efforts'], message: 'Effort labels must be unique.' });
    }
    // An order that is missing a label silently sorts it weakest, so every floor comparison against
    // it would be wrong in the direction that spends less and answers worse.
    for (const field of ['models', 'efforts'] as const) {
      const missing = labels[field].filter(label => !order[field].includes(label));
      if (missing.length) {
        context.addIssue({
          code: 'custom',
          path: ['capabilityOrder', runtime, field],
          message: `Every accepted label must appear in the order: ${missing.join(', ')} missing.`,
        });
      }
    }
  }
  const codexModels = contract.runtimes.codex.models;
  const nativeKeys = Object.keys(contract.nativeModels);
  if (nativeKeys.length !== codexModels.length || nativeKeys.some(model => !codexModels.includes(model))) {
    context.addIssue({ code: 'custom', path: ['nativeModels'], message: 'Every Codex label must have exactly one native model name.' });
  }
  const defaults = contract.runtimes[contract.default.runtime];
  if (!defaults.models.includes(contract.default.model) || !defaults.efforts.includes(contract.default.effort)) {
    context.addIssue({ code: 'custom', path: ['default'], message: 'The default must be an allowed selection.' });
  }
  if (new Set(contract.fallbackOrder).size !== contract.fallbackOrder.length) {
    context.addIssue({ code: 'custom', path: ['fallbackOrder'], message: 'A runtime may appear once in the fallback order.' });
  }
});

// Parsed at module load: a malformed table fails the process at boot rather than one request later.
export const agentSelectionContract = agentSelectionContractSchema.parse(frozenAgentSelection);

export const agentSelectionSchema = z.object({
  runtime: agentRuntimeSchema,
  model: z.string().trim().min(1),
  effort: z.string().trim().min(1),
}).strict().superRefine((selection, context) => {
  const supported = agentSelectionContract.runtimes[selection.runtime];
  if (!supported.models.includes(selection.model)) {
    context.addIssue({ code: 'custom', path: ['model'], message: `${selection.model} is not supported by ${selection.runtime}.` });
  }
  if (!supported.efforts.includes(selection.effort)) {
    context.addIssue({ code: 'custom', path: ['effort'], message: `${selection.effort} is not supported by ${selection.runtime}.` });
  }
});
export type AgentSelection = z.infer<typeof agentSelectionSchema>;

/** The one gate between a request and a command line. Everything that builds argv calls it. */
export const validateAgentSelection = (selection: unknown): AgentSelection => agentSelectionSchema.parse(selection);

export const defaultAgentSelection = (): AgentSelection =>
  agentSelectionSchema.parse(agentSelectionContract.default);

export const describeSelection = (selection: AgentSelection): string =>
  `${selection.runtime === 'codex' ? 'Codex' : 'Claude Code'} ${selection.model} at ${selection.effort}`;

/** An unknown label sits at -1 and so never clears a floor, which is the safe way to read it. */
export const atLeast = (order: readonly string[], chosen: string, floor: string): string =>
  order.indexOf(chosen) >= order.indexOf(floor) ? chosen : floor;

/** Raise a selection to a floor for a task that needs a stronger model than the operator picked.
 *  A manual selection is a floor, not a ceiling: at or above it is kept, below it is raised. */
export const raisedToFloor = (selection: AgentSelection, floor: { model: string; effort: string }): AgentSelection => {
  const order = agentSelectionContract.capabilityOrder[selection.runtime];
  const preferred = {
    runtime: selection.runtime,
    model: atLeast(order.models, selection.model, floor.model),
    effort: atLeast(order.efforts, selection.effort, floor.effort),
  };
  return agentSelectionSchema.safeParse(preferred).success ? preferred : selection;
};

// ---------------------------------------------------------------------------
// Images. Only port this half if the app sends images to the agent.
// ---------------------------------------------------------------------------

export const MAX_AGENT_IMAGES = 6;
export const MAX_AGENT_IMAGE_BYTES = 5 * 1024 * 1024;
const agentImageMediaTypeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export type AgentImageMediaType = z.infer<typeof agentImageMediaTypeSchema>;

export const agentImageMetadataSchema = z.object({
  id: z.string().trim().min(1),
  inputId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  mediaType: agentImageMediaTypeSchema,
  size: z.number().int().positive().max(MAX_AGENT_IMAGE_BYTES),
}).strict();

const decodedAgentImage = (value: string): Uint8Array | null => {
  try { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); } catch { return null; }
};

/** THE BYTES DECIDE THE TYPE, never the browser's claim and never the file name. A declared
 *  image/png that is not one reaches the CLI as whatever it actually is. */
export const inspectImageBytes = (bytes: Uint8Array): AgentImageMediaType | null => {
  const starts = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image/gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
};

export const agentImageSchema = agentImageMetadataSchema
  .extend({ bytes: z.string().min(1) })
  .strict()
  .superRefine((image, context) => {
    const bytes = decodedAgentImage(image.bytes);
    if (!bytes || bytes.length !== image.size || inspectImageBytes(bytes) !== image.mediaType) {
      context.addIssue({ code: 'custom', path: ['bytes'], message: 'Image bytes must match the validated size and media type.' });
    }
  });
export type AgentImage = z.infer<typeof agentImageSchema>;
