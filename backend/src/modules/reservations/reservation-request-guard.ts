import { createHash } from "node:crypto";
import { getRedisClient } from "../../config/redis";
import type { CreateReservationInput } from "./reservations.validation";

const RESERVATION_REQUEST_GUARD_PREFIX = "reservation:request-guard";
const RESERVATION_REQUEST_GUARD_TTL_SECONDS = 15;

type ReservationRequestGuardInput = {
  items: CreateReservationInput["items"];
  userId: string;
};

function getReservationRequestGuardKey({
  items,
  userId,
}: ReservationRequestGuardInput) {
  const normalizedItems = [...items]
    .sort((left, right) => left.ticketTypeId.localeCompare(right.ticketTypeId))
    .map((item) => `${item.ticketTypeId}:${item.quantity}`)
    .join("|");
  const digest = createHash("sha256")
    .update(`${userId}:${normalizedItems}`)
    .digest("hex");

  return `${RESERVATION_REQUEST_GUARD_PREFIX}:${digest}`;
}

export async function acquireReservationRequestGuard(
  input: ReservationRequestGuardInput,
) {
  const redis = getRedisClient();

  if (!redis?.isReady) {
    return null;
  }

  const key = getReservationRequestGuardKey(input);
  let result: string | null;

  try {
    result = await redis.set(key, "1", {
      expiration: {
        type: "EX",
        value: RESERVATION_REQUEST_GUARD_TTL_SECONDS,
      },
      condition: "NX",
    });
  } catch (error) {
    console.error(
      "Reservation request guard failed; continuing with PostgreSQL correctness.",
      error,
    );
    return null;
  }

  if (result !== "OK") {
    return {
      acquired: false,
      key,
    };
  }

  return {
    acquired: true,
    key,
  };
}

export async function releaseReservationRequestGuard(key: string | null) {
  const redis = getRedisClient();

  if (!key || !redis?.isReady) {
    return;
  }

  await redis.del(key);
}
