# Backend Docs

Last updated: 2026-06-29

This document is a living snapshot of the backend code as it exists now. Update it when backend behavior, API contracts, infrastructure, or known gaps change.

## Summary

The backend is an Express 5 + TypeScript API backed by PostgreSQL through Prisma. It currently supports:

- Health checks.
- Demo auth and role guards using seeded users.
- Event discovery for published upcoming events.
- Ticket availability calculation from ticket capacity, active pending reservations, and confirmed reservations.
- Customer reservation creation with idempotency, PostgreSQL transaction safety, row-level ticket locks, and optional Redis support.

PostgreSQL is the source of truth for booking correctness. Redis is optional and used only for operational support such as short-lived availability cache, duplicate request guard, and reservation expiry metadata.

## Runtime And Tooling

Backend location: `backend/`

Main stack:

- Node.js with TypeScript.
- Express 5.
- Prisma 7 with `@prisma/adapter-pg`.
- PostgreSQL.
- Optional Redis.
- Zod for request validation.
- Vitest and Supertest for tests.

Primary commands:

```bash
pnpm --dir backend run dev
pnpm --dir backend run build
pnpm --dir backend run test
pnpm --dir backend run prisma:migrate
pnpm --dir backend run prisma:seed
```

Required environment:

- `DATABASE_URL`

Optional environment:

- `PORT`, default `4000`
- `NODE_ENV`, default `development`
- `REDIS_URL`

## Application Entry Point

`backend/src/server.ts` starts the Express app on `env.PORT`, connects Redis when `REDIS_URL` is configured, and gracefully disconnects Redis and Prisma on `SIGINT` or `SIGTERM`.

`backend/src/app.ts` configures:

- CORS.
- JSON body parsing.
- Demo auth middleware for all requests.
- `/health`
- `/auth`
- `/events`
- `/reservations`
- Shared error middleware.

The API response style is generally:

```json
{
  "data": {}
}
```

Errors use:

```json
{
  "error": {
    "message": "..."
  }
}
```

## Data Model

The Prisma schema lives in `backend/prisma/schema.prisma`.

Current enums:

- `UserRole`: `customer`, `admin`, `staff`
- `EventStatus`: `draft`, `published`, `cancelled`
- `ReservationStatus`: `pending`, `confirmed`, `expired`, `cancelled`

Current models:

- `User`
- `Venue`
- `Event`
- `TicketType`
- `Reservation`
- `ReservationItem`

Important constraints and indexes:

- Users have unique emails.
- Events are indexed by `status` and `startsAt`, plus `category` and `venueId`.
- Reservations are indexed by `status` and `expiresAt`, plus `userId` and `status`.
- Reservations have a unique `(userId, idempotencyKey)` constraint for retry safety.
- Reservation item quantity has a database check constraint requiring `quantity > 0`.
- Reservation items cascade-delete when their reservation is deleted.

Seed data creates:

- Customer: `customer@eventbooking.local`
- Admin: `admin@eventbooking.local`
- Staff: `staff@eventbooking.local`
- Two venues.
- Two published events.
- One draft event.
- Ticket types for each seeded event.

## Demo Auth

Auth is currently demo-only and header-based.

Middleware reads:

```text
x-demo-user-email
```

If present, it looks up a seeded user by email and attaches a lightweight user object to `req.user`.

Auth helpers:

- `requireAuth` requires any attached demo user.
- `requireRole(...roles)` requires an attached user with one of the allowed roles.

Routes:

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/auth/demo-users` | Public | Lists demo users for selection. |
| `GET` | `/auth/me` | Any demo user | Returns the active user. |
| `GET` | `/auth/admin-check` | Admin | Confirms admin access. |
| `GET` | `/auth/staff-check` | Staff | Confirms staff access. |

## Events API

Routes:

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/events` | Public | Lists published upcoming events. |
| `GET` | `/events/:id` | Public | Returns published upcoming event detail. |

Event list behavior:

- Only `published` events with `startsAt >= now` are returned.
- Results are ordered by `startsAt` ascending.
- Ticket types are ordered by price.
- Response includes summary fields such as title, category, venue name, city, minimum price, currency, hero image, and availability status.

Event detail behavior:

- Only published upcoming events are visible.
- Venue details are included.
- Ticket types include capacity, available quantity, active reserved quantity, and confirmed sold quantity.
- Unknown, draft, cancelled, or past events return `404 Event not found`.

Availability status is currently:

- `available` when total available quantity is greater than zero.
- `sold_out` when no ticket quantity remains.

## Availability Calculation

Availability is implemented in `backend/src/modules/events/availability.service.ts`.

For each ticket type:

```text
availableQuantity = capacity - active pending reservation quantity - confirmed reservation quantity
```

Active pending reservations are reservations with:

- `status = pending`
- `expiresAt > now`

Expired pending reservations are ignored by availability reads even if their database status has not been changed to `expired`.

Confirmed reservations always reduce availability.

