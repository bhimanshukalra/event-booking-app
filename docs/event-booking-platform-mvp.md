# Event Booking Platform MVP

This MVP turns the full product spec into a focused execution plan that starts with a safe reservation core and deliberately evolves toward a BookMyShow-style booking platform.

The short-term MVP proves the most important backend behavior first: customers can discover events, reserve limited inventory safely, complete a mocked payment, receive a ticket, and have that ticket validated by staff.

The long-term product direction is documented in `docs/bookmyshow-production-roadmap.md`. That roadmap is the architecture target for exact seat selection, showtimes, payments, bookings, QR tickets, audit logs, and real-time seat availability.

## Product Direction

We should keep this file as the day-to-day execution plan.

We should use `docs/bookmyshow-production-roadmap.md` as the production architecture direction.

That means:

- Phase 1 and early Phase 2 can remain focused on the existing event/ticket-type foundation.
- Phase 2 must harden reservation correctness before we add seat maps.
- Phase 3 onward should move toward BookMyShow-style screens, seats, showtimes, seat holds, payment webhooks, confirmed bookings, and issued tickets.

The project should not remain only a general-admission ticketing app. The general-admission flow is an incremental stepping stone toward a production-grade seat-booking system.

## MVP Goal

Build a concurrency-safe booking platform with:

- Customer event discovery
- Temporary reservation locking with expiry
- PostgreSQL-backed inventory correctness
- Redis-assisted hold/expiry support where useful
- Mock payment confirmation for the first demo path
- Confirmed bookings with ticket codes
- Admin event and inventory visibility
- Staff ticket validation with duplicate check-in prevention
- A clear migration path toward exact seat selection like `H6` and `H7`

The MVP should feel like a real product, but it should stay narrow enough to finish cleanly.

## MVP Phases

The MVP should be built in phases so each step produces a usable slice and proves one more part of the product.

## Phase 1: Foundation

Goal: establish the backend, database, seed data, and basic customer discovery flow.

Deliverables:

- [x] Project scaffolding for backend and mobile app
- [x] PostgreSQL schema and migrations for users, events, venues, and ticket types
- [x] Seeded demo accounts for customer, admin, and staff roles
- [x] Seeded events with ticket inventory
- [x] Event list API
- [x] Event detail API
- [x] Customer event list screen
- [x] Customer event detail screen
- [x] Basic loading, empty, and error states

Exit criteria:

- [x] A customer can open the app, browse seeded events, and view event details loaded from the backend.
- [x] The backend can distinguish customer, admin, and staff roles through seeded/demo auth.

## Phase 2: Booking Core

Goal: implement the most important engineering proof point: temporary reservation locking that prevents overselling.

This phase still works with ticket type quantity reservations because it proves the backend safety rules before we introduce seat-level complexity.

Correctness rule:

- PostgreSQL remains the source of truth for inventory correctness.
- Redis can support expiry, caching, rate limiting, and short-lived request guards.
- Redis must not be the only protection against double booking.
- If Redis is unavailable, PostgreSQL transactions and constraints must still prevent overselling.

Deliverables:

- [x] Ticket quantity selection for current ticket types
- [x] Reservation and reservation item tables
- [x] Reservation creation API
- [x] Optional idempotency key for safe reservation retries
- [x] 5-minute reservation expiry window
- [x] Availability calculation that excludes active reservations
- [x] Availability calculation that excludes confirmed bookings
- [x] PostgreSQL transaction around reservation creation
- [x] Row-level lock on the relevant ticket type during reservation creation
- [x] Redis integration for production-minded reservation support
- [x] Redis TTL or sorted-set helper for reservation expiry tracking
- [ ] Redis-backed short-lived duplicate request guard for reservation attempts
- [ ] Optional Redis inventory count cache with clear invalidation rules
- [ ] Optional Redis rate limit for reservation endpoints
- [x] Conflict response when requested quantity is no longer available
- [ ] Reservation detail API
- [ ] Countdown timer in the customer app
- [ ] Reservation expired UI state
- [ ] Audit logs for reservation lifecycle events
- [ ] Concurrency tests proving capacity cannot be exceeded

Exit criteria:

