import { env } from "cloudflare:workers";
import type { AssistantMessage } from "./ai";

export async function runBusinessAssistant(messages: AssistantMessage[]): Promise<string> {
  const result = await env.AI.run("@cf/openai/gpt-oss-20b", {
    messages,
    response_format: { type: "json_object" },
    max_tokens: 1_200,
    temperature: 0.1
  });
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The AI model did not return a usable structured response.");
  }
  return content;
}
