import { ReservationStatus } from "../../generated/prisma/enums";
import { prisma } from "../../config/prisma";

type TicketTypeCapacity = {
  id: string;
  capacity: number;
};

export type TicketTypeAvailability = {
  availableQuantity: number;
  capacity: number;
  confirmedSoldQuantity: number;
  reservedQuantity: number;
};

export async function getTicketTypeAvailability(
  ticketTypes: TicketTypeCapacity[],
  now = new Date(),
) {
  const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id);

  if (ticketTypeIds.length === 0) {
    return new Map<string, TicketTypeAvailability>();
  }

  const activeReservationCounts = await prisma.reservationItem.groupBy({
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

  const confirmedReservationCounts = await prisma.reservationItem.groupBy({
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

  return new Map(
    ticketTypes.map((ticketType) => {
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
}
