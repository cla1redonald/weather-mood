// @vitest-environment node
/**
 * Guards on the critic's output schema. The API compiles it into a grammar
 * and refused the previous version as "too complex", so these tests pin the
 * properties that keep it small.
 */
import { describe, expect, it } from 'vitest';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ADJUSTMENT_KNOBS, CritiqueSchema, MAX_ADJUSTMENTS, RUBRIC_CRITERIA } from '@/lib/critique/schema';
import { KNOB_EFFECTS, normaliseAdjustments } from '@/lib/critique/patch';

type JsonNode = Record<string, unknown>;

const sent = zodOutputFormat(CritiqueSchema).schema as JsonNode;

function resolve(node: JsonNode): JsonNode {
  const ref = node.$ref as string | undefined;
  if (!ref) return node;
  const name = ref.replace('#/$defs/', '');
  return (sent.$defs as Record<string, JsonNode>)[name];
}

function walk(node: JsonNode, visit: (n: JsonNode) => void): void {
  const resolved = resolve(node);
  visit(resolved);
  for (const child of Object.values((resolved.properties ?? {}) as Record<string, JsonNode>)) walk(child, visit);
  if (resolved.items) walk(resolved.items as JsonNode, visit);
}

describe('CritiqueSchema', () => {
  it('has a handler for every knob in the enum', () => {
    expect(Object.keys(KNOB_EFFECTS).sort()).toEqual([...ADJUSTMENT_KNOBS].sort());
  });

  it('has no optional fields, no number arrays and no range constraints', () => {
    const constraintKeys = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'minLength', 'maxLength'];
    walk(sent, (node) => {
      for (const key of constraintKeys) expect(node).not.toHaveProperty(key);
      if (node.type === 'object') {
        expect(Object.keys(node.properties as JsonNode).sort()).toEqual([...(node.required as string[])].sort());
      }
      if (node.type === 'array') {
        expect(resolve(node.items as JsonNode).type).toBe('object');
      }
    });
  });

  it('sends five integer scores and an adjustment list naming every knob', () => {
    const properties = sent.properties as Record<string, JsonNode>;
    const scores = resolve(properties.scores).properties as Record<string, JsonNode>;
    expect(Object.keys(scores)).toEqual([...RUBRIC_CRITERIA]);
    for (const criterion of RUBRIC_CRITERIA) expect(scores[criterion].type).toBe('integer');

    const adjustments = resolve(properties.adjustments);
    const item = resolve(adjustments.items as JsonNode).properties as Record<string, JsonNode>;
    // The SDK moves enum values into the description; the model reads them there.
    for (const knob of ADJUSTMENT_KNOBS) expect(String(item.knob.description)).toContain(`"${knob}"`);
  });

  it('stays small', () => {
    expect(JSON.stringify(sent).length).toBeLessThan(2000);
  });

  it('drops adjustments naming an unknown knob instead of failing the reply', () => {
    const parsed = CritiqueSchema.parse({
      scores: { palette: 3, density: 4, poemContrast: 2, focalPoint: 4, cityFlavour: 3 },
      evidence: 'the bottom third is bright',
      defect: 'bright behind the poem',
      critique: 'the bottom is too bright for the poem, calming it',
      adjustments: [
        { knob: 'calmer_behind_poem', amount: 'large' },
        { knob: 'make_it_pop', amount: 'large' },
        { knob: 'darker', amount: 'huge' },
      ],
    });
    expect(parsed.adjustments).toEqual([
      { knob: 'calmer_behind_poem', amount: 'large' },
      { knob: 'darker', amount: 'small' },
    ]);
  });

  it('caps the list in code, not in the schema', () => {
    const many = ADJUSTMENT_KNOBS.filter((_, i) => i % 2 === 0).map((knob) => ({ knob, amount: 'small' as const }));
    expect(normaliseAdjustments(many)).toHaveLength(MAX_ADJUSTMENTS);
  });
});
