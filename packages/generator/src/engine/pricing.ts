// API prices in US dollars per million tokens (Claude API, first party), for the cost shown to Sam
// before and after a generation. Cache writes cost 1.25 × input (5-minute cache).
export const MODELS = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
} as const;
export type ModelId = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelId = "claude-opus-5-5";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens ?? 0) +
      (b.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
  };
}

export const ZERO_USAGE: Usage = { input_tokens: 0, output_tokens: 0 };

/** Cost in dollars of what a call consumed. */
export function cost(model: ModelId, u: Usage): number {
  const p = MODELS[model];
  return (
    (u.input_tokens * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      u.output_tokens * p.output) /
    1_000_000
  );
}
