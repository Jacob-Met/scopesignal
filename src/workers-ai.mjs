const RESULT_SCHEMA = {
  type: 'object',
  required: ['checkpoints'],
  additionalProperties: false,
  properties: { checkpoints: { type: 'array', items: { type: 'object', required: ['title', 'evidence'], additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, evidence: { type: 'string', minLength: 1, maxLength: 500 } } } } }
};

const RESULT_ERROR = 'AI result does not match the required schema';
const CHECKPOINT_ERROR = 'AI checkpoint failed schema validation';

function ownDataFields(value, names, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== names.length || names.some(name =>
    !Object.hasOwn(fields, name) || !Object.hasOwn(fields[name], 'value') || !fields[name].enumerable
  )) throw new Error(message);
  return names.map(name => fields[name].value);
}

function validText(value, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength * 2 || !value.trim()) return false;
  // JSON Schema counts Unicode code points; one can occupy two UTF-16 units.
  return [...value].length <= maxLength;
}

export function validateBriefResult(value) {
  const [supplied] = ownDataFields(value, ['checkpoints'], RESULT_ERROR);
  if (!Array.isArray(supplied)) throw new Error(RESULT_ERROR);
  const entries = Object.getOwnPropertyDescriptors(supplied);
  const length = entries.length.value;
  if (Reflect.ownKeys(entries).length !== length + 1) throw new Error(RESULT_ERROR);

  const checkpoints = [];
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(entries, index)) throw new Error(CHECKPOINT_ERROR);
    const entry = entries[index];
    if (!Object.hasOwn(entry, 'value') || !entry.enumerable) throw new Error(CHECKPOINT_ERROR);
    const [title, evidence] = ownDataFields(entry.value, ['title', 'evidence'], CHECKPOINT_ERROR);
    if (!validText(title, 120) || !validText(evidence, 500)) throw new Error(CHECKPOINT_ERROR);
    checkpoints.push({ title, evidence });
  }
  // Suggestions remain human-editable, but provider-owned objects cannot change
  // an already validated result or bring undeclared fields into the consumer.
  return { checkpoints };
}

// Cloudflare Workers AI binding scaffold. No key, account, or paid fallback is
// included. Calls fail closed unless the host explicitly provides a binding.
export async function interpretWithWorkersAI(brief, env = {}) {
  const binding = env?.AI;
  if (!binding || typeof binding.run !== 'function') throw new Error('Workers AI disconnected: requires an eligible Cloudflare account with Workers AI binding configured. No paid fallback is allowed.');
  const result = await binding.run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'system', content: 'Return JSON with a checkpoints array; each checkpoint has title and evidence. Do not approve payment.' }, { role: 'user', content: brief }], response_format: { type: 'json_schema', json_schema: structuredClone(RESULT_SCHEMA) } });
  let parsed = result;
  if (typeof result === 'string') parsed = JSON.parse(result);
  else if (result && typeof result === 'object' && !Array.isArray(result)) {
    const response = Object.getOwnPropertyDescriptor(result, 'response');
    if (response?.enumerable && Object.hasOwn(response, 'value') && typeof response.value === 'string') parsed = JSON.parse(response.value);
  }
  return validateBriefResult(parsed);
}
