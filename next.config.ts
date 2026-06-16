import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes nativos/de servidor não devem ser empacotados pelo bundler do Next:
  // argon2 (binário napi-rs), Prisma e ioredis rodam só no runtime Node.
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "ioredis"],
};

export default nextConfig;
