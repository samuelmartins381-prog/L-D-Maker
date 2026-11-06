// The one place that talks to the Claude API (ADR 0015). Everything else goes through LlmClient,
// so tests replay recorded answers without network.
import Anthropic from "@anthropic-ai/sdk";
import type { ModelId, Usage } from "./pricing.ts";

export interface LlmCall {
  model: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  /** JSON Schema the answer must follow. */
  schema: Record<string, unknown>;
  /**
   * true (default): the API enforces the schema (structured outputs). false: the schema is given
   * in the system prompt and the answer is checked afterwards — for schemas too large for the
   * API to compile ("compiled grammar is too large"), such as a whole module.
   */
  constrained?: boolean;
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
  /**
   * `onProgress` receives the characters received so far, and whether the latest were Claude's
   * thinking (summarised) rather than the answer: a long silence otherwise looks like a hang.
   */
  complete(
    call: LlmCall,
    onProgress?: (chars: number, thinking?: boolean) => void,
  ): Promise<LlmAnswer>;
}

export class LlmError extends Error {}

const outputConfig = (call: LlmCall) =>
  call.constrained === false
    ? { effort: "high" as const }
    : {
        effort: "high" as const,
        format: { type: "json_schema" as const, schema: call.schema },
      };

/** The system prompt, with the schema written out when the API does not enforce it. */
const systemOf = (call: LlmCall) =>
  call.constrained === false
    ? `${call.system}\n\nAnswer with one JSON object, nothing before or after it, that follows this JSON Schema (constraints are in the descriptions):\n${JSON.stringify(call.schema)}`
    : call.system;

/** The JSON object in an answer, without the code fences a free-form answer may wrap it in. */
export function jsonText(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Words Sam can act on, with the request id Anthropic support asks for. */
function explain(e: unknown): never {
  if (!(e instanceof Anthropic.APIError)) throw e;
  const id = e.requestID ? ` (request ${e.requestID})` : "";
  if (e instanceof Anthropic.AuthenticationError)
    throw new LlmError(`the API key was refused (check it in Settings)${id}`);
  if (e instanceof Anthropic.PermissionDeniedError)
    throw new LlmError(`this API key may not use this model${id}`);
  if (e instanceof Anthropic.RateLimitError)
    throw new LlmError(
      `rate limit or spending limit reached; retry later${id}`,
    );
  if (e instanceof Anthropic.APIConnectionError)
    throw new LlmError("no connection to the Claude API");
  // The API refused the request, then the connection closed before its reason could be read:
  // in practice a request too heavy (images) for the network on the way.
  if (e.status === 400 && /terminated/i.test(e.message))
    throw new LlmError(
      `the API refused the request and the connection closed before saying why; the sources may be too heavy (read them again with this version)${id}`,
    );
  if (e instanceof Anthropic.BadRequestError)
    throw new LlmError(`request refused by the API: ${e.message}${id}`);
  throw new LlmError(`Claude API error ${e.status}: ${e.message}${id}`);
}

export function anthropicClient(apiKey: string): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  return {
    async countTokens(call) {
      try {
        const r = await client.messages.countTokens({
          model: call.model,
          system: systemOf(call),
          messages: call.messages,
          // Only what changes the input size: the effort setting is not counted.
          ...(call.constrained === false
            ? {}
            : {
                output_config: {
                  format: { type: "json_schema" as const, schema: call.schema },
                },
              }),
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
          thinking: { type: "adaptive", display: "summarized" },
          output_config: outputConfig(call),
          system: systemOf(call),
          messages: call.messages,
        });
        let chars = 0;
        stream.on("text", (delta) => {
          chars += delta.length;
          onProgress?.(chars);
        });
        let thought = 0;
        stream.on("thinking", (delta) => {
          thought += delta.length;
          onProgress?.(thought, true);
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

/** Replays recorded answers in order, without network (tests, Studio end-to-end test). */
export function replayClient(
  answers: string[],
  inputTokens = 20_000,
): LlmClient {
  const queue = [...answers];
  return {
    async countTokens() {
      return inputTokens;
    },
    async complete(_call, onProgress) {
      const text =
        queue.length > 1 ? (queue.shift() as string) : (queue[0] ?? "{}");
      onProgress?.(text.length);
      return {
        text,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: {
          input_tokens: inputTokens,
          output_tokens: Math.ceil(text.length / 4),
        },
      };
    },
  };
}
