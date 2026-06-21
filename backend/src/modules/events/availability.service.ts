import { ReservationStatus } from "../../generated/prisma/enums";
import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import {
  readTicketTypeAvailabilityCache,
  writeTicketTypeAvailabilityCache,
} from "./inventory-cache";

type TicketTypeCapacity = {
  id: string;
  capacity: number;
};

type PrismaReader = typeof prisma | Prisma.TransactionClient;

export type TicketTypeAvailability = {
  availableQuantity: number;
  capacity: number;
  confirmedSoldQuantity: number;
  reservedQuantity: number;
};

export async function getTicketTypeAvailability(
  ticketTypes: TicketTypeCapacity[],
  now = new Date(),
  client: PrismaReader = prisma,
) {
  let ticketTypesToQuery = ticketTypes;
  const shouldUseCache = client === prisma;
  const cachedAvailabilityByTicketTypeId = new Map<
    string,
    TicketTypeAvailability
  >();

  if (shouldUseCache) {
    const cacheResult = await readTicketTypeAvailabilityCache(ticketTypes);

    ticketTypesToQuery = cacheResult.missingTicketTypes;
    for (const [
      ticketTypeId,
      cachedAvailability,
    ] of cacheResult.cachedAvailabilityByTicketTypeId) {
      cachedAvailabilityByTicketTypeId.set(ticketTypeId, cachedAvailability);
    }
  }

  const ticketTypeIds = ticketTypesToQuery.map((ticketType) => ticketType.id);

  if (ticketTypes.length === 0) {
    return cachedAvailabilityByTicketTypeId;
  }

  if (ticketTypeIds.length === 0) {
    return cachedAvailabilityByTicketTypeId;
  }

  const activeReservationCounts = await client.reservationItem.groupBy({
    by: ["ticketTypeId"],
    where: {
      reservation: {
        expiresAt: {
          gt: now,
        },
        status: ReservationStatus.pending,
      },
      ticketTypeId: {
        in: ticketTypeIds,
      },
    },
    _sum: {
      quantity: true,
    },
  });

  const confirmedReservationCounts = await client.reservationItem.groupBy({
    by: ["ticketTypeId"],
    where: {
      reservation: {
        status: ReservationStatus.confirmed,
      },
      ticketTypeId: {
        in: ticketTypeIds,
      },
    },
    _sum: {
      quantity: true,
    },
  });

  const reservedQuantityByTicketTypeId = new Map(
    activeReservationCounts.map((count) => [
      count.ticketTypeId,
      count._sum.quantity ?? 0,
    ]),
  );
  const confirmedSoldQuantityByTicketTypeId = new Map(
    confirmedReservationCounts.map((count) => [
      count.ticketTypeId,
      count._sum.quantity ?? 0,
    ]),
  );

  const queriedAvailabilityByTicketTypeId = new Map(
    ticketTypesToQuery.map((ticketType) => {
      const reservedQuantity =
        reservedQuantityByTicketTypeId.get(ticketType.id) ?? 0;
      const confirmedSoldQuantity =
        confirmedSoldQuantityByTicketTypeId.get(ticketType.id) ?? 0;
      const availableQuantity = Math.max(
        ticketType.capacity - reservedQuantity - confirmedSoldQuantity,
        0,
      );

      return [
        ticketType.id,
        {
          availableQuantity,
          capacity: ticketType.capacity,
          confirmedSoldQuantity,
          reservedQuantity,
        },
      ];
    }),
  );

  if (shouldUseCache) {
    await writeTicketTypeAvailabilityCache(queriedAvailabilityByTicketTypeId);
  }

  return new Map([
    ...cachedAvailabilityByTicketTypeId,
    ...queriedAvailabilityByTicketTypeId,
  ]);
}
