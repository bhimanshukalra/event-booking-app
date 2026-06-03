# Event Booking Platform MVP

This MVP turns the full product spec into a focused first release that proves the core engineering story: customers can discover an event, reserve limited inventory safely, pay through a mocked flow, receive a ticket, and have that ticket validated by staff.

## MVP Goal

Build a concurrency-safe event booking platform with:

- Customer event discovery
- General admission ticket selection
- Temporary reservation locking with expiry
- Mock payment confirmation
- Confirmed bookings with ticket codes
- Admin event and inventory visibility
- Staff ticket validation with duplicate check-in prevention

The MVP should feel like a real product, but it should stay narrow enough to finish cleanly.

## MVP Phases

The MVP should be built in phases so each step produces a usable slice and proves one more part of the product.

### Phase 1: Foundation

Goal: establish the backend, database, seed data, and basic customer discovery flow.

Deliverables:

- Project scaffolding for backend and mobile app
- PostgreSQL schema and migrations for users, events, venues, and ticket types
- Seeded demo accounts for customer, admin, and staff roles
- Seeded events with ticket inventory
- Event list API
- Event detail API
- Customer event list screen
- Customer event detail screen
- Basic loading, empty, and error states

Exit criteria:

- A customer can open the app, browse seeded events, and view event details loaded from the backend.
- The backend can distinguish customer, admin, and staff roles through seeded/demo auth.

### Phase 2: Booking Core

Goal: implement the most important engineering proof point: temporary reservation locking that prevents overselling.

Deliverables:

- Ticket quantity selection for general admission ticket types
- Reservation and reservation item tables
- Reservation creation API
- 5-minute reservation expiry window
- Availability calculation that excludes active reservations and confirmed bookings
- PostgreSQL transaction around reservation creation
- Row-level lock on the relevant ticket type during reservation creation
- Conflict response when requested quantity is no longer available
- Reservation detail API
- Countdown timer in the customer app
- Reservation expired UI state

Exit criteria:

- A customer can reserve available tickets and see a countdown timer.
- Expired reservations no longer reduce availability.
- Two concurrent reservation attempts cannot reserve more tickets than capacity.

### Phase 3: Payment And Tickets

Goal: convert reservations into confirmed bookings through a mocked payment flow.

Deliverables:

- Mock payment screen
- Payments table
- Booking and booking item tables
- Payment confirmation API
- Idempotent payment confirmation behavior
- Failed payment handling
- Ticket code generation
- Customer booking list
- Customer booking detail/ticket screen

Exit criteria:

- A customer can complete mocked payment and view a confirmed ticket.
- Retrying payment confirmation does not create duplicate bookings.
- Expired reservations cannot be paid.

### Phase 4: Admin, Validation, And Showcase

Goal: complete the product loop with admin visibility, staff validation, and a demo-ready reliability story.

Deliverables:

- Admin event creation/editing API
- Admin event bookings API
- Admin inventory API with available, reserved, and sold counts
- Staff ticket validation API
- Check-in table
- Duplicate check-in prevention
- Invalid/cancelled/expired ticket states
- Manual smoke test checklist
- Concurrent booking test or script
- README sections for setup, demo flow, and concurrency explanation

Exit criteria:

- Admin can see live inventory and bookings for an event.
- Staff can validate a ticket once and duplicate check-in is blocked.
- The repo has a documented demo flow and concurrency proof.

## Non-Goals

These are intentionally outside the first release:

- Seat map or seat-level selection
- Real payment provider integration
- Email/SMS/push notifications
- Full refund automation
- Multi-venue seating charts
- Advanced analytics
- Production deployment hardening

## Target Users

### Customer

The customer can browse events, reserve tickets, complete a mocked payment, view confirmed tickets, and see clear states when inventory is unavailable or a reservation expires.

### Admin

The admin can create events, manage ticket type capacity and pricing, and view booking and inventory state.

### Staff

Staff can validate ticket codes, check tickets in once, and see invalid, cancelled, expired, or already checked-in states.

## Recommended MVP Stack

- React Native mobile app for customer flows
- Node.js backend API
- PostgreSQL database
- Mock payment provider
- Seeded demo accounts
- Optional web/admin UI if time allows

Redis is not required for the MVP if PostgreSQL transactions and constraints are implemented well.

## Core User Flows

### 1. Browse Events

Customer opens the app and sees upcoming published events.

Required:

- Event list screen
- Event detail screen
- Loading, empty, and error states
- Availability or sold-out indicator
- Search or simple filtering by city/category if time allows

### 2. Select Tickets

MVP uses general admission ticket quantities instead of seat selection.

Required:

- Display ticket type, price, remaining quantity, and max selectable quantity
- Prevent selecting unavailable quantities in the UI
- Revalidate selected quantity on the server

### 3. Create Reservation

When a customer continues from ticket selection, the backend creates a temporary reservation.

Required behavior:

