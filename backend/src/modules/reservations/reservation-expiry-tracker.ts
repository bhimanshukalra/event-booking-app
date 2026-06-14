import { getRedisClient } from "../../config/redis";

const RESERVATION_EXPIRY_ZSET_KEY = "reservations:expiring";
const RESERVATION_EXPIRY_KEY_PREFIX = "reservation:expiry";

type ReservationExpiryInput = {
  expiresAt: Date;
  id: string;
};

function getReservationExpiryKey(reservationId: string) {
  return `${RESERVATION_EXPIRY_KEY_PREFIX}:${reservationId}`;
}

export async function trackReservationExpiry({
  expiresAt,
  id,
}: ReservationExpiryInput) {
  const redis = getRedisClient();

  if (!redis?.isReady) {
    return;
  }

  const ttlSeconds = Math.max(
    Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    1,
  );

  await Promise.all([
    redis.setEx(
      getReservationExpiryKey(id),
      ttlSeconds,
      expiresAt.toISOString(),
    ),
    redis.zAdd(RESERVATION_EXPIRY_ZSET_KEY, {
      score: expiresAt.getTime(),
      value: id,
    }),
  ]);
}
