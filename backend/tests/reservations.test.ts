import request from "supertest";
import { describe, expect, it } from "vitest";
import { ReservationStatus } from "../src/generated/prisma/enums";
import { app } from "../src/app";
import { prisma } from "../src/config/prisma";

const CUSTOMER_EMAIL = "customer@eventbooking.local";
const ADMIN_EMAIL = "admin@eventbooking.local";

async function getReservationTestTicketType() {
  const eventsResponse = await request(app).get("/events");
  const eventId =
    eventsResponse.body.data[eventsResponse.body.data.length - 1].id;

  const detailResponse = await request(app).get(`/events/${eventId}`);
  const ticketType = detailResponse.body.data.ticketTypes[0];

  return {
    eventId,
    ticketType,
  };
}

async function deleteReservation(id: string) {
  await prisma.reservation.delete({
    where: {
      id,
    },
  });
}

describe("reservation creation API", () => {
  it("creates a pending reservation for an authenticated customer", async () => {
    const { eventId, ticketType } = await getReservationTestTicketType();

    const response = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", CUSTOMER_EMAIL)
      .send({
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity: 2,
          },
        ],
      });

    try {
      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          status: ReservationStatus.pending,
          expiresAt: expect.any(String),
          items: [
            expect.objectContaining({
              eventId,
              ticketTypeId: ticketType.id,
              quantity: 2,
            }),
          ],
        }),
      );
      expect(new Date(response.body.data.expiresAt).getTime()).toBeGreaterThan(
        Date.now(),
      );
    } finally {
      if (response.body.data?.id) {
        await deleteReservation(response.body.data.id);
      }
    }
  });

  it("returns the existing reservation for a repeated idempotency key", async () => {
    const { ticketType } = await getReservationTestTicketType();
    const idempotencyKey = `reservation-test-${Date.now()}`;
    const payload = {
      idempotencyKey,
      items: [
        {
          ticketTypeId: ticketType.id,
          quantity: 1,
        },
      ],
    };

    const firstResponse = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", CUSTOMER_EMAIL)
      .send(payload);

    try {
      const secondResponse = await request(app)
        .post("/reservations")
        .set("x-demo-user-email", CUSTOMER_EMAIL)
        .send(payload);

      const matchingReservations = await prisma.reservation.findMany({
        where: {
          idempotencyKey,
        },
      });

      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.id).toBe(firstResponse.body.data.id);
      expect(matchingReservations).toHaveLength(1);
    } finally {
      if (firstResponse.body.data?.id) {
        await deleteReservation(firstResponse.body.data.id);
      }
    }
  });

  it("rejects reservation creation without demo auth", async () => {
    const { ticketType } = await getReservationTestTicketType();

    const response = await request(app)
      .post("/reservations")
      .send({
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: "Missing x-demo-user-email header",
      },
    });
  });

  it("rejects non-customer users", async () => {
    const { ticketType } = await getReservationTestTicketType();

    const response = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", ADMIN_EMAIL)
      .send({
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: "Insufficient role permissions",
      },
    });
  });

  it("rejects invalid quantities", async () => {
    const { ticketType } = await getReservationTestTicketType();

    const response = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", CUSTOMER_EMAIL)
      .send({
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity: 0,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: "Invalid reservation request",
      },
    });
  });

  it("rejects unknown ticket types", async () => {
    const response = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", CUSTOMER_EMAIL)
      .send({
        items: [
          {
            ticketTypeId: "not-a-real-ticket-type",
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: "One or more ticket types are unavailable",
      },
    });
  });

  it("returns conflict when requested quantity exceeds availability", async () => {
    const { ticketType } = await getReservationTestTicketType();

    const response = await request(app)
      .post("/reservations")
      .set("x-demo-user-email", CUSTOMER_EMAIL)
      .send({
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity: ticketType.availableQuantity + 1,
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        message: "Insufficient ticket availability",
      },
    });
  });
});
