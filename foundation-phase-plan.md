# Foundation Phase Plan

This document breaks MVP Phase 1 into smaller phases and implementation steps. The goal is to create a working foundation for the Event Booking Platform before building reservation locking, payment, tickets, and validation.

Foundation is done when a customer can open the app, browse seeded events, view event details from the backend, and the backend can distinguish customer, admin, and staff demo roles.

## Foundation Goal

Establish the project structure, backend API, PostgreSQL schema, seed data, demo auth, and first customer-facing screens.

## Phase 1.1: Project Setup

Goal: create the basic workspace structure and local development workflow.

Steps:

- [x] Create backend project.
- [x] Create React Native mobile app project.
- [x] Add shared environment variable examples.
- [x] Add local development scripts.
- [x] Add formatting and linting setup.
- [x] Add a root README with basic setup notes.
- [x] Decide whether the admin surface starts as API-only or a simple web/admin UI.

Suggested backend structure:

```text
backend/
  src/
  migrations/
  seeds/
  tests/
```

Suggested mobile structure:

```text
mobile/
  src/
    screens/
    components/
    api/
    navigation/
```

Exit criteria:

- [x] Backend can start locally.
- [x] Mobile app can start locally.
- [x] README explains how to run both.

## Phase 1.2: Database Foundation

Goal: create the initial PostgreSQL schema needed for event discovery and demo roles.

Steps:

- [x] Add database connection configuration.
- [x] Add migration tooling.
- [x] Create `users` table.
- [x] Create `venues` table.
- [x] Create `events` table.
- [x] Create `ticket_types` table.
- [x] Add indexes for published upcoming events.
- [x] Add basic timestamp fields.
- [x] Add seed script.

Required tables:

```text
users
venues
events
ticket_types
```

Suggested `users` fields:

```text
id
name
email
role
created_at
updated_at
```

Suggested `venues` fields:

```text
id
name
address
city
state
country
created_at
updated_at
```

Suggested `events` fields:

```text
id
venue_id
title
description
category
starts_at
ends_at
status
hero_image_url
created_at
updated_at
```

Suggested `ticket_types` fields:

```text
id
event_id
name
description
price_cents
currency
capacity
created_at
updated_at
```

Exit criteria:

- [x] Migrations can create the foundation schema from scratch.
- [x] Seed script creates demo users, venues, events, and ticket types.
- [x] Database can be reset locally without manual SQL.

## Phase 1.3: Demo Auth And Roles

Goal: support role-aware API access without spending MVP time on full production authentication.

Steps:

- [x] Seed one customer account.
- [x] Seed one admin account.
- [x] Seed one staff account.
- [x] Add simple demo login or demo user selection endpoint.
- [x] Add request middleware that attaches the active user.
- [x] Add role guard helpers for admin and staff routes.
- [x] Add unauthorized and forbidden API responses.

Required roles:

```text
customer
admin
staff
```

Exit criteria:

- [x] API requests can run as customer, admin, or staff.
- [x] Admin-only routes reject customer users.
- [x] Staff-only routes reject customer users.

## Phase 1.4: Event Discovery API

Goal: expose event data needed by the customer app.

Steps:

- [x] Create `GET /events`.
- [x] Create `GET /events/:id`.
- [x] Return only published upcoming events by default.
- [x] Include venue details in event responses.
- [x] Include ticket type summary in event detail responses.
- [x] Include simple availability fields based on ticket type capacity.
- [x] Add loading-safe and error-safe response shapes.
- [x] Add basic API tests or request examples.

Required endpoints:

```text
GET /events
GET /events/:id
```

Recommended event list response fields:

```text
id
title
category
startsAt
venueName
city
heroImageUrl
minPriceCents
currency
availabilityStatus
```

Recommended event detail response fields:

```text
id
title
description
category
startsAt
endsAt
venue
ticketTypes
availabilityStatus
```

Exit criteria:

- [x] Event list returns seeded published events.
- [x] Event detail returns one event with venue and ticket type data.
- [x] Unknown event IDs return a clear not-found response.

## Phase 1.5: Customer App Foundation

Goal: build the first mobile app screens for browsing events.

Steps:

- [ ] Add app navigation.
- [ ] Add API client module.
- [ ] Add event list screen.
- [ ] Add event detail screen.
- [ ] Add event list loading state.
- [ ] Add event list empty state.
- [ ] Add event list error state.
- [ ] Add event detail loading state.
- [ ] Add event detail not-found/error state.
- [ ] Display ticket type summary on event detail.

Required screens:

```text
EventListScreen
EventDetailScreen
```

Exit criteria:

- [ ] Customer can open the app and see seeded events.
- [ ] Customer can tap an event and view details.
- [ ] Screens handle loading, empty, and error states cleanly.

## Phase 1.6: Foundation Verification

Goal: make sure the foundation is reliable enough to build booking on top of it.

Steps:

- [ ] Run backend linting.
- [x] Run backend tests or API smoke checks.
- [ ] Run mobile linting.
- [ ] Manually launch the customer app.
- [x] Verify event list loads from the backend.
- [x] Verify event detail loads from the backend.
- [x] Verify seeded demo users exist.
- [ ] Verify role guards work for protected placeholder routes.
- [ ] Update README setup notes.

Exit criteria:

- [ ] A new developer can follow the README and run the foundation locally.
- [ ] The customer event discovery flow works end to end.
- [ ] The codebase is ready for Phase 2: Booking Core.

## Foundation Deliverables

- [x] Backend project scaffold
- [x] Mobile app scaffold
- [x] PostgreSQL migrations
- [x] Seed data
- [ ] Demo auth and roles
- [x] Event list API
- [x] Event detail API
- [ ] Customer event list screen
- [ ] Customer event detail screen
- [ ] Basic README setup instructions

## Out Of Scope For Foundation

- Reservation creation
- Reservation expiry
- Concurrency-safe locking
- Payment flow
- Booking confirmation
- Ticket code generation
- Staff check-in
- Admin inventory dashboard