- [ ] A customer can reserve available tickets and see a countdown timer.
- [x] Expired reservations no longer reduce availability.
- [ ] Two concurrent reservation attempts cannot reserve more tickets than capacity.
- [x] Retried reservation requests do not create duplicate holds.
- [ ] Redis support improves operational behavior without weakening PostgreSQL correctness.
- [ ] Reservation actions are traceable through audit logs.

## Phase 3: Seat Layout And Showtimes

Goal: start the BookMyShow transition by modeling venues as screens/auditoriums with exact seats and showtimes.

Deliverables:

- [ ] `Screen` or `Auditorium` model linked to venues
- [ ] `Seat` model with row label, seat number, seat type, and active status
- [ ] `SeatType` enum, such as regular, premium, recliner, and wheelchair-accessible
- [ ] `Showtime` model linked to event and screen
- [ ] Showtime status handling
- [ ] Seeded screen layouts and showtimes
- [ ] Admin-only APIs or seed scripts for screen and seat setup
- [ ] Documentation for how the same seat can be available for one showtime and booked for another

Exit criteria:

- [ ] The backend can represent a venue with multiple screens.
- [ ] The backend can represent exact seats such as `H6` and `H7`.
- [ ] The backend can represent multiple showtimes for the same event.
- [ ] The schema is ready for seat-level reservation.

## Phase 4: Seat Map And Seat-Level Reservations

Goal: let customers view a seat map and reserve exact seats for a specific showtime.

Deliverables:

- [ ] `GET /showtimes/:id/seats`
- [ ] Seat status calculation: available, held, held by me, booked, blocked
- [ ] `ReservationSeat` model
- [ ] Seat-level `POST /reservations` using `showtimeId` and `seatIds`
- [ ] Idempotency via `Idempotency-Key` header or equivalent durable strategy
- [ ] PostgreSQL transaction around seat reservation
- [ ] Deterministic row-level locking for requested seats
- [ ] Conflict response when a seat is already held or booked
- [ ] Redis TTL seat holds for fast temporary hold visibility
- [ ] Real-time-ready seat status events
- [ ] Customer seat map screen
- [ ] Selected-seat summary and countdown timer

Suggested request:

```json
{
  "showtimeId": "showtime_id",
  "seatIds": ["seat_h6_id", "seat_h7_id"]
}
```

Exit criteria:

- [ ] A customer can reserve exact seats for a showtime.
- [ ] Two customers cannot reserve the same seat for the same showtime.
- [ ] Expired holds release seats.
- [ ] The seat map reflects held and booked states.
- [ ] The API behaves correctly if the same request is retried.

## Phase 5: Payment, Booking Confirmation, And Tickets

Goal: convert reservations into confirmed bookings and issued tickets through a production-minded payment lifecycle.

Deliverables:

- [ ] Mock payment screen for demo flow
- [ ] Payments table
- [ ] Booking table
- [ ] Booking seat/item table if needed
- [ ] Ticket table
- [ ] Payment initiation API
- [ ] Payment confirmation API for mocked flow
- [ ] Payment webhook handler shape for production flow
- [ ] Idempotent payment confirmation behavior
- [ ] Failed payment handling
- [ ] Expired reservation payment rejection
- [ ] Booking confirmation after verified payment
- [ ] Ticket code or QR-ready token generation
- [ ] Customer booking list
- [ ] Customer booking detail/ticket screen

Important production behavior:

- [ ] If payment succeeds but the user's internet disconnects, the backend should still confirm the booking through payment verification or webhook processing.
- [ ] The frontend success response should not be the source of truth for confirmed booking.
- [ ] Retried payment callbacks or webhooks must not create duplicate bookings or tickets.

Exit criteria:

- [ ] A customer can complete mocked payment and view confirmed tickets.
- [ ] Retrying payment confirmation does not create duplicate bookings.
- [ ] Expired reservations cannot be paid.
- [ ] Tickets can be fetched later even if the customer lost network during payment completion.

## Phase 6: Admin, Validation, And Operations

Goal: complete the product loop with admin visibility, staff validation, operational auditability, and a demo-ready reliability story.

Deliverables:

