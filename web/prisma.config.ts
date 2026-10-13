import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 마이그레이션 같은 CLI 작업은 풀러를 거치지 않는 직접 연결 주소를 쓴다 (Neon 권장)
    url: env("DIRECT_URL"),
  },
});