When availability is read outside a transaction, the service may use the Redis read-side cache. When called inside a Prisma transaction, it bypasses Redis and queries PostgreSQL directly.

## Reservations API

Routes:

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `POST` | `/reservations` | Customer | Creates a pending reservation hold. |

Request body:

```json
{
  "idempotencyKey": "optional-client-generated-key",
  "items": [
    {
      "ticketTypeId": "ticket_type_id",
      "quantity": 2
    }
  ]
}
```

Validation:

- `items` is required and must contain at least one item.
- `ticketTypeId` must be a non-empty string.
- `quantity` must be a positive integer.
- `idempotencyKey`, when present, must be a non-empty string of up to 128 characters.

Successful create response:

- `201` when a new reservation is created.
- `200` when an existing reservation is returned for the same user and idempotency key.

Reservation behavior:

- Only `customer` users can create reservations.
- Duplicate ticket type entries in a request are merged before availability checks.
- Holds expire 5 minutes after creation.
- The response includes reservation ID, status, expiry timestamp, idempotency key, and item details.

Failure cases:

- Missing demo user header: `401`.
- Non-customer user: `403`.
- Invalid request body: `400`.
- Unknown, draft, cancelled, or past ticket type: `400`.
- Insufficient availability: `409`.
- Duplicate request guard already active: `409`.

## Reservation Correctness

Reservation creation is designed so PostgreSQL prevents overselling.

The create flow:

1. If an idempotency key is supplied, look for an existing reservation for the same user and key.
2. Merge duplicate ticket type IDs in the request.
3. Optionally acquire a Redis duplicate-request guard.
4. Open a Prisma transaction.
5. Lock matching ticket type rows using raw SQL with `FOR UPDATE`.
6. Restrict locked ticket types to published upcoming events.
7. Recalculate availability inside the transaction using PostgreSQL.
8. Reject the request if any requested quantity exceeds availability.
9. Create the reservation and reservation items in the same transaction.
10. After commit, write Redis expiry metadata and invalidate affected availability cache keys.
11. Release the Redis duplicate-request guard.

The transaction locks ticket types in deterministic ID order to reduce deadlock risk for multi-ticket reservations.

Redis is not required for correctness. If Redis is absent or fails, reservation creation continues with PostgreSQL checks.

## Redis Support

Redis configuration lives in `backend/src/config/redis.ts`.

Redis is used only when `REDIS_URL` is configured and the client is ready.

Current Redis features:

- Inventory availability cache.
- Short-lived duplicate reservation request guard.
- Reservation expiry tracking metadata.

Inventory cache:

- Key prefix: `inventory:ticket-type`
- Full key: `inventory:ticket-type:<ticketTypeId>`
- TTL: 15 seconds
- Stores available, capacity, confirmed sold, and reserved quantities.
- Validates cached capacity before using a cache entry.
- Invalidated after reservation creation for affected ticket types.
- Read/write/delete failures log errors and fall back to PostgreSQL behavior.

Request guard:

- Key prefix: `reservation:request-guard`
- TTL: 15 seconds
- Hashes user ID and normalized requested items.
- Prevents rapid duplicate in-flight reservation attempts when Redis is available.
- Does not replace database idempotency.

Expiry tracking:

- Per-reservation key prefix: `reservation:expiry`
- Sorted set key: `reservations:expiring`
- Stores reservation expiry metadata after a reservation is created.
- There is no worker yet in this codebase that consumes the sorted set and updates reservation status to `expired`.

## Tests

Backend tests live in `backend/tests/`.

Current coverage includes:

- Health endpoint.
- Event list and event detail.
- Availability changes for active pending reservations.
- Expired pending reservations being ignored by availability.
- Confirmed reservations reducing availability.
- Event not-found behavior.
- Demo auth and role guards.
- Reservation creation by customer users.
- Idempotent reservation retry behavior.
- Auth, role, validation, unknown ticket type, and insufficient inventory reservation failures.
- Redis inventory cache read/write/invalidation behavior.
- Redis request guard acquire/duplicate/release behavior.

Notable remaining test gap:

- There is no explicit concurrent reservation test that proves oversell prevention under simultaneous requests, even though the service uses row-level locks.

## Current Gaps And Non-Goals

These are not implemented in the current backend:

- Production authentication.
- User signup/login.
- Payment processing.
- Reservation confirmation/payment capture endpoint.
- Ticket issuance.
- Ticket validation/scanning.
- Admin event management endpoints.
- Staff operations beyond demo role checks.
- Background worker that marks expired pending reservations as `expired`.
- API pagination, filtering, or search for events.
- Rate limiting.
- Structured logging/observability.
- OpenAPI or generated API documentation.

## Update Checklist

When refreshing this document, check:

- `backend/src/app.ts` for route surface changes.
- `backend/src/modules/**` for behavior changes.
- `backend/prisma/schema.prisma` and migrations for data model changes.
- `backend/prisma/seed.ts` for seeded assumptions.
- `backend/tests/` for verified behavior.
- `backend/package.json` for tooling and dependency changes.
