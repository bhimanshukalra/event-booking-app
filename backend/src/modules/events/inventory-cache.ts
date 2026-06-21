import { getRedisClient } from "../../config/redis";
import type { TicketTypeAvailability } from "./availability.service";

const TICKET_TYPE_AVAILABILITY_CACHE_PREFIX = "inventory:ticket-type";
const TICKET_TYPE_AVAILABILITY_CACHE_TTL_SECONDS = 15;

type TicketTypeCapacity = {
  id: string;
  capacity: number;
};

function getTicketTypeAvailabilityCacheKey(ticketTypeId: string) {
  return `${TICKET_TYPE_AVAILABILITY_CACHE_PREFIX}:${ticketTypeId}`;
}

function parseCachedAvailability(
  rawValue: string | null,
  ticketType: TicketTypeCapacity,
) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TicketTypeAvailability>;

    if (
      parsed.capacity !== ticketType.capacity ||
      typeof parsed.availableQuantity !== "number" ||
      typeof parsed.confirmedSoldQuantity !== "number" ||
      typeof parsed.reservedQuantity !== "number"
    ) {
      return null;
    }

    return {
      availableQuantity: parsed.availableQuantity,
      capacity: parsed.capacity,
      confirmedSoldQuantity: parsed.confirmedSoldQuantity,
      reservedQuantity: parsed.reservedQuantity,
    };
  } catch {
    return null;
  }
}

export async function readTicketTypeAvailabilityCache(
  ticketTypes: TicketTypeCapacity[],
) {
  const redis = getRedisClient();
  const cachedAvailabilityByTicketTypeId = new Map<
    string,
    TicketTypeAvailability
  >();

  if (!redis?.isReady || ticketTypes.length === 0) {
    return {
      cachedAvailabilityByTicketTypeId,
      missingTicketTypes: ticketTypes,
    };
  }

  try {
    const cachedValues = await redis.mGet(
      ticketTypes.map((ticketType) =>
        getTicketTypeAvailabilityCacheKey(ticketType.id),
      ),
    );

    const missingTicketTypes: TicketTypeCapacity[] = [];

    for (const [index, ticketType] of ticketTypes.entries()) {
      const cachedAvailability = parseCachedAvailability(
        cachedValues[index] ?? null,
        ticketType,
      );

      if (!cachedAvailability) {
        missingTicketTypes.push(ticketType);
        continue;
      }

      cachedAvailabilityByTicketTypeId.set(ticketType.id, cachedAvailability);
    }

    return {
      cachedAvailabilityByTicketTypeId,
      missingTicketTypes,
    };
  } catch (error) {
    console.error(
      "Redis inventory availability cache read failed; falling back to PostgreSQL.",
      error,
    );

    return {
      cachedAvailabilityByTicketTypeId: new Map<string, TicketTypeAvailability>(),
      missingTicketTypes: ticketTypes,
    };
  }
}

export async function writeTicketTypeAvailabilityCache(
  availabilityByTicketTypeId: Map<string, TicketTypeAvailability>,
) {
  const redis = getRedisClient();

  if (!redis?.isReady || availabilityByTicketTypeId.size === 0) {
    return;
  }

  try {
    await Promise.all(
      [...availabilityByTicketTypeId.entries()].map(
        ([ticketTypeId, availability]) =>
          redis.setEx(
            getTicketTypeAvailabilityCacheKey(ticketTypeId),
            TICKET_TYPE_AVAILABILITY_CACHE_TTL_SECONDS,
            JSON.stringify(availability),
          ),
      ),
    );
  } catch (error) {
    console.error(
      "Redis inventory availability cache write failed; continuing with PostgreSQL correctness.",
      error,
    );
  }
}

export async function invalidateTicketTypeAvailabilityCache(
  ticketTypeIds: string[],
) {
  const redis = getRedisClient();

  if (!redis?.isReady || ticketTypeIds.length === 0) {
    return;
  }

  try {
    await redis.del(
      ticketTypeIds.map((ticketTypeId) =>
        getTicketTypeAvailabilityCacheKey(ticketTypeId),
      ),
    );
  } catch (error) {
    console.error(
      "Redis inventory availability cache invalidation failed; continuing with PostgreSQL correctness.",
      error,
    );
  }
}
