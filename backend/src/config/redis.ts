import { createClient } from "redis";
import { env } from "./env";

let redisClient: ReturnType<typeof createClient> | null = null;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: env.REDIS_URL,
    });

    redisClient.on("error", (error) => {
      console.error("Redis client error", error);
    });
  }

  return redisClient;
}

export async function connectRedis() {
  const client = getRedisClient();

  if (!client) {
    return null;
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function disconnectRedis() {
  const client = getRedisClient();

  if (client?.isOpen) {
    await client.quit();
  }
}
