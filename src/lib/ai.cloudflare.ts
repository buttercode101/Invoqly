import { env } from "cloudflare:workers";
import type { AssistantMessage } from "./ai";

type WorkerAiBinding = {
  run(model: string, input: {
    messages: AssistantMessage[];
    response_format: { type: "json_object" };
    max_tokens: number;
    temperature: number;
  }): Promise<{ choices?: Array<{ message?: { content?: unknown } }> }>;
};

export async function runBusinessAssistant(messages: AssistantMessage[]): Promise<string> {
  const ai = (env as unknown as { AI: WorkerAiBinding }).AI;
  const result = await ai.run("@cf/openai/gpt-oss-20b", {
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