- [ ] Admin event creation/editing API
- [ ] Admin venue/screen/showtime management APIs
- [ ] Admin event bookings API
- [ ] Admin inventory API with available, reserved, and sold counts
- [ ] Seat blocking/unblocking support
- [ ] Staff ticket validation API
- [ ] Check-in table
- [ ] Duplicate check-in prevention
- [ ] Invalid/cancelled/expired ticket states
- [ ] Audit log table and service
- [ ] Audit events for reservation, payment, booking, ticket, and admin operations
- [ ] Background worker or script for reservation expiry/release
- [ ] Manual smoke test checklist
- [ ] Concurrent booking test or script
- [ ] Load test script for reservation/seat conflicts
- [ ] README sections for setup, demo flow, and concurrency explanation

Exit criteria:

- [ ] Admin can see live inventory and bookings for an event or showtime.
- [ ] Staff can validate a ticket once and duplicate check-in is blocked.
- [ ] The repo has a documented demo flow and concurrency proof.
- [ ] Audit logs make important business actions traceable.

## Phase 7: Production Hardening

Goal: make the backend closer to a real-world booking system beyond the demo path.

Deliverables:

- [ ] Real authentication plan replacing demo auth
- [ ] Rate limiting for reservation and payment endpoints
- [ ] Request IDs and structured logs
- [ ] Metrics for reservations, conflicts, payments, and check-ins
- [ ] Error reporting
- [ ] Webhook signature verification
- [ ] Idempotency table with request hash and stored response
- [ ] Redis-unavailable fallback behavior
- [ ] Payment reconciliation logs
- [ ] Notification hooks for email/SMS/push
- [ ] Refund and cancellation foundations

Exit criteria:

- [ ] The system has clear production safeguards around money, inventory, retries, and observability.
- [ ] Critical business actions are traceable and replay-safe.
- [ ] Load/concurrency tests can be run locally and explained in the README.

## Non-Goals For The First Demo Slice

These are intentionally outside the earliest demo slice, but not outside the product direction:

- Real payment provider integration
- Full refund automation
- Push/SMS/email notification delivery
- Full analytics dashboard
- Production deployment hardening
- Multi-region scaling

Important: seat maps and seat-level selection are no longer long-term non-goals. They are part of the BookMyShow-aligned roadmap and should be introduced after the current booking core is concurrency-safe.

## Target Users

## Customer

The customer can browse events, reserve tickets or seats, complete payment, view confirmed tickets, and see clear states when inventory is unavailable or a reservation expires.

## Admin

The admin can create events, manage venues/screens/showtimes, manage ticket or seat inventory, block seats, and view booking and inventory state.

## Staff

Staff can validate ticket codes, check tickets in once, and see invalid, cancelled, expired, or already checked-in states.

## Recommended MVP Stack

- React Native mobile app for customer flows
- Node.js backend API
- PostgreSQL database
- Prisma ORM
- Redis for temporary holds, expiry assistance, rate limits, and fast availability helpers
- Mock payment provider for demo flow
- Seeded demo accounts
- Optional web/admin UI if time allows

PostgreSQL is required for correctness. Redis improves speed and user experience, but must not be the only double-booking protection.

## Core User Flows

## 1. Browse Events

Customer opens the app and sees upcoming published events.

Required:

- [x] Event list screen
- [x] Event detail screen
- [x] Loading, empty, and error states
- [x] Availability or sold-out indicator
- [ ] Search or simple filtering by city/category if time allows

## 2. Select Tickets Or Seats

Early MVP uses ticket quantities. BookMyShow-aligned MVP evolves to exact seat selection.

Current quantity-based request:

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

Future seat-based request:

```json
{
  "showtimeId": "showtime_id",
  "seatIds": ["seat_h6_id", "seat_h7_id"]
}
```

Required:

- [x] Display ticket type or seat price
- [x] Display remaining quantity or seat status
- [ ] Prevent selecting unavailable inventory in the UI
- [x] Revalidate selected inventory on the server

## 3. Create Reservation

When a customer continues from ticket/seat selection, the backend creates a temporary reservation.

Required behavior:

- [x] Reservation expires after 5 minutes
- [x] Reserved inventory is excluded from availability
- [x] Expired reservations are ignored by availability checks
- [ ] Customer sees a countdown timer
- [x] Backend returns a conflict response if inventory is no longer available
- [x] Backend supports safe retries through idempotency

## 4. Complete Payment

Customer confirms or fails payment from a mock payment screen in the MVP.

Production direction:

- [ ] Payment success should be verified server-side.
- [ ] Payment webhooks should confirm bookings even if the user's internet disconnects.
- [ ] Retried payment confirmation/webhooks must be idempotent.

Required behavior:

- [ ] Successful payment confirms the reservation
- [ ] Failed payment records a failed payment attempt
- [ ] Expired reservations cannot be paid
- [ ] Retrying payment confirmation must not create duplicate bookings

## 5. View Ticket

After payment succeeds, the customer sees a confirmed booking.

Required:

- [ ] Booking ID
- [ ] Event name, date, venue, showtime, and seat/ticket details
- [ ] Payment status
- [ ] Ticket code or QR-ready token
- [ ] Check-in status

## 6. Validate Ticket

Staff enters or scans a ticket code and checks the customer in.

Required behavior:

- [ ] Valid confirmed ticket can be checked in once
- [ ] Duplicate check-in is blocked
- [ ] Cancelled, expired, unknown, or invalid tickets are rejected
- [ ] Check-in timestamp is stored

## 7. Admin Inventory View

Admin can inspect event/showtime inventory and booking state.

Required:

- [ ] Total capacity by ticket type or showtime
- [x] Available count
- [x] Temporarily reserved count
- [ ] Confirmed sold/booked count
- [ ] Expired/cancelled count if useful for debugging
- [ ] Seat-level status once the seat map phase is implemented

## MVP Data Model

Current required tables:

```text
users
venues
events
ticket_types
reservations
reservation_items
```

Near-term booking tables:

```text
payments
bookings
booking_items
check_ins
```

BookMyShow-aligned tables:

```text
screens
seats
showtimes
reservation_seats
tickets
audit_logs
idempotency_keys
```

Recommended reservation statuses:

```text
pending
confirmed
expired
cancelled
```

Recommended booking statuses:

```text
confirmed
cancelled
checked_in
refunded
partially_refunded
```

Recommended payment statuses:

```text
pending
succeeded
failed
expired
refunded
```

Important fields for current flow:

```text
reservations.userId
reservations.status
reservations.expiresAt
reservations.idempotencyKey
reservation_items.ticketTypeId
reservation_items.quantity
```

Important fields for seat-level flow:

```text
screens.venueId
seats.screenId
seats.rowLabel
seats.seatNumber
showtimes.eventId
showtimes.screenId
reservation_seats.reservationId
reservation_seats.showtimeId
reservation_seats.seatId
bookings.reservationId
tickets.bookingId
tickets.seatId
tickets.qrToken
payments.reservationId
payments.status
check_ins.ticketId
check_ins.checkedInAt
```

Important constraints:

- [ ] Confirmed booking should be linked to one reservation.
- [ ] Payment confirmation should be idempotent per reservation/payment attempt.
- [ ] Ticket type sold quantity must never exceed capacity.
- [ ] A seat must not be actively held or booked twice for the same showtime.
- [ ] Ticket code or QR token must be unique.
- [ ] A ticket can be checked in only once.

## MVP API Surface

Current customer endpoints:

```text
GET    /events
GET    /events/:id
POST   /reservations
```

Near-term customer endpoints:

```text
GET    /reservations/:id
POST   /reservations/:id/confirm-payment
POST   /reservations/:id/cancel
GET    /bookings
GET    /bookings/:id
```

BookMyShow-aligned customer endpoints:

```text
GET    /showtimes/:id/seats
POST   /reservations
POST   /payments
POST   /bookings
GET    /tickets/:id
GET    /me/bookings
```

Admin/staff endpoints:

```text
POST   /admin/events
PATCH  /admin/events/:id
POST   /admin/venues/:id/screens
POST   /admin/showtimes
GET    /admin/showtimes/:id/inventory
POST   /admin/seats/:id/block
POST   /admin/check-ins
```

Webhook endpoints:

```text
POST   /webhooks/payments/:provider
```

## Concurrency Requirements

This is the most important part of the MVP.

The backend must prevent two customers from booking more tickets than available capacity, and later must prevent two customers from holding or booking the same seat for the same showtime.

Minimum current implementation:

- [ ] Create reservations inside a PostgreSQL transaction.
- [ ] Lock the relevant `ticket_types` rows during reservation creation.
- [x] Count active reservations where `status = pending` and `expiresAt > now()`.
- [ ] Count confirmed booking items for the ticket type.
- [x] Reject the reservation if requested quantity exceeds remaining capacity.
- [ ] Confirm payment inside a transaction.
- [ ] Make payment confirmation idempotent so repeated requests return the same booking.

