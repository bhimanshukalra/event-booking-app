# BookMyShow-Style Production Roadmap

This document captures the changes needed to move the event booking platform from a capacity-based MVP toward a production-grade, BookMyShow-style booking backend.

The current backend supports event discovery, ticket types, temporary reservations, idempotent reservation creation, and server-side availability checks. That is a good MVP foundation, but it is still closer to general event ticketing than a real movie/theatre seat-booking system.

A BookMyShow-style system must support exact seat selection, temporary seat holds, conflict-safe booking, payments, ticket issuance, auditability, and real-time seat map updates.

## Current Gap

Today, reservations are based on ticket type quantity:

```text
Reservation
  -> ReservationItem
    -> ticketTypeId
    -> quantity
```

Example:

```text
Reserve 2 General Admission tickets
```

That works for general-admission events, concerts, and conferences where individual seats do not matter.

For a BookMyShow-like app, the reservation must be seat-specific:

```text
Reserve seats F8 and F9 for the 7:30 PM show in Audi 2
```

The biggest missing concepts are:

```text
Screen / Auditorium
Seat layout
Showtime
Seat-level reservation
Seat-level booking
Payment lifecycle
Ticket issuance
Real-time availability
```

## Target Booking Model

A production-style movie/theatre flow should look like this:

```text
Venue
  -> Screen / Auditorium
    -> Seat Layout
      -> Seats

Movie / Event
  -> Showtime
    -> Screen
    -> Pricing
    -> Seat availability

User
  -> Reservation
    -> Reserved seats
    -> Payment attempt
    -> Booking
    -> Tickets
```

Example user journey:

```text
1. User selects city.
2. User selects movie/event.
3. User selects venue.
4. User selects showtime.
5. User sees seat map.
6. User selects seats F8, F9.
7. Backend temporarily holds those seats.
8. User pays within the hold window.
9. Backend confirms booking after verified payment.
10. Backend issues tickets with QR codes.
```

## Schema Changes

## 1. Venue Screens / Auditoriums

A venue can have multiple screens or auditoriums.

Example:

```text
PVR Saket
  -> Audi 1
  -> Audi 2
  -> Audi 3
```

Possible model:

```prisma
model Screen {
  id        String   @id @default(cuid())
  venueId   String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  venue Venue @relation(fields: [venueId], references: [id])
  seats Seat[]

  @@index([venueId])
  @@map("screens")
}
```

## 2. Seats

Seats belong to a screen. A seat has a row, number, and type.

Possible model:

```prisma
model Seat {
  id         String   @id @default(cuid())
  screenId   String
  rowLabel   String
  seatNumber Int
  seatType   SeatType
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  screen Screen @relation(fields: [screenId], references: [id])

  @@unique([screenId, rowLabel, seatNumber])
  @@index([screenId, seatType])
  @@map("seats")
}
```

Possible enum:

```prisma
enum SeatType {
  regular
  premium
  recliner
  wheelchair_accessible
}
```

Important note: seat availability should not live directly on `Seat`, because the same seat can be available for one showtime and booked for another.

## 3. Showtimes

A user books a specific showtime, not just an event.

Possible model:

```prisma
model Showtime {
  id        String         @id @default(cuid())
  eventId   String
  screenId  String
  startsAt  DateTime
  endsAt    DateTime
  status    ShowtimeStatus @default(scheduled)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  event  Event  @relation(fields: [eventId], references: [id])
  screen Screen @relation(fields: [screenId], references: [id])

  @@index([eventId, startsAt])
  @@index([screenId, startsAt])
  @@map("showtimes")
}
```

Possible enum:

```prisma
enum ShowtimeStatus {
  scheduled
  cancelled
  completed
}
```

## 4. Seat-Level Reservations

Current reservation items store quantity. For seat selection, we need exact seats.

Possible model:

```prisma
model ReservationSeat {
  id            String   @id @default(cuid())
  reservationId String
  showtimeId    String
  seatId        String
  priceCents    Int
  currency      String   @default("USD")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  reservation Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  showtime    Showtime    @relation(fields: [showtimeId], references: [id])
  seat        Seat        @relation(fields: [seatId], references: [id])

  @@index([reservationId])
  @@index([showtimeId, seatId])
  @@map("reservation_seats")
}
```

The hard part is ensuring one seat cannot be actively held or booked twice for the same showtime.

This cannot rely only on application logic. It needs database transactions and constraints.

