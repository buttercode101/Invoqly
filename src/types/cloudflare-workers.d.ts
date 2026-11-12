declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE?: { connectionString: string };
    AI: {
      run(
        model: string,
        input: {
          messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
          response_format: { type: "json_object" };
          max_tokens: number;
          temperature: number;
        }
      ): Promise<{ choices?: Array<{ message?: { content?: unknown } }> }>;
    };
  };
}
