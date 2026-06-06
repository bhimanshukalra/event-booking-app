const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

export type AvailabilityStatus = "available" | "sold_out";

export type EventListItem = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  venueName: string;
  city: string;
  heroImageUrl: string | null;
  minPriceCents: number | null;
  currency: string;
  availabilityStatus: AvailabilityStatus;
};

export type TicketType = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  capacity: number;
};

export type EventDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  heroImageUrl: string | null;
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
  };
  ticketTypes: TicketType[];
  availabilityStatus: AvailabilityStatus;
};

type ApiResponse<T> = {
  data: T;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? "Unable to load event data.");
  }

  return response.json() as Promise<T>;
}

export async function getEvents() {
  const response = await getJson<ApiResponse<EventListItem[]>>("/events");
  return response.data;
}

export async function getEvent(eventId: string) {
  const response = await getJson<ApiResponse<EventDetail>>(
    `/events/${eventId}`,
  );
  return response.data;
}
