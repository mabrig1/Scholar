import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type Health = {
  name: string;
  configured: boolean;
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  detail: string;
};

async function probe(name: string, configured: boolean, url: string, init?: RequestInit): Promise<Health> {
  if (!configured) return { name, configured: false, ok: false, status: null, latencyMs: null, detail: "Not configured" };
  const start = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000), cache: "no-store" });
    const latencyMs = Date.now() - start;
    return {
      name,
      configured: true,
      ok: response.ok,
      status: response.status,
      latencyMs,
      detail: response.ok ? "Reachable" : `Provider returned HTTP ${response.status}`,
    };
  } catch (error) {
    return { name, configured: true, ok: false, status: null, latencyMs: Date.now() - start, detail: error instanceof Error ? error.message : "Request failed" };
  }
}

export async function GET(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const openAlexUrl = new URL("https://api.openalex.org/works");
  openAlexUrl.searchParams.set("per-page", "1");
  if (process.env.OPENALEX_API_KEY) openAlexUrl.searchParams.set("api_key", process.env.OPENALEX_API_KEY);

  const checks = await Promise.all([
    probe("OpenAI", Boolean(process.env.OPENAI_API_KEY), "https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}` },
    }),
    probe("OpenRouter", Boolean(process.env.OPENROUTER_API_KEY), "https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}` },
    }),
    probe("Groq", Boolean(process.env.GROQ_API_KEY), "https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY || ""}` },
    }),
    probe("Gemini", Boolean(process.env.GEMINI_API_KEY), `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY || "")}`),
    probe("OpenAlex", true, openAlexUrl.toString(), { headers: { "User-Agent": "MabrigResearcherPro/0.8 (health check)" } }),
    probe("Crossref", true, "https://api.crossref.org/works?rows=0", {
      headers: { "User-Agent": `MabrigResearcherPro/0.8 (${process.env.CROSSREF_MAILTO || "publisher health check"})` },
    }),
  ]);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      healthy: checks.filter((check) => check.ok).length,
      configuredAi: checks.slice(0, 4).filter((check) => check.configured).length,
      healthyAi: checks.slice(0, 4).filter((check) => check.ok).length,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
