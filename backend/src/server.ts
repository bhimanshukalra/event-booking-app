import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import {
  connectRedis,
  disconnectRedis,
  isRedisConfigured,
} from "./config/redis";

const server = app.listen(env.PORT, () => {
  console.log(`Backend API listening on http://localhost:${env.PORT}`);
});

if (isRedisConfigured()) {
  void connectRedis()
    .then(() => {
      console.log("Redis connection established.");
    })
    .catch((error) => {
      console.error(
        "Redis connection failed; continuing with PostgreSQL correctness.",
        error,
      );
    });
}

async function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down backend API.`);
  server.close(async () => {
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
