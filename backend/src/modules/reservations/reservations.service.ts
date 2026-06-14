import { EventStatus, ReservationStatus } from "../../generated/prisma/enums";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import { HttpError } from "../../shared/errors/http-error";
import { getTicketTypeAvailability } from "../events/availability.service";
import { trackReservationExpiry } from "./reservation-expiry-tracker";
import type { CreateReservationInput } from "./reservations.validation";

const RESERVATION_EXPIRY_MS = 5 * 60 * 1000;

type ReservationWithItems = {
  id: string;
  status: ReservationStatus;
  expiresAt: Date;
  idempotencyKey: string | null;
  items: Array<{
    id: string;
    ticketTypeId: string;
    quantity: number;
    ticketType: {
      eventId: string;
      name: string;
    };
  }>;
};

type LockedTicketType = {
  id: string;
  capacity: number;
};

function mapReservation(reservation: ReservationWithItems) {
  return {
    id: reservation.id,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    idempotencyKey: reservation.idempotencyKey,
    items: reservation.items.map((item) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId,
      ticketTypeName: item.ticketType.name,
      eventId: item.ticketType.eventId,
      quantity: item.quantity,
    })),
  };
}

function mergeRequestedItems(items: CreateReservationInput["items"]) {
  const quantityByTicketTypeId = new Map<string, number>();

  for (const item of items) {
    quantityByTicketTypeId.set(
      item.ticketTypeId,
      (quantityByTicketTypeId.get(item.ticketTypeId) ?? 0) + item.quantity,
    );
  }

  return [...quantityByTicketTypeId.entries()].map(
    ([ticketTypeId, quantity]) => ({
      ticketTypeId,
      quantity,
    }),
  );
}

async function findExistingIdempotentReservation(
  userId: string,
  idempotencyKey?: string,
) {
  if (!idempotencyKey) {
    return null;
  }

  return prisma.reservation.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
    include: {
      items: {
        include: {
          ticketType: {
            select: {
              eventId: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function createReservation(
  userId: string,
  input: CreateReservationInput,
) {
  const existingReservation = await findExistingIdempotentReservation(
    userId,
    input.idempotencyKey,
  );

  if (existingReservation) {
    return {
      created: false,
      data: mapReservation(existingReservation),
    };
  }

  const requestedItems = mergeRequestedItems(input.items);
  const ticketTypeIds = requestedItems.map((item) => item.ticketTypeId);
  const now = new Date();

  const reservation = await prisma.$transaction(async (tx) => {
    const ticketTypes = await tx.$queryRaw<LockedTicketType[]>`
      SELECT tt.id, tt.capacity
      FROM "ticket_types" tt
      INNER JOIN "events" e ON e.id = tt."eventId"
      WHERE tt.id IN (${Prisma.join(ticketTypeIds)})
        AND e."startsAt" >= ${now}
        AND e.status = ${EventStatus.published}::"EventStatus"
      ORDER BY tt.id
      FOR UPDATE OF tt
    `;

    if (ticketTypes.length !== ticketTypeIds.length) {
      throw new HttpError(400, "One or more ticket types are unavailable");
    }

    const availabilityByTicketTypeId = await getTicketTypeAvailability(
      ticketTypes,
      now,
      tx,
    );

    for (const item of requestedItems) {
      const availability = availabilityByTicketTypeId.get(item.ticketTypeId);

      if (!availability || item.quantity > availability.availableQuantity) {
        throw new HttpError(409, "Insufficient ticket availability");
      }
    }

    return tx.reservation.create({
      data: {
        expiresAt: new Date(now.getTime() + RESERVATION_EXPIRY_MS),
        status: ReservationStatus.pending,
        userId,
        ...(input.idempotencyKey
          ? {
              idempotencyKey: input.idempotencyKey,
            }
          : {}),
        items: {
          create: requestedItems.map((item) => ({
            quantity: item.quantity,
            ticketTypeId: item.ticketTypeId,
          })),
        },
      },
      include: {
        items: {
          include: {
            ticketType: {
              select: {
                eventId: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  });

  trackReservationExpiry(reservation).catch((error) => {
    console.error("Failed to track reservation expiry in Redis", error);
  });

  return {
    created: true,
    data: mapReservation(reservation),
  };
}
