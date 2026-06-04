import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

afterAll(async () => {
  await prisma.$disconnect();
});

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
