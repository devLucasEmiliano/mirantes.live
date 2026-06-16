import { redis } from "./redis";

// Snapshot público da home `/` (SPEC §1/§4: cache opcional no Redis; o Postgres
// segue sendo a fonte de verdade do negócio). Conteúdo estático e não sensível:
// nome do projeto, tagline, flag "no ar" e quando foi gerado.
const SNAPSHOT_KEY = "home:snapshot";

export interface HomeSnapshot {
  projectName: string;
  tagline: string;
  /** "No ar" — controla o selo AO VIVO na home. */
  live: boolean;
  /** ISO 8601 de quando o snapshot foi escrito (pelo seed). */
  updatedAt: string;
}

// Exibido quando a chave não existe ou o Redis está fora: a home sempre renderiza.
// `live: false` deixa explícito que não há snapshot fresco no Redis.
const FALLBACK_SNAPSHOT: HomeSnapshot = {
  projectName: "GuiaGoals",
  tagline: "Acompanhe o progresso do seu projeto.",
  live: false,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/** Monta o snapshot atual (valores fixos + timestamp de agora). Usado pelo seed. */
export function buildHomeSnapshot(): HomeSnapshot {
  return {
    projectName: "GuiaGoals Dashboard",
    tagline: "Acompanhe o progresso do seu projeto em tempo real.",
    live: true,
    updatedAt: new Date().toISOString(),
  };
}

/** Grava o snapshot no Redis (`home:snapshot`). Retorna o que foi gravado. */
export async function writeHomeSnapshot(
  snapshot: HomeSnapshot = buildHomeSnapshot(),
): Promise<HomeSnapshot> {
  await redis.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

/** Lê o snapshot do Redis; cai no fallback se ausente ou se o Redis falhar. */
export async function readHomeSnapshot(): Promise<HomeSnapshot> {
  try {
    const raw = await redis.get(SNAPSHOT_KEY);
    if (!raw) return FALLBACK_SNAPSHOT;
    return JSON.parse(raw) as HomeSnapshot;
  } catch (error) {
    console.error("[home-snapshot] leitura falhou, usando fallback:", error);
    return FALLBACK_SNAPSHOT;
  }
}
