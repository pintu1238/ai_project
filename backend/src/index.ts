import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureStorageDirs } from "./lib/storage.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  await ensureStorageDirs();
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`ContentFlow API listening on http://localhost:${env.PORT}`);
  });
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
