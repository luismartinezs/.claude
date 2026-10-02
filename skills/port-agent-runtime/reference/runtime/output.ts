import type { AgentRuntime } from '../contracts/agent.ts';

// Reading one structured answer out of a CLI's stream, and the schema repairs each runtime needs.
//
// EVERY QUIRK BELOW COST A DEBUGGING SESSION TO FIND. They are collected here rather than at each
// call site, because the failure mode when they are not is that one task works and the task beside
// it silently returns an object the schema refuses.

type JsonSchema = Record<string, unknown>;

const jsonSchemaObject = (value: unknown): JsonSchema | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonSchema : null;

// --- Top-level unions -------------------------------------------------------

/** BOTH KEYWORDS. Zod emits `anyOf` for z.union and `oneOf` for z.discriminatedUnion, so a check
 *  for one of them passes on the schemas the app happens to have today and silently fails the first
 *  time someone writes the other kind. The CLI then rejects the whole request with a message about
 *  the schema, which reads as a prompt problem and is not one. */
export const topLevelUnionVariants = (schema: unknown): unknown[] | null => {
  const object = jsonSchemaObject(schema);
  if (!object) return null;
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    if (Array.isArray(object[keyword])) return object[keyword] as unknown[];
  }
  return null;
};

export const hasTopLevelUnion = (schema: unknown): boolean => topLevelUnionVariants(schema) !== null;

/** Neither CLI accepts a top-level union as a response schema, so a union travels inside { result }. */
export const unionEnvelopeSchema = (schema: unknown): JsonSchema => {
  const variants = topLevelUnionVariants(schema);
  if (!variants) throw new Error('unionEnvelopeSchema needs a schema with a top-level oneOf or anyOf.');
  return {
    type: 'object',
    properties: { result: { anyOf: variants } },
    required: ['result'],
    additionalProperties: false,
  };
};

export const unwrapUnionEnvelope = (output: unknown, wrapped: boolean): unknown => {
  if (!wrapped) return output;
  if (typeof output !== 'object' || output === null || Array.isArray(output) || !('result' in output)) {
    throw new Error('The agent response did not contain the required result object.');
  }
  return (output as { result: unknown }).result;
};

// --- Codex: every property must be required ---------------------------------

const schemaAllowsNull = (schema: JsonSchema): boolean => {
  if (schema.type === 'null') return true;
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : [];
  return variants.some(variant => {
    const object = jsonSchemaObject(variant);
    return object ? schemaAllowsNull(object) : false;
  });
};

/** Codex refuses a response schema whose object has properties outside `required`. An optional
 *  property therefore goes out as `anyOf: [T, null]` and required, and comes back with its nulls
 *  stripped by removeCodexOptionalNulls. Send the schema unchanged and the CLI rejects the whole
 *  request with a message about the schema, not about the property. */
export const requireCodexObjectProperties = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(requireCodexObjectProperties);
  const current = jsonSchemaObject(schema);
  if (!current) return schema;
  const converted = Object.fromEntries(
    Object.entries(current)
      // propertyNames is not supported and is not expressible as a required property either.
      .filter(([key]) => key !== 'propertyNames')
      .map(([key, value]) => [key, requireCodexObjectProperties(value)]),
  );
  const properties = jsonSchemaObject(converted.properties);
  if (converted.type === 'object' && current.propertyNames !== undefined && !properties) {
    return { ...converted, properties: {}, required: [], additionalProperties: false };
  }
  if (converted.type !== 'object' || !properties) return converted;
  const originallyRequired = new Set(
    Array.isArray(current.required) ? current.required.filter((key): key is string => typeof key === 'string') : [],
  );
  const requiredProperties = Object.fromEntries(Object.entries(properties).map(([key, value]) => {
    const property = jsonSchemaObject(value);
    if (originallyRequired.has(key) || !property || schemaAllowsNull(property)) return [key, value];
    return [key, { anyOf: [property, { type: 'null' }] }];
  }));
  return { ...converted, properties: requiredProperties, required: Object.keys(requiredProperties) };
};

const schemaVariantFor = (schema: JsonSchema, value: unknown): JsonSchema => {
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : [];
  const candidates = variants.map(jsonSchemaObject).filter((item): item is JsonSchema => item !== null);
  const matching = candidates.find(candidate => {
    if (value === null) return candidate.type === 'null';
    const properties = jsonSchemaObject(candidate.properties);
    if (typeof value !== 'object' || value === null || Array.isArray(value) || !properties) return false;
    // Discriminated by whichever properties the variant pins with const.
    return Object.entries(properties).every(([key, propertyValue]) => {
      const property = jsonSchemaObject(propertyValue);
      return !property || property.const === undefined || (value as JsonSchema)[key] === property.const;
    });
  });
  return matching ?? candidates[0] ?? schema;
};

