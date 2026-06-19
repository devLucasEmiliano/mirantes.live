// Classificador LLM commit→meta (spec 013). Runtime plugável OpenAI-compatível (Ollama/LM
// Studio/Unsloth) via `fetch` nativo — sem SDK de LLM. NUNCA lança p/ fora: toda falha vira um
// `ClassifyResult` de erro (`unreachable`/`timeout`/`bad_response`) para o orquestrador cair no
// resolver determinístico. Injeção de `fetch` torna o HTTP testável sem rede.
import { env } from "@/lib/env";
import type { CandidateGoal, DeterministicMatch } from "./resolver";

export type { CandidateGoal } from "./resolver";

export interface ClassifyCommit {
  sha: string;
  message: string;
  author: string;
  isMerge: boolean;
  branch: string;
}

export interface ClassifyInput {
  commit: ClassifyCommit;
  candidates: CandidateGoal[];
  hint: DeterministicMatch | null;
}

export type ClassifyResult =
  | { ok: true; goalId: string | null }
  | { ok: false; error: "unreachable" | "timeout" | "bad_response" };

export interface CommitClassifier {
  classify(input: ClassifyInput): Promise<ClassifyResult>;
}

export interface HttpClassifierConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKey?: string;
}

function buildMessages(input: ClassifyInput) {
  const list = input.candidates
    .map((c) => `- ${c.id} (${c.shortCode}): ${c.title}`)
    .join("\n");
  const hint = input.hint ? ` Dica determinística: ${input.hint.goalId}.` : "";
  return [
    {
      role: "system",
      content:
        "Você associa um commit a UMA meta. Responda APENAS JSON " +
        '{"goalId": "<id>"} com um id da lista, ou {"goalId": null} se nenhuma casa.',
    },
    {
      role: "user",
      content:
        `Metas candidatas:\n${list}\n\nCommit: ${input.commit.message}` +
        ` (branch ${input.commit.branch}${input.commit.isMerge ? ", merge" : ""}).${hint}`,
    },
  ];
}

function parseGoalId(content: string): string | null {
  const tryParse = (raw: string): string | null | undefined => {
    try {
      const parsed = JSON.parse(raw) as { goalId?: unknown };
      if (typeof parsed.goalId === "string") return parsed.goalId;
      if (parsed.goalId === null) return null;
      return undefined;
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(content);
  if (direct !== undefined) return direct;
  // Modelos às vezes embrulham o JSON em texto/```; tenta extrair o primeiro objeto.
  const m = content.match(/\{[^{}]*\}/);
  if (m) {
    const extracted = tryParse(m[0]);
    if (extracted !== undefined) return extracted;
  }
  return null;
}

export function createHttpClassifier(
  cfg: HttpClassifierConfig,
  fetchImpl: typeof fetch = fetch,
): CommitClassifier {
  return {
    async classify(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: buildMessages(input),
            temperature: 0,
          }),
          signal: controller.signal,
        });
        if (!res.ok) return { ok: false, error: "unreachable" };
        const data = (await res.json()) as {
          choices?: { message?: { content?: unknown } }[];
        };
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string")
          return { ok: false, error: "bad_response" };
        const goalId = parseGoalId(content);
        if (goalId === null) return { ok: true, goalId: null };
        if (!input.candidates.some((c) => c.id === goalId)) {
          return { ok: false, error: "bad_response" };
        }
        return { ok: true, goalId };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, error: "timeout" };
        }
        return { ok: false, error: "unreachable" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Mapa sha→goalId fixo (testes de integração da atribuição). */
export function createStubClassifier(
  map: Record<string, string | null>,
): CommitClassifier {
  return {
    classify: async (input) => ({
      ok: true,
      goalId: map[input.commit.sha] ?? null,
    }),
  };
}

/** Sempre indisponível → o orquestrador cai no resolver determinístico. */
export function createOfflineClassifier(): CommitClassifier {
  return {
    classify: async () => ({ ok: false, error: "unreachable" }),
  };
}

/**
 * Classificador via MCP. A fiação do transporte MCP-como-cliente é evolução futura; por ora
 * comporta-se como offline (cai no determinístico) p/ não quebrar o boot quando KIND=mcp.
 */
export function createMcpClassifier(_cfg: {
  baseUrl: string;
  timeoutMs: number;
}): CommitClassifier {
  return createOfflineClassifier();
}

/** Resolve o classificador a partir do ambiente (default `none` → offline). */
export function resolveClassifier(): CommitClassifier {
  if (env.LLM_CLASSIFIER_KIND === "http") {
    if (!env.LLM_CLASSIFIER_BASE_URL || !env.LLM_CLASSIFIER_MODEL) {
      return createOfflineClassifier();
    }
    return createHttpClassifier({
      baseUrl: env.LLM_CLASSIFIER_BASE_URL,
      model: env.LLM_CLASSIFIER_MODEL,
      timeoutMs: env.LLM_CLASSIFIER_TIMEOUT_MS,
      apiKey: env.LLM_CLASSIFIER_API_KEY,
    });
  }
  if (env.LLM_CLASSIFIER_KIND === "mcp") {
    if (!env.LLM_CLASSIFIER_BASE_URL) return createOfflineClassifier();
    return createMcpClassifier({
      baseUrl: env.LLM_CLASSIFIER_BASE_URL,
      timeoutMs: env.LLM_CLASSIFIER_TIMEOUT_MS,
    });
  }
  return createOfflineClassifier();
}
