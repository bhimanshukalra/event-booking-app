import { EventStatus } from "../../generated/prisma/enums";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../shared/errors/http-error";
import {
  getTicketTypeAvailability,
  type TicketTypeAvailability,
} from "./availability.service";

function getAvailabilityStatus(totalAvailableQuantity: number) {
  return totalAvailableQuantity > 0 ? "available" : "sold_out";
}

function mapEventListItem(
  event: Awaited<ReturnType<typeof findPublishedEvents>>[number],
  availabilityByTicketTypeId: Map<string, TicketTypeAvailability>,
) {
  const minTicketPrice = event.ticketTypes.reduce<number | null>(
    (currentMin, ticketType) =>
      currentMin === null
        ? ticketType.priceCents
        : Math.min(currentMin, ticketType.priceCents),
    null,
  );
  const totalCapacity = event.ticketTypes.reduce(
    (sum, ticketType) => sum + ticketType.capacity,
    0,
  );
  const totalAvailableQuantity = event.ticketTypes.reduce(
    (sum, ticketType) =>
      sum +
      (availabilityByTicketTypeId.get(ticketType.id)?.availableQuantity ??
        ticketType.capacity),
    0,
  );

  return {
    id: event.id,
    title: event.title,
    category: event.category,
    startsAt: event.startsAt.toISOString(),
    venueName: event.venue.name,
    city: event.venue.city,
    heroImageUrl: event.heroImageUrl,
    minPriceCents: minTicketPrice,
    currency: event.ticketTypes[0]?.currency ?? "USD",
    availabilityStatus: getAvailabilityStatus(
      totalCapacity === 0 ? 0 : totalAvailableQuantity,
    ),
  };
}

function mapEventDetail(
  event: NonNullable<Awaited<ReturnType<typeof findEventById>>>,
  availabilityByTicketTypeId: Map<string, TicketTypeAvailability>,
) {
  const totalAvailableQuantity = event.ticketTypes.reduce(
    (sum, ticketType) =>
      sum +
      (availabilityByTicketTypeId.get(ticketType.id)?.availableQuantity ??
        ticketType.capacity),
    0,
  );

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    heroImageUrl: event.heroImageUrl,
    venue: {
      id: event.venue.id,
      name: event.venue.name,
      address: event.venue.address,
      city: event.venue.city,
      state: event.venue.state,
      country: event.venue.country,
    },
    ticketTypes: event.ticketTypes.map((ticketType) => ({
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      priceCents: ticketType.priceCents,
      currency: ticketType.currency,
      capacity: ticketType.capacity,
      availableQuantity:
        availabilityByTicketTypeId.get(ticketType.id)?.availableQuantity ??
        ticketType.capacity,
      reservedQuantity:
        availabilityByTicketTypeId.get(ticketType.id)?.reservedQuantity ?? 0,
      confirmedSoldQuantity:
        availabilityByTicketTypeId.get(ticketType.id)?.confirmedSoldQuantity ??
        0,
    })),
    availabilityStatus: getAvailabilityStatus(totalAvailableQuantity),
  };
}

function findPublishedEvents() {
  return prisma.event.findMany({
    where: {
      status: EventStatus.published,
      startsAt: {
        gte: new Date(),
      },
    },
    include: {
      venue: true,
      ticketTypes: {
        orderBy: {
          priceCents: "asc",
        },
      },
    },
    orderBy: {
      startsAt: "asc",
    },
  });
}

function findEventById(id: string) {
  return prisma.event.findFirst({
    where: {
      id,
      status: EventStatus.published,
      startsAt: {
        gte: new Date(),
      },
    },
    include: {
      venue: true,
      ticketTypes: {
        orderBy: {
          priceCents: "asc",
        },
      },
    },
  });
}

export async function listEvents() {
  const events = await findPublishedEvents();
  const availabilityByTicketTypeId = await getTicketTypeAvailability(
    events.flatMap((event) => event.ticketTypes),
  );

  return {
    data: events.map((event) =>
      mapEventListItem(event, availabilityByTicketTypeId),
    ),
  };
}

export async function getEventById(id: string) {
  const event = await findEventById(id);

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return {
    data: mapEventDetail(
      event,
      await getTicketTypeAvailability(event.ticketTypes),
    ),
  };
}
