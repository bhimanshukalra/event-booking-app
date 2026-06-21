# Booking Core Phase Plan

This document breaks MVP Phase 2 into actionable implementation steps. The goal is to build the core booking system that proves the platform can safely reserve limited inventory without overselling.

Booking Core is the main senior-engineering proof point for this project. The system must behave correctly under concurrent reservation attempts, retries, expired reservations, and Redis degradation.

## Phase 2 Goal

Implement temporary ticket reservations for general admission ticket types with:

- Server-side quantity validation
- PostgreSQL transaction safety
- Row-level locking
- Reservation expiry
- Redis support for operational behavior
- Audit logs for reservation state changes
- Customer countdown UI
- Conflict responses when inventory is unavailable
- Tests that prove double booking is prevented

## Correctness Rule

PostgreSQL is the source of truth for inventory correctness.

Redis may support expiry, request guards, rate limits, and cached inventory views, but Redis must not be required to prevent overselling.

If Redis is unavailable:

- Reservation creation can still run.
- PostgreSQL still prevents double booking.
- The API may skip Redis-backed cache or duplicate-request optimizations.
- Availability responses must remain correct from PostgreSQL.

## Phase 2.1: Reservation Data Model

Goal: add the database tables and statuses needed to represent temporary reservations.

Steps:

- [x] Add `ReservationStatus` enum.
- [x] Add `reservations` table/model.
- [x] Add `reservation_items` table/model.
- [x] Link reservations to `users`.
- [x] Link reservation items to `ticket_types`.
- [x] Add `expires_at` to reservations.
- [x] Add `quantity` to reservation items.
- [x] Add indexes for active reservation lookup.
- [x] Add database-level quantity check if supported by migration SQL.
- [x] Add migration.
- [x] Regenerate Prisma client.

Recommended reservation statuses:

```text
pending
confirmed
expired
cancelled
```

Recommended `reservations` fields:

```text
id
user_id
status
expires_at
created_at
updated_at
```

Recommended `reservation_items` fields:

```text
id
reservation_id
ticket_type_id
quantity
created_at
updated_at
```

Exit criteria:

- [x] Migrations create reservation tables from scratch.
- [x] Prisma client exposes reservation models.
- [x] Active reservation lookup can be indexed efficiently.
- [x] Reservation item quantities cannot be zero or negative.

## Phase 2.2: Availability Calculation

Goal: compute remaining inventory from confirmed capacity and active reservations.

Steps:

- [x] Create availability service.
- [x] Count total ticket type capacity.
- [x] Count active pending reservations where `expires_at > now()`.
- [x] Ignore expired pending reservations.
- [x] Prepare confirmed booking count placeholder for Phase 3.
- [x] Return available, reserved, and capacity counts.
- [x] Add availability fields to event detail ticket types.
- [x] Add unit/service tests for availability calculation.

Availability formula for Phase 2:

```text
available = ticket_type.capacity - active_reserved_quantity
```

Phase 3 will extend this to:

```text
available = ticket_type.capacity - active_reserved_quantity - confirmed_sold_quantity
```

Exit criteria:

- [x] Event detail shows remaining available quantity per ticket type.
- [x] Expired reservations do not reduce availability.
- [x] Availability is calculated server-side.

## Phase 2.3: Reservation Creation API

Goal: let a customer reserve ticket quantities while preventing overselling.

Steps:

- [x] Add `POST /reservations`.
- [x] Require demo customer auth.
- [x] Validate request body with Zod.
- [x] Accept optional idempotency key for safe client retries.
- [x] Accept ticket type and quantity.
- [x] Reject zero or negative quantity.
- [x] Reject unavailable ticket type IDs.
- [x] Create reservation with a 5-minute expiry.
- [x] Return reservation details and expiry timestamp.
- [x] Return clear conflict response when inventory is unavailable.

Suggested request:

```json
{
  "items": [
    {
      "ticketTypeId": "ticket_type_id",
      "quantity": 2
    }
  ]
}
```

Suggested success response:

```json
{
  "data": {
    "id": "reservation_id",
    "status": "pending",
    "expiresAt": "ISO_8601_EXPIRY_TIMESTAMP",
    "items": []
  }
}
```