## 5. Bookings

A reservation is temporary. A booking is final.

Possible model:

```prisma
model Booking {
  id            String        @id @default(cuid())
  userId        String
  reservationId String        @unique
  status        BookingStatus @default(confirmed)
  totalCents    Int
  currency      String        @default("USD")
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user        User        @relation(fields: [userId], references: [id])
  reservation Reservation @relation(fields: [reservationId], references: [id])
  tickets     Ticket[]

  @@index([userId, createdAt])
  @@map("bookings")
}
```

Possible enum:

```prisma
enum BookingStatus {
  confirmed
  cancelled
  refunded
  partially_refunded
}
```

## 6. Payments

Booking confirmation should depend on a verified payment result.

Possible model:

```prisma
model Payment {
  id            String        @id @default(cuid())
  reservationId String
  bookingId     String?
  provider      String
  providerRef   String?
  amountCents   Int
  currency      String        @default("USD")
  status        PaymentStatus @default(pending)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  reservation Reservation @relation(fields: [reservationId], references: [id])
  booking     Booking?    @relation(fields: [bookingId], references: [id])

  @@index([reservationId])
  @@index([provider, providerRef])
  @@map("payments")
}
```

Possible enum:

```prisma
enum PaymentStatus {
  pending
  succeeded
  failed
  expired
  refunded
}
```

Important production rule:

```text
Do not confirm booking only because the frontend says payment succeeded.
```

Final confirmation should happen after verifying the payment provider response or processing a trusted webhook.

## 7. Tickets

After booking confirmation, issue tickets.

Possible model:

```prisma
model Ticket {
  id        String       @id @default(cuid())
  bookingId String
  seatId    String
  qrToken   String       @unique
  status    TicketStatus @default(issued)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  booking Booking @relation(fields: [bookingId], references: [id])
  seat    Seat    @relation(fields: [seatId], references: [id])

  @@index([bookingId])
  @@index([seatId])
  @@map("tickets")
}
```

Possible enum:

```prisma
enum TicketStatus {
  issued
  checked_in
  cancelled
  refunded
}
```

## 8. Audit Logs

Booking systems need traceability.

Possible model:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  action    String
  entity    String
  entityId  String
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}
```

Useful events:

```text
reservation.created
reservation.expired
seat.held
seat.released
booking.confirmed
booking.cancelled
payment.succeeded
payment.failed
ticket.issued
ticket.checked_in
```

## API Changes

## 1. Seat Map API

Needed endpoint:

```http
GET /showtimes/:id/seats
```

Response should include:

```json
{
  "data": {
    "showtimeId": "showtime_id",
    "screen": {
      "id": "screen_id",
      "name": "Audi 2"
    },
    "rows": [
      {
        "rowLabel": "F",
        "seats": [
          {
            "id": "seat_id",
            "seatNumber": 8,
            "seatType": "premium",
            "status": "available",
            "priceCents": 45000,
            "currency": "INR"
          }
        ]
      }
    ]
  }
}
```

Seat status should be computed server-side:

```text
available
held_by_me
held_by_other_user
booked
blocked
```

## 2. Seat Reservation API

BookMyShow-style reservation should use seat IDs, not only ticket type quantities.

```http
POST /reservations
Idempotency-Key: checkout-attempt-abc123
```

```json
{
  "showtimeId": "showtime_id",
  "seatIds": ["seat_f8", "seat_f9"]
}
```

Recommended behavior:

```text
201 Created -> seats held
200 OK -> same idempotency key returned existing reservation
400 Bad Request -> invalid request
401 Unauthorized -> missing auth
403 Forbidden -> wrong role
409 Conflict -> seat already held/booked
```

## 3. Booking Confirmation API

```http
POST /bookings
```

```json
{
  "reservationId": "reservation_id",
  "paymentProviderRef": "provider_payment_id"
}
```

The backend should verify payment before confirming the booking.

## 4. Payment Webhook API

```http
POST /webhooks/payments/provider-name
```

This endpoint should:

```text
1. Verify webhook signature.
2. Load payment attempt.
3. Confirm booking if payment succeeded.
4. Release reservation if payment failed or expired.
5. Write audit logs.
```

## Idempotency Strategy

The current MVP stores `idempotencyKey` directly on `Reservation`:

```prisma
idempotencyKey String?
@@unique([userId, idempotencyKey])
```

This is acceptable for Phase 2.3, but production systems usually use a separate idempotency table.

Recommended production model:

```prisma
model IdempotencyKey {
  id          String   @id @default(cuid())
  userId      String
  endpoint    String
  key         String
  requestHash String
  statusCode  Int?
  response    Json?
  lockedUntil DateTime?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, endpoint, key])
  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