- Reservation expires after 5 minutes
- Reserved tickets are excluded from availability
- Expired reservations are ignored by availability checks
- Customer sees a countdown timer
- Backend returns a conflict response if inventory is no longer available

### 4. Complete Mock Payment

Customer confirms or fails payment from a mock payment screen.

Required behavior:

- Successful payment confirms the reservation
- Failed payment records a failed payment attempt
- Expired reservations cannot be paid
- Retrying payment confirmation must not create duplicate bookings

### 5. View Ticket

After payment succeeds, the customer sees a confirmed booking.

Required:

- Booking ID
- Event name, date, venue, and ticket details
- Payment status
- Ticket code or QR-ready token
- Check-in status

### 6. Validate Ticket

Staff enters or scans a ticket code and checks the customer in.

Required behavior:

- Valid confirmed ticket can be checked in once
- Duplicate check-in is blocked
- Cancelled, expired, unknown, or invalid tickets are rejected
- Check-in timestamp is stored

### 7. Admin Inventory View

Admin can inspect event inventory and booking state.

Required:

- Total capacity by ticket type
- Available count
- Temporarily reserved count
- Confirmed sold count
- Expired/cancelled count if useful for debugging

## MVP Data Model

Required tables:

```text
users
events
venues
ticket_types
reservations
reservation_items
bookings
booking_items
payments
check_ins
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
```

Recommended payment statuses:

```text
pending
succeeded
failed
```

Important fields:

```text
reservations.user_id
reservations.status
reservations.expires_at
reservation_items.ticket_type_id
reservation_items.quantity
bookings.reservation_id
bookings.user_id
bookings.status
booking_items.ticket_type_id
booking_items.quantity
booking_items.ticket_code
payments.reservation_id
payments.status
check_ins.booking_item_id
check_ins.checked_in_at
```

Important constraints:

- Confirmed booking should be linked to one reservation.
- Payment confirmation should be idempotent per reservation.
- Ticket type sold quantity must never exceed capacity.
- Ticket code must be unique.
- A booking item can be checked in only once.

## MVP API Surface

Customer endpoints:

```text
GET    /events
GET    /events/:id
POST   /reservations
GET    /reservations/:id
POST   /reservations/:id/confirm-payment
POST   /reservations/:id/cancel
GET    /bookings
GET    /bookings/:id
```

Admin/staff endpoints:

```text
POST   /admin/events
PATCH  /admin/events/:id
GET    /admin/events/:id/bookings
GET    /admin/events/:id/inventory
POST   /admin/check-ins
```

## Concurrency Requirements

This is the most important part of the MVP.

The backend must prevent two customers from booking more tickets than the available capacity.

Minimum implementation:

- Create reservations inside a PostgreSQL transaction.
- Lock the relevant `ticket_types` row during reservation creation.
- Count active reservations where `status = pending` and `expires_at > now()`.
- Count confirmed booking items for the ticket type.
- Reject the reservation if requested quantity exceeds remaining capacity.
- Confirm payment inside a transaction.
- Make payment confirmation idempotent so repeated requests return the same booking.

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

- Customer can only view their own reservations and bookings.
- Admin can create/edit events and view inventory/bookings.
- Staff can validate tickets but cannot edit event setup.

## Error States

The MVP should handle these states explicitly:

- Loading
- Empty event list
- Event not found
- Sold out
- Reservation expired
- Inventory conflict
- Payment failed
- Unauthorized
- Duplicate check-in
- Invalid ticket code

## MVP Demo Script

The finished MVP should support this demo:

1. Open the customer app.
2. Browse upcoming events.
3. Open an event detail page.
4. Select a general admission ticket quantity.
5. Create a reservation and show the countdown timer.
6. Complete mock payment successfully.
7. View the confirmed booking and ticket code.
8. Open staff/admin validation.
9. Validate the ticket code and mark it checked in.
10. Attempt the same check-in again and show it is blocked.
11. Open admin inventory and show available/reserved/sold counts.

Optional showcase:

1. Start two reservation requests for the same limited ticket inventory.
2. Show one succeeds and the other receives an inventory conflict.

## MVP Testing Checklist

Automated tests or scripts should cover:

- Reservation creation
- Reservation expiry
- Double-booking prevention
- Payment confirmation
- Idempotent payment retry
- Duplicate check-in prevention
- Role-based access checks

Manual smoke test:

- Customer can complete the full booking flow.
- Expired reservation cannot be paid.
- Sold-out event cannot be reserved.
- Staff cannot check in the same ticket twice.
- Admin inventory updates after reservation, payment, expiry, and check-in.

## Definition Of Done

The MVP is done when a reviewer can:

- Run the backend and app locally.
- Browse a seeded event.
- Reserve tickets with a visible expiry timer.
- Complete a mock payment.
- View a confirmed ticket code.
- Validate that ticket as staff.
- See duplicate check-in blocked.
- See inventory counts update correctly.
- Read the README and understand how double booking is prevented.
