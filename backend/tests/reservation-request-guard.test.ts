import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  del: vi.fn(),
  isReady: true,
  set: vi.fn(),
}));

const getRedisClientMock = vi.hoisted(() => vi.fn());

vi.mock("../src/config/redis", () => ({
  getRedisClient: getRedisClientMock,
}));

import {
  acquireReservationRequestGuard,
  releaseReservationRequestGuard,
} from "../src/modules/reservations/reservation-request-guard";

const guardInput = {
  userId: "user_1",
  items: [
    {
      ticketTypeId: "ticket_b",
      quantity: 2,
    },
    {
      ticketTypeId: "ticket_a",
      quantity: 1,
    },
  ],
};

describe("reservation request guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClientMock.mockReturnValue(redisMock);
    redisMock.isReady = true;
  });

  it("acquires a short-lived Redis guard for normalized reservation items", async () => {
    redisMock.set.mockResolvedValue("OK");

    const result = await acquireReservationRequestGuard(guardInput);

    expect(result).toEqual({
      acquired: true,
      key: expect.stringMatching(/^reservation:request-guard:/),
    });
    expect(redisMock.set).toHaveBeenCalledWith(expect.any(String), "1", {
      condition: "NX",
      expiration: {
        type: "EX",
        value: 15,
      },
    });
  });

  it("reports an active duplicate reservation guard", async () => {
    redisMock.set.mockResolvedValue(null);

    const result = await acquireReservationRequestGuard(guardInput);

    expect(result).toEqual({
      acquired: false,
      key: expect.stringMatching(/^reservation:request-guard:/),
    });
  });

  it("skips Redis when the client is unavailable", async () => {
    getRedisClientMock.mockReturnValue(null);

    await expect(
      acquireReservationRequestGuard(guardInput),
    ).resolves.toBeNull();
  });

  it("releases an acquired request guard", async () => {
    await releaseReservationRequestGuard("reservation:request-guard:test");

    expect(redisMock.del).toHaveBeenCalledWith(
      "reservation:request-guard:test",
    );
  });
});
