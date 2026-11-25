import { describe, expect, it } from "vitest";
import { readChatStream, type StreamEvent } from "./groq-stream";

async function* parts(...xs: string[]) {
  yield* xs;
}
async function collect(it: AsyncIterable<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}
const data = (o: object) => `data: ${JSON.stringify(o)}\n\n`;

describe("readChatStream", () => {
  it("passes text through, even when a line is split across chunks", async () => {
    const line = data({ choices: [{ delta: { content: "Hello" } }] });
    const events = await collect(
      readChatStream(
        parts(
          line.slice(0, 12),
          line.slice(12),
          data({ choices: [{ delta: { content: " there" }, finish_reason: "stop" }] }),
          "data: [DONE]\n\n",
        ),
      ),
    );
    expect(events).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " there" },
      { type: "finish", reason: "stop", toolCalls: [] },
    ]);
  });

  it("assembles tool calls that arrive in pieces", async () => {
    const events = await collect(
      readChatStream(
        parts(
          data({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "get_asset_summary", arguments: '{"sym' } }] } }] }),
          data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'bol":"SOL"}' } }] } }] }),
          data({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
        ),
      ),
    );
    expect(events).toEqual([
      {
        type: "finish",
        reason: "tool_calls",
        toolCalls: [{ id: "c1", type: "function", function: { name: "get_asset_summary", arguments: '{"symbol":"SOL"}' } }],
      },
    ]);
  });

  it("throws on an error in the stream, or a stream that stops without finishing", async () => {
    await expect(collect(readChatStream(parts(data({ error: { message: "over capacity" } }))))).rejects.toThrow(/over capacity/);
    await expect(collect(readChatStream(parts(data({ choices: [{ delta: { content: "Hi" } }] }))))).rejects.toThrow(/ended early/);
  });
});
