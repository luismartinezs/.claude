/**
 * Minimal client for Jev (TypeSafe) through OpenRouter's decisions endpoint.
 *
 * Copy into a project and adapt. No dependencies: global fetch + AbortSignal.any.
 * Server-side only: never ship the API key to a browser.
 * Verified live 2026-09-19 against typesafe/jev-1.13-20260917 on Bun 1.4 and Node 24
 * (native type stripping); tsc --strict --erasableSyntaxOnly clean. Needs Node 20.3+.
 * Cloudflare Workers / Deno have the same APIs but were not tested.
 *
 *   const jev = new Jev({ apiKey: process.env.OPENROUTER_API_KEY });
 *   const r = await jev.ask("I was charged twice", {
 *     isBilling: noul("Is this about billing or payments?"),
 *     team: choice("Which team should own this?", { billing: "Charges, refunds", tech: "Bugs, outages" }),
 *     urgency: score("How urgent is this?", ["Can wait", "This week", "Blocking revenue now"]),
 *   });
 *   r.answers.isBilling.noul    // number: probability of yes, 0..1 (no confidence field)
 *   r.answers.team.choice       // "billing" | "tech"  (typed from the options you passed)
 *   r.answers.urgency.score     // number between level indexes, plus confidence/probabilities/legend
 */

export const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
export const DEFAULT_MODEL = "~typesafe/jev-latest"; // pin "typesafe/jev-1.13" once thresholds are tuned

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
/** Instructions and criteria accept plain text or structured JSON (definitions, examples, exclusions). */
export type Guidance = string | { [key: string]: Json } | Json[];

// ---- Questions ----

export interface NoulQuestion {
  type: "noul";
  instructions: Guidance;
  /** Optional; if present, both keys are required. */
  criteria?: { true: Guidance; false: Guidance };
}

export interface ChoiceQuestion<O extends string = string> {
  type: "choice";
  instructions: Guidance;
  /** Option name -> description (null when the name says it all). */
  criteria: Record<O, Guidance | null>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: Guidance;
  /** Ordered levels, low to high, at least two. */
  criteria: Guidance[];
}

export type Question = NoulQuestion | ChoiceQuestion<string> | ScoreQuestion;

export function noul(instructions: Guidance, criteria?: { yes: Guidance; no: Guidance }): NoulQuestion {
  return criteria
    ? { type: "noul", instructions, criteria: { true: criteria.yes, false: criteria.no } }
    : { type: "noul", instructions };
}

export function choice<const O extends string>(
  instructions: Guidance,
  options: Record<O, Guidance | null>,
): ChoiceQuestion<O> {
  return { type: "choice", instructions, criteria: options };
}

export function score(instructions: Guidance, levels: Guidance[]): ScoreQuestion {
  if (levels.length < 2) throw new Error("score needs at least two ordered levels");
  return { type: "score", instructions, criteria: levels };
}

// ---- Answers ----

export interface NoulAnswer {
  type: "noul";
  /** Probability the answer is yes. */
  noul: number;
}

export interface ChoiceAnswer<O extends string = string> {
  type: "choice";
  choice: O;
  probabilities: Record<O, number>;
  /** How concentrated the distribution is; not the same as the top probability. */
  confidence: number;
}

export interface ScoreAnswer {
  type: "score";
  /** Probability-weighted level index; can fall between levels. Threshold it, don't interpolate. */
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type AnswerFor<Q> =
  Q extends ChoiceQuestion<infer O> ? ChoiceAnswer<O>
  : Q extends ScoreQuestion ? ScoreAnswer
  : Q extends NoulQuestion ? NoulAnswer
  : never;

export interface JevResponse<Q extends Record<string, Question>> {
  /** Versioned model id that actually answered; log it. */
  model: string;
  id: string;
  answers: { [K in keyof Q]: AnswerFor<Q[K]> };
  usage: { input_tokens: number; output_tokens: number; cost?: number };
}

// ---- Client ----

// Plain fields, not constructor parameter properties, so Node's type stripping can run this file as-is.
export class JevError extends Error {
  readonly status?: number;
  readonly body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "JevError";
    this.status = status;
    this.body = body;
  }
}

export interface JevOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch; // inject for tests
}

export class Jev {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: JevOptions = {}) {
    const key = opts.apiKey ?? (globalThis as { process?: { env: Record<string, string | undefined> } })
      .process?.env.OPENROUTER_API_KEY;
    if (!key) throw new JevError("OPENROUTER_API_KEY is not set");
    this.apiKey = key;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async ask<const Q extends Record<string, Question>>(
    state: Json,
    questions: Q,
    opts: { signal?: AbortSignal } = {},
  ): Promise<JevResponse<Q>> {
    const signals = [AbortSignal.timeout(this.timeoutMs), ...(opts.signal ? [opts.signal] : [])];
    const res = await this.fetchImpl(DECISIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, state, questions }),
      signal: AbortSignal.any(signals),
    });
    const text = await res.text();
    if (!res.ok) throw new JevError(`Jev decisions error ${res.status}: ${text.slice(0, 300)}`, res.status, text);
    const body = JSON.parse(text) as JevResponse<Q>;
    checkAnswers(questions, body.answers as Record<string, { type: string; choice?: string }>);
    return body;
  }
}

/** Fail loudly if an answer is missing, the wrong type, or a choice outside the options. */
function checkAnswers(questions: Record<string, Question>, answers: Record<string, { type: string; choice?: string }>) {
  for (const [id, q] of Object.entries(questions)) {
    const a = answers?.[id];
    if (!a) throw new JevError(`Jev returned no answer for "${id}"`);
    if (a.type !== q.type) throw new JevError(`Jev answered "${id}" as ${a.type}, expected ${q.type}`);
    if (q.type === "choice" && !(a.choice! in q.criteria)) {
      throw new JevError(`Jev chose "${a.choice}" for "${id}", which is not one of its options`);
    }
  }
}
