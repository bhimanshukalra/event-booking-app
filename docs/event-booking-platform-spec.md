# Event Booking Platform Spec

This document is the source of truth for completing the Event Booking Platform project.

## Product Thesis

Build a concurrency-safe event booking platform that feels like a real product, not just a booking form.

The project should demonstrate:

- Full-stack product engineering
- React Native app development
- Backend API design
- PostgreSQL data modeling
- Payment flow thinking
- Seat locking and reservation expiry
- Admin workflows
- Production-minded reliability

## Positioning

Resume/project positioning:

```text
Concurrency-safe event booking platform with event discovery, seat locking, reservation expiry, payments, ticket validation, admin workflows, and live inventory visibility.
```

The goal is to show non-AI product engineering depth alongside AI projects.

## Target Users

### Customer

A customer can:

- Discover events.
- View event details.
- Select tickets or seats.
- Reserve inventory temporarily.
- Complete payment.
- Receive booking confirmation.
- View tickets.
- Cancel booking when allowed.

### Admin / Event Organizer

An admin can:

- Create and edit events.
- Manage ticket types or seat inventory.
- View bookings and orders.
- Validate tickets/check-ins.
- See live inventory and reservation state.
- Cancel/refund bookings when needed.

## Core Stack

Suggested stack:

- React Native for mobile app
- Node.js backend
- PostgreSQL database
- Redis optional for locks/queues
- Payment provider integration or mocked payment flow
- Docker optional but useful

If using a web admin portal:

- Next.js or React web admin

## Core Features

## 1. Event Discovery

Customer-facing features:

- List upcoming events.
- Search events.
- Filter by category, date, city, or availability.
- View event details.
- Show ticket price, venue, schedule, and availability.

Completion checklist:

- [ ] Event list screen exists.
- [ ] Event detail screen exists.
- [ ] Events load from backend API.
- [ ] Empty/loading/error states exist.
- [ ] Events show availability or sold-out state.

## 2. Ticket / Seat Selection

Support either general ticket quantities or seat-level selection.

Minimum acceptable version:

- General admission ticket quantity selection.

Stronger version:

- Seat map or seat-level selection.

Completion checklist:

- [ ] User can select ticket type or seat.
- [ ] User cannot select unavailable inventory.
- [ ] UI clearly shows available, reserved, sold, and selected states.
- [ ] Selection is validated server-side.

## 3. Reservation / Seat Locking

This is the most important feature.

When a user selects inventory, the system should create a temporary reservation.

Reservation behavior:

- Inventory is locked for a short time window.
- Other users cannot book locked inventory.
- Reservation expires if payment is not completed.
- Expired inventory returns to availability.
- Confirmed booking permanently consumes inventory.

Suggested reservation window:

```text
5-10 minutes
```

Completion checklist:

- [ ] Reservation record exists in database.
- [ ] Reservation has `expiresAt`.
- [ ] Reserved inventory is excluded from availability.
- [ ] Expired reservations are ignored or released.
- [ ] User sees countdown timer.
- [ ] Backend prevents double booking under concurrent requests.
- [ ] Conflict response is returned when inventory is no longer available.

## 4. Concurrency Safety

The backend must prevent double booking.

Implementation options:

- PostgreSQL transaction with row-level locks.
- Unique constraints on confirmed booking inventory.
- Reservation status transitions.
- Optional Redis lock for short-lived distributed locking.

Expected statuses:

```text
available
reserved
confirmed
expired
cancelled
```

Completion checklist:

- [ ] Backend validates availability inside a transaction.
- [ ] Two users cannot confirm the same seat/ticket beyond available quantity.
- [ ] Database constraints protect against duplicate confirmed inventory.
- [ ] Concurrent booking test or script exists.
- [ ] README explains how double booking is prevented.

## 5. Payment Flow

Payment can be real or mocked.

Acceptable MVP:

- Mock payment screen.
- Payment succeeds/fails based on test action.
- Successful payment confirms booking.
- Failed payment keeps or releases reservation according to design.

Stronger version:

- Stripe/Razorpay integration in test mode.

Completion checklist:

- [ ] Payment step exists.
- [ ] Successful payment confirms reservation.
- [ ] Failed payment does not create confirmed booking.
- [ ] Expired reservation cannot be paid.
- [ ] Payment event is recorded.
- [ ] Booking confirmation is shown after payment.

## 6. Booking Confirmation

After payment, user should receive a confirmed booking.

Booking should include:

- Booking ID
- Event details
- Ticket/seat details
- Payment status
- QR code or ticket code
- Check-in status

Completion checklist:

- [ ] Confirmed booking is stored.
- [ ] User can view booking details.
- [ ] Ticket code or QR code exists.
- [ ] Booking cannot be duplicated by retrying the same payment confirmation.
- [ ] User can see past bookings.

## 7. Ticket Validation / Check-In

Admin/staff can validate tickets.

Features:

- Search ticket by code.
- Mark ticket as checked in.
- Prevent duplicate check-in.
- Show invalid/cancelled/expired ticket states.

Completion checklist:

- [ ] Admin can validate ticket.
- [ ] Valid ticket can be checked in once.
- [ ] Duplicate check-in is blocked.
- [ ] Cancelled/invalid tickets are rejected.
- [ ] Check-in timestamp is stored.

## 8. Admin Event Management

Admin features:

- Create event.
- Edit event details.
- Manage ticket types/prices/capacity.
- Publish/unpublish event.
- View event orders.
- View live inventory.

Completion checklist:

- [ ] Admin can create events.
- [ ] Admin can update event details.
- [ ] Admin can manage ticket capacity/pricing.
- [ ] Admin can see bookings for an event.
- [ ] Admin can see live availability/reserved/sold counts.

