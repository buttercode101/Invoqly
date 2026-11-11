export type AssistantMessage = { role: "system" | "user"; content: string };

export async function runBusinessAssistant(_messages: AssistantMessage[]): Promise<string> {
  throw new Error("The AI co-pilot is available on the Cloudflare deployment only.");
}
