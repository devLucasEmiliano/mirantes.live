import { describe, expect, it } from "vitest";
import {
  type CandidateGoal,
  createHttpClassifier,
  createOfflineClassifier,
  createStubClassifier,
} from "@/lib/goals/classifier";

const candidates: CandidateGoal[] = [
  { id: "g1", shortCode: "M-1", title: "X" },
];
const input = {
  commit: {
    sha: "a1",
    message: "feat",
    author: "Ana",
    isMerge: false,
    branch: "main",
  },
  candidates,
  hint: null,
};

// resposta OpenAI-compatível com o conteúdo do assistant em JSON
const chat = (content: string) =>
  ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as Response;

describe("createStubClassifier / offline", () => {
  it("stub devolve o goalId mapeado", async () => {
    const c = createStubClassifier({ a1: "g1" });
    expect(await c.classify(input)).toEqual({ ok: true, goalId: "g1" });
  });
  it("offline sempre unreachable", async () => {
    expect(await createOfflineClassifier().classify(input)).toEqual({
      ok: false,
      error: "unreachable",
    });
  });
});

describe("createHttpClassifier (fetch injetado)", () => {
  const cfg = { baseUrl: "http://x/v1", model: "m", timeoutMs: 50 };
  it("goalId válido entre os candidates → ok", async () => {
    const c = createHttpClassifier(cfg, async () => chat('{"goalId":"g1"}'));
    expect(await c.classify(input)).toEqual({ ok: true, goalId: "g1" });
  });
  it("goalId fora dos candidates → bad_response", async () => {
    const c = createHttpClassifier(cfg, async () => chat('{"goalId":"zzz"}'));
    expect(await c.classify(input)).toEqual({
      ok: false,
      error: "bad_response",
    });
  });
  it("timeout (AbortError) → timeout", async () => {
    const c = createHttpClassifier(cfg, async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    expect(await c.classify(input)).toEqual({ ok: false, error: "timeout" });
  });
  it("erro de rede → unreachable", async () => {
    const c = createHttpClassifier(cfg, async () => {
      throw new TypeError("fetch failed");
    });
    expect(await c.classify(input)).toEqual({
      ok: false,
      error: "unreachable",
    });
  });
});
