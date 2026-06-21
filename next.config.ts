import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes nativos/de servidor não devem ser empacotados pelo bundler do Next:
  // argon2 (binário napi-rs), Prisma e ioredis rodam só no runtime Node. O SDK do MCP
  // (spec 020, route `/api/mcp`) traz uma cópia aninhada de zod + módulos `node:` — externo
  // p/ o bundler não reescrevê-los; roda só no runtime Node.
  serverExternalPackages: [
    "@prisma/client",
    "@node-rs/argon2",
    "ioredis",
    "@modelcontextprotocol/sdk",
  ],
};

export default nextConfig;
