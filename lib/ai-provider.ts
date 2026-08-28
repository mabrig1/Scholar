export type AiProviderName = "openai" | "openrouter" | "groq" | "gemini";

export type AiProviderResult = {
  text: string;
  provider: AiProviderName;
  model: string;
};

function extractResponsesText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const texts: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") texts.push(content.text);
    }
  }
  return texts.join("\n").trim();
}

async function callResponsesApi(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  extraHeaders?: Record<string, string>;
}): Promise<string | null> {
  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        ...(input.extraHeaders ?? {}),
      },
      body: JSON.stringify({ model: input.model, input: input.prompt }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) return null;
    return extractResponsesText(await response.json()) || null;
  } catch {
    return null;
  }
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n").trim();
    return text || null;
  } catch {
    return null;
  }
}

export function configuredAiProviders(): AiProviderName[] {
  const providers: AiProviderName[] = [];
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.OPENROUTER_API_KEY) providers.push("openrouter");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  return providers;
}

export async function generateWithAiFallback(prompt: string): Promise<AiProviderResult | null> {
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
    const text = await callResponsesApi({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: process.env.OPENAI_API_KEY,
      model,
      prompt,
    });
    if (text) return { text, provider: "openai", model };
  }

  if (process.env.OPENROUTER_API_KEY) {
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";
    const headers: Record<string, string> = {};
    if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "Mabrig Researcher Pro";
    const text = await callResponsesApi({
      endpoint: "https://openrouter.ai/api/v1/responses",
      apiKey: process.env.OPENROUTER_API_KEY,
      model,
      prompt,
      extraHeaders: headers,
    });
    if (text) return { text, provider: "openrouter", model };
  }

  if (process.env.GROQ_API_KEY) {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const text = await callResponsesApi({
      endpoint: "https://api.groq.com/openai/v1/responses",
      apiKey: process.env.GROQ_API_KEY,
      model,
      prompt,
    });
    if (text) return { text, provider: "groq", model };
  }

  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-3.7-flash";
    const text = await callGemini(process.env.GEMINI_API_KEY, model, prompt);
    if (text) return { text, provider: "gemini", model };
  }

  return null;
}