/** The other half of requireCodexObjectProperties: an optional property Codex had to fill comes
 *  back as null, and the app's own schema does not allow null there. Strip it and the property is
 *  absent again, which is what optional means. */
export const removeCodexOptionalNulls = (value: unknown, schemaInput: unknown): unknown => {
  const initialSchema = jsonSchemaObject(schemaInput);
  if (!initialSchema) return value;
  const schema = schemaVariantFor(initialSchema, value);
  if (Array.isArray(value)) return value.map(item => removeCodexOptionalNulls(item, schema.items));
  if (typeof value !== 'object' || value === null) return value;
  const properties = jsonSchemaObject(schema.properties) ?? {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [],
  );
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (item === null && key in properties && !required.has(key)) return [];
    return [[key, removeCodexOptionalNulls(item, properties[key])]];
  }));
};

// --- Reading the stream -----------------------------------------------------

const jsonLines = (stdout: string): Array<Record<string, any>> =>
  stdout.split('\n').filter(line => line.trim()).map(line => JSON.parse(line) as Record<string, any>);

/** The structured answer, or a throw whose message is what went wrong for the operator to read. */
export const parseNativeAgentOutput = (runtime: AgentRuntime, stdout: string): unknown => {
  if (runtime === 'claude-code') {
    // stream-json emits one frame per line; the final "result" frame carries the structured output.
    const frames = jsonLines(stdout);
    // A single frame carrying an answer is what --output-format json gives, so one CLI-mode change
    // does not become a parse failure with no explanation. IT MUST STILL LOOK LIKE A RESULT: taking
    // any lone frame produced `Unexpected end of JSON input` for a stream that simply had no
    // answer in it, which sends the reader looking for a malformed response instead of a runtime
    // that stopped early.
    const looksLikeResult = (frame: Record<string, any>): boolean =>
      frame.structured_output !== undefined || frame.result !== undefined || frame.is_error !== undefined;
    const resultFrame = [...frames].reverse().find(frame => frame.type === 'result')
      ?? (frames.length === 1 && looksLikeResult(frames[0]!) ? frames[0] : undefined);
    if (!resultFrame) throw new Error('Claude Code exited without a result.');
    const result = resultFrame as { is_error?: boolean; result?: unknown; structured_output?: unknown };
    if (result.is_error) throw new Error(String(result.result || 'Claude Code could not complete the request.'));
    if (result.structured_output !== undefined) return result.structured_output;
    // Falls back to the text answer, fenced or not, for the case where the schema was satisfied in
    // prose rather than in structured_output.
    const text = String(result.result ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
    return JSON.parse(text);
  }

  const frames = jsonLines(stdout);
  const failure = frames.find(frame => frame.type === 'turn.failed' || frame.type === 'error');
  if (failure) throw new Error(failure.error?.message || failure.message || 'Codex could not complete the request.');
  const messages = frames.filter(frame => frame.type === 'item.completed' && frame.item?.type === 'agent_message');
  // BOTH CHECKS. A stream that stops mid-turn can still contain a complete-looking message, and
  // treating that as the answer means acting on half of one.
  if (!frames.some(frame => frame.type === 'turn.completed') || !messages.length) {
    throw new Error('The agent exited without a complete response.');
  }
  return JSON.parse(messages.at(-1)!.item.text);
};

/** Claude Code reports most failures inside its stdout result frame and leaves stderr empty, so a
 *  non-zero exit with an empty stderr still has something worth saying in it. */
export const stdoutFailure = (runtime: AgentRuntime, stdout: string): string => {
  try {
    parseNativeAgentOutput(runtime, stdout);
    return '';
  } catch (error) {
    return stdout.trim() ? (error instanceof Error ? error.message : String(error)) : '';
  }
};

/** Whether the runtime did real work before it stopped. Consulted BEFORE falling back to another
 *  runtime, because work must not run twice: a run that already called tools may have changed
 *  something outside this process. */
export const isAgentActivity = (runtime: AgentRuntime, frame: Record<string, any>): boolean =>
  Number(frame.total_cost_usd ?? 0) > 0 ||
  Object.values(frame.usage ?? frame.message?.usage ?? {}).some(value => typeof value === 'number' && value > 0) ||
  (runtime === 'codex'
    ? ['item.started', 'item.updated', 'item.completed', 'turn.completed'].includes(frame.type)
    : (frame.type === 'assistant' && !frame.error) || frame.type === 'stream_event' || frame.type === 'user' ||
      (frame.type === 'result' && (frame.is_error !== true || Number(frame.usage?.output_tokens ?? 0) > 0)));

export const didAnyWork = (runtime: AgentRuntime, stdout: string): boolean => {
  try {
    return jsonLines(stdout).some(frame => isAgentActivity(runtime, frame));
  } catch {
    // Unparseable output is not proof that nothing happened, and guessing "nothing" here is the
    // guess that runs the work twice.
    return stdout.trim().length > 0;
  }
};
