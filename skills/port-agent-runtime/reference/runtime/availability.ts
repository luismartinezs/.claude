import {
  agentSelectionContract,
  agentSelectionSchema,
  type AgentRuntime,
  type AgentSelection,
} from '../contracts/agent.ts';

// Which failures mean "this runtime cannot answer right now" and which mean "this is the answer".
//
// THE DISTINCTION IS THE WHOLE FILE. Falling back on a bad answer doubles the spend, hides a
// prompt or schema problem behind a second opinion, and — if the first run had already called a
// tool — does the work twice. Falling back on an unavailable runtime is the feature.

/** A failure that says nothing about the request: the CLI is missing, signed out, or out of usage.
 *  Only these move an `auto` request on. A weak answer, an invalid answer or a refusal is a result. */
const unavailablePatterns = [
  /is not installed or not on PATH/i,
  /usage limit/i,
  /hit your (usage )?limit/i,
  /limit reached/i,
  /rate[ -]?limit/i,
  /quota/i,
  /not (logged|signed) in|please (run \/)?log ?in|unauthori[sz]ed|credit balance/i,
];

export const runtimeUnavailable = (error: string): boolean =>
  unavailablePatterns.some(pattern => pattern.test(error));

/** The next runtime to try, or null when every one has been tried. Order comes from the frozen
 *  contract so it is one fact in one place. */
export const nextRuntime = (tried: AgentRuntime): AgentRuntime | null => {
  const order = agentSelectionContract.fallbackOrder;
  return order[order.indexOf(tried) + 1] ?? null;
};

/** The same request on the next runtime, keeping the strength the caller asked for as closely as
 *  the other runtime's labels allow. Position in the capability order is the translation: a model
 *  two thirds of the way up one list becomes the model two thirds of the way up the other. */
export const translatedSelection = (selection: AgentSelection, runtime: AgentRuntime): AgentSelection | null => {
  const from = agentSelectionContract.capabilityOrder[selection.runtime];
  const to = agentSelectionContract.capabilityOrder[runtime];
  const translate = (order: readonly string[], target: readonly string[], label: string): string => {
    const index = order.indexOf(label);
    // An unknown label takes the target's default position rather than the weakest one: silently
    // downgrading is the failure that looks like the model got worse for no reason.
    if (index < 0) return target[Math.floor(target.length / 2)]!;
    const ratio = order.length === 1 ? 0 : index / (order.length - 1);
    return target[Math.round(ratio * (target.length - 1))]!;
  };
  const candidate = {
    runtime,
    model: translate(from.models, to.models, selection.model),
    effort: translate(from.efforts, to.efforts, selection.effort),
  };
  const parsed = agentSelectionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

export const fallbackSelection = (selection: AgentSelection): AgentSelection | null => {
  const runtime = nextRuntime(selection.runtime);
  return runtime ? translatedSelection(selection, runtime) : null;
};
