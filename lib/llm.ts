/** Minimal OpenAI-compatible chat client (DeepSeek). */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatJson<T>(messages: ChatMessage[], timeoutMs = 45_000): Promise<T> {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  if (!base || !key) throw new Error("LLM_BASE_URL / LLM_API_KEY not configured");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "deepseek-chat",
      messages,
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");
  try {
    return JSON.parse(content) as T;
  } catch {
    // Some models wrap JSON in prose or fences; salvage the object.
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`LLM did not return JSON: ${content.slice(0, 200)}`);
    return JSON.parse(match[0]) as T;
  }
}