Recommended behavior:

```text
1. Client sends Idempotency-Key header.
2. Backend hashes normalized request body.
3. Backend checks existing key for same user and endpoint.
4. Same key + same hash returns stored response.
5. Same key + different hash returns 409 Conflict.
6. First request stores result after successful operation.
```

Why a header is preferred:

```text
Idempotency-Key: checkout-attempt-abc123
```

Benefits:

- Separates request identity from business payload.
- Works consistently across endpoints.
- Matches common payment/API patterns.
- Easier to handle in middleware, gateways, and logs.

## Concurrency and Double-Booking Protection

This is the most critical part of a booking backend.

The system must guarantee:

```text
Two users cannot reserve or book the same seat for the same showtime.
```

Recommended PostgreSQL transaction flow:

```text
1. Begin transaction.
2. Lock requested showtime-seat rows in deterministic order.
3. Check whether any seat is already booked.
4. Check whether any seat has an active, unexpired hold.
5. If conflict exists, return 409.
6. Create reservation.
7. Create reservation seats.
8. Commit transaction.
```

Use row-level locks:

```sql
SELECT *
FROM seats
WHERE id IN (...)
ORDER BY id
FOR UPDATE;
```

Important notes:

- Always lock seats in sorted ID order to reduce deadlock risk.
- Recalculate availability inside the transaction.
- Keep transactions short.
- Do not call payment providers inside the transaction.

## Redis Seat Holds

Redis is useful for fast temporary holds and real-time seat map updates.

Example keys:

```text
seat_hold:{showtimeId}:{seatId} -> reservationId
TTL: 5 minutes
```

Benefits:

- Fast seat hold lookup.
- Automatic expiry with TTL.
- Lower database pressure for seat map rendering.
- Better real-time UX.

Important rule:

```text
Redis improves speed and UX, but PostgreSQL remains the source of truth.
```

Redis alone is not enough to prevent double booking.

Recommended architecture:

```text
PostgreSQL transaction = correctness
Redis TTL lock = fast temporary hold visibility
WebSocket/SSE = real-time UI updates
```

## Real-Time Seat Updates

BookMyShow-style UX needs live seat map changes.

Possible technologies:

```text
WebSockets
Socket.IO
Server-Sent Events
Redis Pub/Sub
```

Events:

```text
seat.held
seat.released
seat.booked
reservation.expired
showtime.cancelled
```

Example event payload:

```json
{
  "type": "seat.held",
  "showtimeId": "showtime_id",
  "seatIds": ["seat_f8", "seat_f9"],
  "expiresAt": "2026-06-07T12:10:00.000Z"
}
```

## Pricing Requirements

Current MVP pricing lives on `TicketType`.

BookMyShow-like pricing often depends on:

```text
Seat type
Showtime
Day of week
Demand
Convenience fees
Taxes
Coupons
Payment method offers
```

Possible future models:

```text
PricingRule
Fee
TaxRate
Coupon
Promotion
OrderSummary
```

For seat booking, price should be captured at reservation time:

```text
ReservationSeat.priceCents
```

This prevents price changes from affecting an already-held checkout.

## Background Jobs

Production booking systems need workers.

Jobs:

```text
Expire reservations
Release seats
Clear Redis holds
Confirm payment status
Send booking notifications
Generate QR tickets
Clean old idempotency records
Process refunds
```

Possible tools:

```text
BullMQ + Redis
pg-boss
Temporal
Cloud task queues
```

## Notifications

Useful notification events:

```text
Reservation created
Reservation expiring soon
Booking confirmed
Payment failed
Refund processed
Show cancelled
Event reminder
```

Channels:

```text
Email
SMS
Push notification
WhatsApp
```

## Admin and Operations APIs

Production systems need admin tooling.

Important APIs:

```text
Create/update venue
Create/update screen
Upload seat layout
Create movie/event
Create showtimes
Set pricing
Block seats
Cancel showtime
View bookings
View payment status
Issue refunds
View audit logs
```

## Security Requirements

The current demo auth is fine for MVP, but production needs:

