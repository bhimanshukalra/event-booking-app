import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { UserRole } from "../src/generated/prisma/enums.js";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const customerEmail = "customer@eventbooking.local";
const adminEmail = "admin@eventbooking.local";
const staffEmail = "staff@eventbooking.local";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("demo auth and roles", () => {
  it("returns seeded demo users for user selection", async () => {
    const response = await request(app).get("/auth/demo-users");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: customerEmail,
          role: UserRole.customer,
        }),
        expect.objectContaining({
          email: adminEmail,
          role: UserRole.admin,
        }),
        expect.objectContaining({
          email: staffEmail,
          role: UserRole.staff,
        }),
      ]),
    );
  });

  it("attaches the active demo user from the request header", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("x-demo-user-email", customerEmail);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: customerEmail,
        role: UserRole.customer,
      }),
    );
  });

  it("returns unauthorized when a protected route has no demo user header", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: "Missing x-demo-user-email header",
      },
    });
  });

  it("returns unauthorized when the demo user does not exist", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("x-demo-user-email", "unknown@eventbooking.local");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: "Demo user not found",
      },
    });
  });

  it("allows admin users through admin-only routes", async () => {
    const response = await request(app)
      .get("/auth/admin-check")
      .set("x-demo-user-email", adminEmail);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      role: UserRole.admin,
      allowed: true,
    });
  });

  it("rejects customer users from admin-only routes", async () => {
    const response = await request(app)
      .get("/auth/admin-check")
      .set("x-demo-user-email", customerEmail);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: "Insufficient role permissions",
      },
    });
  });

  it("allows staff users through staff-only routes", async () => {
    const response = await request(app)
      .get("/auth/staff-check")
      .set("x-demo-user-email", staffEmail);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      role: UserRole.staff,
      allowed: true,
    });
  });

  it("rejects customer users from staff-only routes", async () => {
    const response = await request(app)
      .get("/auth/staff-check")
      .set("x-demo-user-email", customerEmail);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: "Insufficient role permissions",
      },
    });
  });
});
