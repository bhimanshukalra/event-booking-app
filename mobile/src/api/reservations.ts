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

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export class ReservationApiError extends Error {
  statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = "ReservationApiError";
    this.statusCode = statusCode;
  }
}

function createIdempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getReservationErrorMessage(
  statusCode: number,
  body: ApiErrorResponse | null,
) {
  if (body?.error?.message) {
    return body.error.message;
  }

  switch (statusCode) {
    case 400:
      return "Check your ticket selection and try again.";
    case 401:
      return "Please choose a demo customer before reserving tickets.";
    case 403:
      return "This demo user is not allowed to reserve tickets.";
    case 409:
      return "Some selected tickets are no longer available.";
    case 500:
      return "The reservation service hit a problem. Please try again.";
    default:
      return "Unable to reserve tickets. Please try again.";
  }
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as
      | ApiResponse<Reservation>
      | ApiErrorResponse;
  } catch {
    return null;
  }
}

export async function createReservation(items: ReservationItemInput[]) {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/reservations`, {
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
  } catch {
    throw new ReservationApiError(
      "Unable to reach the reservation service. Check your connection and try again.",
    );
  }

  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new ReservationApiError(
      getReservationErrorMessage(
        response.status,
        body && "error" in body ? body : null,
      ),
      response.status,
    );
  }

  if (!body || !("data" in body)) {
    throw new ReservationApiError(
      "The reservation service returned an unexpected response.",
      response.status,
    );
  }

  return body.data;
}