```text
Real user authentication
JWT or secure sessions
Refresh token rotation
Role-based access control
Rate limiting
Bot protection
Request size limits
CORS hardening
Input validation everywhere
Webhook signature verification
PII protection
Payment data safety
```

## Observability Requirements

Production booking systems need strong visibility.

Add:

```text
Structured logs
Request IDs
Trace IDs
Metrics
Error reporting
Slow query logs
Audit logs
Business event logs
Payment reconciliation logs
```

Useful tools:

```text
Pino or Winston
OpenTelemetry
Sentry
Prometheus
Grafana
Datadog
```

## Testing Requirements

Critical tests:

```text
Two users cannot reserve the same seat
Expired holds do not block seats
Payment success confirms booking exactly once
Payment retry does not duplicate booking
Webhook replay is idempotent
Same idempotency key with different payload is rejected
Reservation expiry releases seats
Cancelled showtime blocks booking
Admin cannot accidentally oversell seats
```

Concurrency tests are mandatory:

```text
100 users attempt to reserve the same seat
Expected result: 1 success, 99 conflicts
```

## Recommended Phased Roadmap

## Phase A: Current Flow Hardening

Goal: make the existing ticket-type reservation system safer before introducing seats.

Steps:

- Add transaction safety to current reservation creation.
- Lock involved ticket types with `SELECT ... FOR UPDATE`.
- Recalculate availability inside the transaction.
- Reject concurrent oversell attempts.
- Add concurrency tests.

This matches the existing Phase 2.4.

## Phase B: Seat Layout Foundation

Goal: model theatres/screens and exact seats.

Steps:

- Add `Screen` model.
- Add `Seat` model.
- Add `SeatType` enum.
- Seed realistic screen layouts.
- Add admin-only APIs for screen and seat management.

## Phase C: Showtime Foundation

Goal: support booking a specific event at a specific time and screen.

Steps:

- Add `Showtime` model.
- Link showtimes to events and screens.
- Add showtime listing APIs.
- Add showtime status handling.
- Add seed data for multiple showtimes.

## Phase D: Seat Map API

Goal: show users a real-time-ish seat map.

Steps:

- Add `GET /showtimes/:id/seats`.
- Return row-wise seat layout.
- Compute seat statuses server-side.
- Include price per seat.
- Add tests for available, held, booked, and blocked seats.

## Phase E: Seat-Level Reservation API

Goal: reserve exact seats.

Steps:

- Change reservation request from quantity to `seatIds`.
- Add `ReservationSeat` model.
- Hold exact seats for 5 minutes.
- Add transaction-level locking.
- Add conflict responses for held/booked seats.
- Add idempotency header support.

## Phase F: Redis Holds and Real-Time Updates

Goal: improve user experience and scalability.

Steps:

- Add Redis seat hold keys with TTL.
- Publish seat events when holds change.
- Add WebSocket/SSE channel for seat map updates.
- Keep PostgreSQL as source of truth.
- Add Redis-unavailable fallback behavior.

## Phase G: Payment and Booking Confirmation

Goal: turn reservations into confirmed bookings.

Steps:

- Add `Payment` model.
- Add `Booking` model.
- Add payment initiation API.
- Add payment webhook handler.
- Confirm booking only after verified payment.
- Release seats on payment failure or timeout.

## Phase H: Ticket Issuance and Check-In

Goal: issue usable tickets after booking.

Steps:

- Add `Ticket` model.
- Generate QR tokens.
- Add ticket retrieval APIs.
- Add staff check-in API.
- Add ticket status transitions.

## Phase I: Production Operations

Goal: make the system observable, auditable, and operable.

Steps:

- Add audit logs.
- Add structured logs.
- Add request IDs.
- Add metrics.
- Add background workers.
- Add admin reports.
- Add refund and cancellation flows.

## Recommended Next Step

The immediate next step should still be Phase 2.4:

```text
PostgreSQL Transaction Safety
```

Reason:

```text
Even before we introduce exact seats, reservation creation must become concurrency-safe.
```

After Phase 2.4, the project should branch into seat-level modeling.

Recommended order:

```text
1. Finish Phase 2.4 transaction safety.
2. Add Redis temporary holds.
3. Add Screen and Seat models.
4. Add Showtime model.
5. Add seat map API.
6. Convert reservations from quantity-level to seat-level.
7. Add payments, bookings, and tickets.
```
