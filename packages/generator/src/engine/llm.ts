// The one place that talks to the Claude API (ADR 0015). Everything else goes through LlmClient,
// so tests replay recorded answers without network.
import Anthropic from "@anthropic-ai/sdk";
import type { ModelId, Usage } from "./pricing.ts";

export interface LlmCall {
  model: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  /** JSON Schema the answer must follow (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface LlmAnswer {
  /** The JSON text of the answer. */
  text: string;
  /** Full content, to append to the conversation as is (thinking blocks included). */
  content: Anthropic.ContentBlockParam[];
  stopReason: string | null;
  usage: Usage;
}

export interface LlmClient {
  countTokens(call: LlmCall): Promise<number>;
  /** `onProgress` receives the number of answer characters received so far. */
  complete(
    call: LlmCall,
    onProgress?: (chars: number) => void,
  ): Promise<LlmAnswer>;
}

export class LlmError extends Error {}

const outputConfig = (schema: Record<string, unknown>) => ({
  effort: "high" as const,
  format: { type: "json_schema" as const, schema },
});

/** Words a learner-facing person can act on, for the errors Sam may see. */
function explain(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError)
    throw new LlmError("the API key was refused (check it in Settings)");
  if (e instanceof Anthropic.PermissionDeniedError)
    throw new LlmError("this API key may not use this model");
  if (e instanceof Anthropic.RateLimitError)
    throw new LlmError("rate limit or spending limit reached; retry later");
  if (e instanceof Anthropic.BadRequestError)
    throw new LlmError(`request refused by the API: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError)
    throw new LlmError("no connection to the Claude API");
  if (e instanceof Anthropic.APIError)
    throw new LlmError(`Claude API error ${e.status}: ${e.message}`);
  throw e;
}

export function anthropicClient(apiKey: string): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  return {
    async countTokens(call) {
      try {
        const r = await client.messages.countTokens({
          model: call.model,
          system: call.system,
          messages: call.messages,
          output_config: outputConfig(call.schema),
        });
        return r.input_tokens;
      } catch (e) {
        return explain(e);
      }
    },
    async complete(call, onProgress) {
      try {
        const stream = client.messages.stream({
          model: call.model,
          max_tokens: call.maxTokens,
          thinking: { type: "adaptive" },
          output_config: outputConfig(call.schema),
          system: call.system,
          messages: call.messages,
        });
        let chars = 0;
        stream.on("text", (delta) => {
          chars += delta.length;
          onProgress?.(chars);
        });
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal")
          throw new LlmError("Claude declined this request (refusal)");
        return {
          text: message.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join(""),
          content: message.content as Anthropic.ContentBlockParam[],
          stopReason: message.stop_reason,
          usage: message.usage,
        };
      } catch (e) {
        if (e instanceof LlmError) throw e;
        return explain(e);
      }
    },
  };
}