## 9. Cancellations / Refunds

MVP can use mocked refunds.

Features:

- User or admin can cancel booking if allowed.
- Cancelled booking releases inventory only if business rules allow.
- Refund status is tracked.

Completion checklist:

- [ ] Booking can be cancelled.
- [ ] Cancelled booking cannot be checked in.
- [ ] Refund status is stored.
- [ ] Inventory behavior is documented.
- [ ] Admin can view cancelled bookings.

## 10. Auth And Roles

Minimum roles:

```text
customer
admin
staff
```

Completion checklist:

- [ ] Users can sign up/sign in or use seeded demo accounts.
- [ ] Admin-only routes are protected.
- [ ] Staff can validate tickets but not edit event setup unless allowed.
- [ ] Customer can only see their own bookings.

## 11. Notifications

MVP can be simple.

Possible notifications:

- Booking confirmation
- Reservation expiring
- Booking cancelled
- Ticket checked in

Completion checklist:

- [ ] In-app confirmation messages exist.
- [ ] Optional email/mock email notification exists.
- [ ] Notification events are recorded or logged.

## 12. Reliability And Error States

The app should handle failure gracefully.

Required states:

- Loading
- Empty
- Error
- Sold out
- Reservation expired
- Payment failed
- Inventory conflict
- Unauthorized

Completion checklist:

- [ ] Customer screens have loading/error/empty states.
- [ ] Admin screens have loading/error/empty states.
- [ ] Backend returns clear error codes/messages.
- [ ] Reservation expiry is handled clearly in UI.
- [ ] Retry behavior is reasonable.

## Suggested Data Model

Core tables:

```text
users
events
venues
ticket_types
seats
reservations
reservation_items
bookings
booking_items
payments
check_ins
refunds
```

Important fields:

```text
reservations.status
reservations.expires_at
reservations.user_id
reservation_items.ticket_type_id
reservation_items.seat_id
bookings.status
payments.status
check_ins.checked_in_at
```

Important constraints:

- Unique confirmed booking per seat/event.
- Ticket quantity cannot exceed capacity.
- Expired reservation cannot become confirmed.
- Checked-in ticket cannot be checked in twice.

## API Expectations

Suggested endpoints:

```text
GET    /events
GET    /events/:id
POST   /reservations
GET    /reservations/:id
POST   /reservations/:id/confirm-payment
POST   /reservations/:id/cancel
GET    /bookings
GET    /bookings/:id
POST   /admin/events
PATCH  /admin/events/:id
GET    /admin/events/:id/bookings
GET    /admin/events/:id/inventory
POST   /admin/check-ins
POST   /admin/bookings/:id/cancel
```

## Demo Requirements

The final project should include a demo flow.

Demo script:

1. Open event list.
2. View event details.
3. Select ticket/seat.
4. Create reservation.
5. Show countdown and locked inventory.
6. Complete payment.
7. View confirmed ticket.
8. Admin validates ticket.
9. Attempt duplicate check-in and show it is blocked.
10. Show admin inventory/bookings view.

Optional advanced demo:

- Open two sessions.
- Try booking the same seat.
- Show one succeeds and one gets conflict/availability error.

## README Requirements

The README should include:

- Project summary
- Tech stack
- Features
- Architecture diagram or flow
- Data model overview
- Concurrency/seat-locking explanation
- Setup instructions
- Seeded demo accounts
- Demo flow
- Screenshots/GIFs
- Known limitations
- Future improvements

## Testing Requirements

Minimum tests or scripts:

- [ ] Reservation creation test.
- [ ] Expired reservation test.
- [ ] Double-booking prevention test.
- [ ] Payment confirmation test.
- [ ] Ticket validation duplicate check-in test.
- [ ] Role-based access test.

If full automated testing is too much, include:

- [ ] Manual smoke test checklist.
- [ ] Concurrent booking script.

## Completion Checklist

The project can be called completed when all of these are true:

### Product

- [ ] Customer can browse events.
- [ ] Customer can select ticket/seat.
- [ ] Customer can create reservation.
- [ ] Reservation locks inventory.
- [ ] Reservation expires and releases inventory.
- [ ] Customer can complete payment.
- [ ] Customer can view confirmed ticket.
- [ ] Admin can manage events.
- [ ] Admin can view bookings/inventory.
- [ ] Admin/staff can validate ticket.
- [ ] Duplicate check-in is blocked.
- [ ] Cancellation/refund flow exists or is clearly mocked.

### Engineering

- [ ] PostgreSQL schema supports events, reservations, bookings, payments, and check-ins.
- [ ] Backend prevents double booking.
- [ ] Reservation expiry is enforced server-side.
- [ ] Role-based access is enforced.
- [ ] Clear API errors exist.
- [ ] Loading/error/empty states exist.
- [ ] Tests or smoke scripts cover critical flows.

### Showcase

- [ ] README is complete.
- [ ] Screenshots/GIFs are included.
- [ ] Demo flow is documented.
- [ ] Concurrency/seat-locking logic is explained.
- [ ] Known limitations are documented.
- [ ] GitHub repo is public and clean.
- [ ] Project is pinned on GitHub after meaningful code is pushed.

## Definition Of Done

The Event Booking Platform is done when a reviewer can:

1. Read the README and understand the product.
2. Run the app locally.
3. Browse an event.
4. Reserve a ticket/seat.
5. See inventory locked.
6. Complete payment.
7. View confirmed ticket.
8. Validate the ticket as admin/staff.
9. See duplicate booking/check-in prevented.
10. Understand from the code and README how concurrency safety works.

If those are true, the project is strong enough to support the resume.
