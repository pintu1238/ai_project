import { env } from "../config/env.js";

export type OllamaJsonResult<T> = {
  data: T;
  demoMode: boolean;
  raw?: string;
};

export async function ollamaJson<T>(prompt: string, schemaHint: string): Promise<OllamaJsonResult<T>> {
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        stream: false,
        format: "json",
        prompt: `${schemaHint}\n\n${prompt}`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }
    const body = (await res.json()) as { response?: string };
    const raw = body.response ?? "";
    const data = JSON.parse(raw) as T;
    return { data, demoMode: false, raw };
  } catch (err) {
    if (env.DEMO_MODE) {
      return { data: {} as T, demoMode: true, raw: String(err) };
    }
    throw err;
  }
}

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
