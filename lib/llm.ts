// Chamada simples a um modelo de linguagem (Groq, com troca de modelo se um falhar) que devolve JSON.
// Usado pelas tarefas (checar se ainda faz sentido, achar compromissos de retorno nas conversas).

function modelosGroq(): string[] {
  const extra = (process.env.GROQ_MODEL ?? "").trim();
  const base = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
  return extra ? [extra, ...base.filter((m) => m !== extra)] : base;
}

export async function perguntarJSON<T>(sistema: string, usuario: string, maxTokens = 500): Promise<T | null> {
  const key = (process.env.GROQ_API_KEY ?? "").trim();
  if (!key) return null;
  for (const model of modelosGroq()) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const c = j.choices?.[0]?.message?.content;
      if (!c) continue;
      try {
        return JSON.parse(c) as T;
      } catch {
        const m = c.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]) as T;
      }
    } catch (e) {
      console.error(`[llm] ${model}:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