Exit criteria:

- [x] Authenticated customers can create reservations.
- [x] Invalid quantities are rejected.
- [x] Unavailable inventory returns a conflict response.
- [x] Retried reservation requests do not create accidental duplicate holds.

## Phase 2.4: PostgreSQL Transaction Safety

Goal: make reservation creation concurrency-safe.

Steps:

- [ ] Wrap reservation creation in a Prisma transaction.
- [ ] Lock involved `ticket_types` rows with `SELECT ... FOR UPDATE`.
- [ ] Lock multiple ticket type rows in deterministic ID order to avoid deadlocks.
- [ ] Recalculate availability inside the transaction.
- [ ] Create reservation only after availability is confirmed.
- [ ] Insert reservation items in the same transaction.
- [ ] Keep the transaction small and focused.
- [ ] Add a concurrent reservation test/script.

Required behavior:

- [ ] Two users cannot reserve more tickets than capacity.
- [ ] Concurrent requests for the same ticket type are serialized by PostgreSQL row locks.
- [ ] The loser receives a deterministic conflict response.
- [ ] Multi-ticket reservations avoid deadlocks by locking rows in a stable order.

Important note:

Prisma can manage the transaction, but row-level locking should use raw SQL inside the transaction where needed.

Example pattern:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`
    SELECT id
    FROM ticket_types
    WHERE id = ${ticketTypeId}
    FOR UPDATE
  `;

  // Recalculate availability and create reservation in this transaction.
});
```

Exit criteria:

- [ ] Concurrent booking test proves capacity cannot be exceeded.
- [ ] README or phase notes explain how double booking is prevented.

## Phase 2.5: Redis Support Layer

Goal: add Redis for production-minded operational support without weakening PostgreSQL correctness.

Steps:

- [ ] Add Redis dependency.
- [ ] Add Redis connection configuration.
- [ ] Add local Redis setup notes.
- [ ] Add Redis health helper.
- [ ] Add graceful fallback when Redis is unavailable.
- [ ] Add reservation expiry helper using TTL key or sorted set.
- [ ] Add short-lived duplicate request guard.
- [ ] Use Redis request guards as optimization only, not idempotency source of truth.
- [ ] Keep all inventory correctness checks in PostgreSQL.

Recommended Redis keys:

```text
reservation:expires:<reservation_id>
reservation:request:<user_id>:<ticket_type_id>
inventory:event:<event_id>
```

Redis behavior:

- [ ] TTL key mirrors reservation expiry.
- [ ] Duplicate request guard prevents rapid repeat reservation attempts.
- [ ] Redis failures are logged but do not allow overselling.
- [x] Cached inventory is optional and invalidated after reservation changes.

Inventory cache rules:

- Cache keys are per ticket type: `inventory:ticket-type:<ticket_type_id>`.
- Cached counts are used only for read-side event availability responses, never for reservation correctness checks inside PostgreSQL transactions.
- Reservation creation invalidates every affected ticket type key after the database transaction commits.
- Cache entries use a short TTL so expired holds age out even if no explicit expiry worker has invalidated the key yet.
- Redis cache read, write, or invalidation failures must fall back to PostgreSQL-backed behavior without weakening inventory correctness.

Exit criteria:

- [ ] Reservation flow works with Redis running.
- [ ] Reservation flow still prevents overselling if Redis is unavailable.
- [ ] Redis is clearly documented as support infrastructure, not correctness infrastructure.

## Phase 2.6: Audit Logs And Observability

Goal: make reservation behavior explainable during demos, debugging, and reviews.

Steps:

- [ ] Add reservation audit log table/model or structured log helper.
- [ ] Record reservation creation attempts.
- [ ] Record successful reservation creation.
- [ ] Record inventory conflicts.
- [ ] Record reservation expiry transitions.
- [ ] Include actor/user ID and role when available.
- [ ] Include reservation ID, ticket type IDs, quantities, and reason.
- [ ] Keep logs append-only.

Recommended audit actions:

```text
reservation.create_attempted
reservation.created
reservation.conflict
reservation.expired
reservation.cancelled
redis.unavailable
```

Exit criteria:

- [ ] Reservation state changes are traceable.
- [ ] Conflict responses have corresponding logs.
- [ ] Redis fallback behavior is visible in logs.

## Phase 2.7: Reservation Detail And Expiry

Goal: expose reservation state clearly and handle expiration.

Steps:

- [ ] Add `GET /reservations/:id`.
- [ ] Return reservation status, expiry, and items.
- [ ] Ensure customers can only view their own reservations.
- [ ] Treat expired pending reservations as expired in API responses.
- [ ] Add explicit expired reservation response state.
- [ ] Add optional `POST /reservations/:id/cancel`.

Expiry strategy:

- [ ] Availability queries ignore pending reservations where `expires_at <= now()`.
- [ ] Reservation detail can update stale pending reservations to `expired`.
- [ ] A later worker can proactively expire old reservations, but correctness does not depend on the worker.

Exit criteria:

- [ ] Expired reservations do not hold inventory.
- [ ] Reservation detail shows pending versus expired clearly.
- [ ] Customers cannot view another customer's reservation.

## Phase 2.8: Customer Ticket Selection UI

Goal: let customers pick ticket quantities and create reservations from the mobile app.

Steps:

- [ ] Show available quantity per ticket type on event detail.
- [ ] Add quantity controls for each ticket type.
- [ ] Prevent selecting more than available quantity in the UI.
- [ ] Add create reservation action.
- [ ] Show loading state while reservation is being created.
- [ ] Show conflict error if inventory is no longer available.
- [ ] Navigate to reservation screen after success.

Exit criteria:

- [ ] Customer can select general admission ticket quantity.
- [ ] Customer cannot select unavailable quantity in the UI.
- [ ] Server still validates all selected quantities.

## Phase 2.9: Reservation Countdown UI

Goal: show the customer that inventory is temporarily held.

Steps:

- [ ] Add reservation detail screen.
- [ ] Display reserved ticket types and quantities.
- [ ] Display `expiresAt`.
- [ ] Add countdown timer.
- [ ] Show expired state when countdown reaches zero.
- [ ] Add action placeholder for Phase 3 payment.
- [ ] Refresh reservation state from backend when needed.

Exit criteria:

- [ ] Customer sees a countdown after creating a reservation.
- [ ] Countdown reaches an expired state.
- [ ] Expired reservation state is visually clear.

## Phase 2.10: Tests And Verification

Goal: prove Booking Core correctness with automated tests and scripts.

Required tests:

- [ ] Reservation creation succeeds for available inventory.
- [ ] Reservation creation rejects invalid quantity.
- [ ] Reservation creation rejects unavailable inventory.
- [ ] Expired reservations are ignored by availability.
- [ ] Reservation detail returns pending reservation.
- [ ] Reservation detail returns expired state.
- [ ] Customer cannot view another customer's reservation.
- [ ] Concurrent reservation attempts cannot exceed capacity.
- [ ] Multi-ticket concurrent reservation attempts do not deadlock.
- [ ] Idempotent retry does not create duplicate holds.
- [ ] Redis unavailable fallback still prevents overselling.
- [ ] Reservation audit logs are written for success, conflict, and expiry.

Recommended scripts:

- [ ] Concurrent reservation script.
- [ ] Manual smoke checklist for customer reservation flow.

Exit criteria:

- [ ] `pnpm run check` passes.
- [ ] Concurrent reservation proof passes.
- [ ] Phase 2 demo flow works locally.

## Phase 2 Definition Of Done

Phase 2 is complete when:

- [ ] Customer can select a ticket quantity.
- [ ] Customer can create a pending reservation.
- [ ] Reservation expires after 5 minutes.
- [ ] Expired reservation releases inventory.
- [ ] Backend prevents overselling under concurrent requests.
- [ ] PostgreSQL transaction and row lock behavior is tested.
- [ ] Redis support exists but is not required for correctness.
- [ ] Reservation actions have audit logs.
- [ ] Customer sees a reservation countdown.
- [ ] Conflict states are clear in API and UI.
- [ ] Documentation explains how double booking is prevented.
