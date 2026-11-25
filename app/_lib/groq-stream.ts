// Reading Groq's streamed chat replies (OpenAI-compatible server-sent events).
// Pure, so it's tested without the network; the HTTP side is app/_server/groq.ts.

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "finish"; reason: string; toolCalls: ToolCall[] };

type Chunk = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  error?: { message?: string };
};

/**
 * Turns the stream's text chunks into events. Tool calls can arrive in pieces,
 * so they're assembled and handed over complete with the finish event.
 */
export async function* readChatStream(
  chunks: AsyncIterable<string>,
): AsyncGenerator<StreamEvent> {
  let buffer = "";
  const calls: ToolCall[] = [];
  let finished = false;

  function* handle(line: string): Generator<StreamEvent> {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const chunk = JSON.parse(data) as Chunk;
    if (chunk.error) throw new Error(chunk.error.message ?? "Groq stream error");
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta;
      if (delta?.content) yield { type: "text", text: delta.content };
      for (const t of delta?.tool_calls ?? []) {
        const c = (calls[t.index] ??= {
          id: "",
          type: "function",
          function: { name: "", arguments: "" },
        });
        if (t.id) c.id = t.id;
        if (t.function?.name) c.function.name += t.function.name;
        if (t.function?.arguments) c.function.arguments += t.function.arguments;
      }
      if (choice.finish_reason) {
        finished = true;
        yield {
          type: "finish",
          reason: choice.finish_reason,
          toolCalls: calls.filter(Boolean),
        };
      }
    }
  }

  for await (const part of chunks) {
    buffer += part;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      yield* handle(line);
    }
  }
  yield* handle(buffer.trim());
  if (!finished) throw new Error("Groq stream ended early");
}