Seat-level implementation:

- [ ] Lock requested seats in deterministic ID order.
- [ ] Recalculate active holds/bookings inside the transaction.
- [ ] Reject if any requested seat is held, booked, blocked, or invalid for the showtime.
- [ ] Keep payment provider calls outside inventory-locking transactions.

The README should explain this flow clearly, because it is the main engineering showcase.

## Auth And Demo Accounts

MVP can use seeded demo accounts instead of a full signup flow.

Required roles:

```text
customer
admin
staff
```

Required access rules:

- [ ] Customer can only view their own reservations and bookings.
- [ ] Admin can create/edit events, venues, screens, showtimes, pricing, and inventory.
- [ ] Staff can validate tickets but cannot edit event setup.

## Error States

The MVP should handle these states explicitly:

- [x] Loading
- [x] Empty event list
- [x] Event not found
- [ ] Showtime not found
- [ ] Seat unavailable
- [x] Sold out
- [ ] Reservation expired
- [x] Inventory conflict
- [ ] Payment pending
- [ ] Payment failed
- [ ] Payment succeeded but frontend disconnected
- [x] Unauthorized
- [ ] Duplicate check-in
- [ ] Invalid ticket code

## MVP Demo Script

The current demo should support this flow:

1. Open the customer app.
2. Browse upcoming events.
3. Open an event detail page.
4. Select a ticket quantity.
5. Create a reservation and show the countdown timer.
6. Complete mock payment successfully.
7. View the confirmed booking and ticket code.
8. Open staff/admin validation.
9. Validate the ticket code and mark it checked in.
10. Attempt the same check-in again and show it is blocked.
11. Open admin inventory and show available/reserved/sold counts.

BookMyShow-aligned demo should later support this flow:

1. Select a movie/event.
2. Select venue and showtime.
3. Open a seat map.
4. Select exact seats such as `H6` and `H7`.
5. Create a temporary seat hold.
6. Show another user cannot select the same seats.
7. Complete payment.
8. Simulate frontend disconnect and confirm tickets are still available from booking history.
9. Show QR-ready tickets.
10. Validate tickets as staff.

Optional showcase:

1. Start two reservation requests for the same limited inventory.
2. Show one succeeds and the other receives an inventory conflict.
3. Run a concurrency test proving total reserved/booked inventory never exceeds capacity.

## MVP Testing Checklist

Automated tests or scripts should cover:

- [x] Reservation creation
- [ ] Reservation expiry
- [ ] Double-booking prevention
- [x] Idempotent reservation retry
- [ ] Payment confirmation
- [ ] Idempotent payment retry
- [ ] Duplicate check-in prevention
- [x] Role-based access checks
- [ ] Seat-level conflict once seat maps are implemented
- [ ] Payment webhook replay once payment webhooks are implemented

Manual smoke test:

- [ ] Customer can complete the full booking flow.
- [ ] Expired reservation cannot be paid.
- [x] Sold-out event cannot be reserved.
- [ ] Staff cannot check in the same ticket twice.
- [ ] Admin inventory updates after reservation, payment, expiry, and check-in.
- [ ] Seat map shows available, held, booked, and blocked states once implemented.

## Definition Of Done

The current MVP is done when a reviewer can:

- [x] Run the backend and app locally.
- [x] Browse a seeded event.
- [ ] Reserve tickets with a visible expiry timer.
- [ ] Complete a mock payment.
- [ ] View a confirmed ticket code.
- [ ] Validate that ticket as staff.
- [ ] See duplicate check-in blocked.
- [ ] See inventory counts update correctly.
- [ ] Read the README and understand how double booking is prevented.

The BookMyShow-aligned MVP is done when a reviewer can:

- [ ] Select a venue and showtime.
- [ ] View a seat map.
- [ ] Reserve exact seats.
- [ ] See concurrent seat conflicts handled safely.
- [ ] Complete payment and receive QR-ready tickets.
- [ ] Recover tickets even if the frontend disconnects during payment.
- [ ] See audit logs for critical reservation, payment, booking, and ticket actions.
