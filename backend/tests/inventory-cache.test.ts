import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  del: vi.fn(),
  isReady: true,
  mGet: vi.fn(),
  setEx: vi.fn(),
}));

const getRedisClientMock = vi.hoisted(() => vi.fn());

vi.mock("../src/config/redis", () => ({
  getRedisClient: getRedisClientMock,
}));

import {
  invalidateTicketTypeAvailabilityCache,
  readTicketTypeAvailabilityCache,
  writeTicketTypeAvailabilityCache,
} from "../src/modules/events/inventory-cache";

const ticketTypes = [
  {
    id: "ticket_general",
    capacity: 100,
  },
  {
    id: "ticket_vip",
    capacity: 25,
  },
];

describe("inventory availability cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisClientMock.mockReturnValue(redisMock);
    redisMock.isReady = true;
  });

  it("reads valid cached ticket type availability and reports misses", async () => {
    redisMock.mGet.mockResolvedValue([
      JSON.stringify({
        availableQuantity: 80,
        capacity: 100,
        confirmedSoldQuantity: 5,
        reservedQuantity: 15,
      }),
      null,
    ]);

    const result = await readTicketTypeAvailabilityCache(ticketTypes);

    expect(result.cachedAvailabilityByTicketTypeId.get("ticket_general")).toEqual(
      {
        availableQuantity: 80,
        capacity: 100,
        confirmedSoldQuantity: 5,
        reservedQuantity: 15,
      },
    );
    expect(result.missingTicketTypes).toEqual([ticketTypes[1]]);
    expect(redisMock.mGet).toHaveBeenCalledWith([
      "inventory:ticket-type:ticket_general",
      "inventory:ticket-type:ticket_vip",
    ]);
  });

  it("ignores cached availability when capacity no longer matches", async () => {
    redisMock.mGet.mockResolvedValue([
      JSON.stringify({
        availableQuantity: 80,
        capacity: 90,
        confirmedSoldQuantity: 5,
        reservedQuantity: 15,
      }),
      null,
    ]);

    const result = await readTicketTypeAvailabilityCache(ticketTypes);

    expect(result.cachedAvailabilityByTicketTypeId.size).toBe(0);
    expect(result.missingTicketTypes).toEqual(ticketTypes);
  });

  it("writes cached availability with a short TTL", async () => {
    const availabilityByTicketTypeId = new Map([
      [
        "ticket_general",
        {
          availableQuantity: 80,
          capacity: 100,
          confirmedSoldQuantity: 5,
          reservedQuantity: 15,
        },
      ],
    ]);

    await writeTicketTypeAvailabilityCache(availabilityByTicketTypeId);

    expect(redisMock.setEx).toHaveBeenCalledWith(
      "inventory:ticket-type:ticket_general",
      15,
      JSON.stringify({
        availableQuantity: 80,
        capacity: 100,
        confirmedSoldQuantity: 5,
        reservedQuantity: 15,
      }),
    );
  });

  it("invalidates affected ticket type availability keys", async () => {
    await invalidateTicketTypeAvailabilityCache(["ticket_general", "ticket_vip"]);

    expect(redisMock.del).toHaveBeenCalledWith([
      "inventory:ticket-type:ticket_general",
      "inventory:ticket-type:ticket_vip",
    ]);
  });

  it("skips Redis when the client is unavailable", async () => {
    getRedisClientMock.mockReturnValue(null);

    await expect(readTicketTypeAvailabilityCache(ticketTypes)).resolves.toEqual({
      cachedAvailabilityByTicketTypeId: new Map(),
      missingTicketTypes: ticketTypes,
    });

    await writeTicketTypeAvailabilityCache(
      new Map([
        [
          "ticket_general",
          {
            availableQuantity: 80,
            capacity: 100,
            confirmedSoldQuantity: 5,
            reservedQuantity: 15,
          },
        ],
      ]),
    );
    await invalidateTicketTypeAvailabilityCache(["ticket_general"]);

    expect(redisMock.mGet).not.toHaveBeenCalled();
    expect(redisMock.setEx).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
