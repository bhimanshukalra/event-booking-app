import request from "supertest";
import { describe, expect, it } from "vitest";
import { ReservationStatus } from "../src/generated/prisma/enums.js";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const customerEmail = "customer@eventbooking.local";

async function getFirstEventTicketType() {
  const eventsResponse = await request(app).get("/events");
  const eventId = eventsResponse.body.data[0].id;

  const detailResponse = await request(app).get(`/events/${eventId}`);
  const ticketType = detailResponse.body.data.ticketTypes[0];

  return {
    eventId,
    ticketType,
  };
}

async function createPendingReservation({
  expiresAt,
  quantity,
  ticketTypeId,
}: {
  expiresAt: Date;
  quantity: number;
  ticketTypeId: string;
}) {
  const customer = await prisma.user.findUniqueOrThrow({
    where: {
      email: customerEmail,
    },
  });

  return prisma.reservation.create({
    data: {
      expiresAt,
      status: ReservationStatus.pending,
      userId: customer.id,
      items: {
        create: {
          quantity,
          ticketTypeId,
        },
      },
    },
  });
}

describe("foundation API smoke tests", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
    });
  });

  it("returns a list of published upcoming events", async () => {
    const response = await request(app).get("/events");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        category: expect.any(String),
        startsAt: expect.any(String),
        venueName: expect.any(String),
        city: expect.any(String),
        availabilityStatus: expect.any(String),
      }),
    );
  });

  it("returns event detail for an existing event", async () => {
    const eventsResponse = await request(app).get("/events");
    const eventId = eventsResponse.body.data[0].id;

    const response = await request(app).get(`/events/${eventId}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: eventId,
        title: expect.any(String),
        description: expect.any(String),
        venue: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          city: expect.any(String),
        }),
        ticketTypes: expect.any(Array),
        availabilityStatus: expect.any(String),
      }),
    );
    expect(response.body.data.ticketTypes.length).toBeGreaterThan(0);
    expect(response.body.data.ticketTypes[0]).toEqual(
      expect.objectContaining({
        capacity: expect.any(Number),
        availableQuantity: expect.any(Number),
        reservedQuantity: expect.any(Number),
        confirmedSoldQuantity: expect.any(Number),
      }),
    );
  });

  it("reduces ticket availability for active pending reservations", async () => {
    const { eventId, ticketType } = await getFirstEventTicketType();
    const reservation = await createPendingReservation({
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      quantity: 2,
      ticketTypeId: ticketType.id,
    });

    try {
      const response = await request(app).get(`/events/${eventId}`);
      const updatedTicketType = response.body.data.ticketTypes.find(
        (candidate: { id: string }) => candidate.id === ticketType.id,
      );

      expect(response.status).toBe(200);
      expect(updatedTicketType).toEqual(
        expect.objectContaining({
          availableQuantity: ticketType.availableQuantity - 2,
          reservedQuantity: ticketType.reservedQuantity + 2,
        }),
      );
    } finally {
      await prisma.reservation.delete({
        where: {
          id: reservation.id,
        },
      });
    }
  });

  it("ignores expired pending reservations in ticket availability", async () => {
    const { eventId, ticketType } = await getFirstEventTicketType();
    const reservation = await createPendingReservation({
      expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      quantity: 3,
      ticketTypeId: ticketType.id,
    });

    try {
      const response = await request(app).get(`/events/${eventId}`);
      const updatedTicketType = response.body.data.ticketTypes.find(
        (candidate: { id: string }) => candidate.id === ticketType.id,
      );

      expect(response.status).toBe(200);
      expect(updatedTicketType).toEqual(
        expect.objectContaining({
          availableQuantity: ticketType.availableQuantity,
          reservedQuantity: ticketType.reservedQuantity,
        }),
      );
    } finally {
      await prisma.reservation.delete({
        where: {
          id: reservation.id,
        },
      });
    }
  });

  it("returns not found for an unknown event", async () => {
    const response = await request(app).get("/events/not-a-real-event");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        message: "Event not found",
      },
    });
  });
});
