const RESULT_SCHEMA = {
  type: 'object',
  required: ['checkpoints'],
  additionalProperties: false,
  properties: { checkpoints: { type: 'array', items: { type: 'object', required: ['title', 'evidence'], additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, evidence: { type: 'string', minLength: 1, maxLength: 500 } } } } }
};

export function validateBriefResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => k !== 'checkpoints') || !Array.isArray(value.checkpoints)) throw new Error('AI result does not match the required schema');
  for (const item of value.checkpoints) {
    if (!item || Object.keys(item).length !== 2 || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120 || typeof item.evidence !== 'string' || !item.evidence.trim() || item.evidence.length > 500) throw new Error('AI checkpoint failed schema validation');
  }
  return value;
}

// Cloudflare Workers AI binding scaffold. No key, account, or paid fallback is
// included. Calls fail closed unless the host explicitly provides a binding.
export async function interpretWithWorkersAI(brief, env = {}) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('Workers AI disconnected: requires an eligible Cloudflare account with Workers AI binding configured. No paid fallback is allowed.');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'system', content: 'Return JSON with a checkpoints array; each checkpoint has title and evidence. Do not approve payment.' }, { role: 'user', content: brief }], response_format: { type: 'json_schema', json_schema: RESULT_SCHEMA } });
  let parsed = result;
  if (typeof result === 'string') parsed = JSON.parse(result);
  else if (result?.response && typeof result.response === 'string') parsed = JSON.parse(result.response);
  return validateBriefResult(parsed);
}
