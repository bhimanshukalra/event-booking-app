import { API_URL } from "./config";

const DEMO_CUSTOMER_EMAIL = "customer@eventbooking.local";

export type ReservationItemInput = {
  ticketTypeId: string;
  quantity: number;
};

export type Reservation = {
  id: string;
  status: string;
  expiresAt: string;
  idempotencyKey: string | null;
  items: Array<{
    id: string;
    ticketTypeId: string;
    ticketTypeName: string;
    eventId: string;
    quantity: number;
  }>;
};

type ApiResponse<T> = {
  data: T;
};

function createIdempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createReservation(items: ReservationItemInput[]) {
  const response = await fetch(`${API_URL}/reservations`, {
    body: JSON.stringify({
      idempotencyKey: createIdempotencyKey(),
      items,
    }),
    headers: {
      "Content-Type": "application/json",
      "x-demo-user-email": DEMO_CUSTOMER_EMAIL,
    },
    method: "POST",
  });

  const body = (await response.json().catch(() => null)) as
    | ApiResponse<Reservation>
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message =
      body && "error" in body
        ? body.error?.message
        : "Unable to reserve tickets.";

    throw new Error(message ?? "Unable to reserve tickets.");
  }

  if (!body || !("data" in body)) {
    throw new Error("Unable to read reservation response.");
  }

  return body.data;
}
