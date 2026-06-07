import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, () => {
  console.log(`Backend API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down backend API.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
