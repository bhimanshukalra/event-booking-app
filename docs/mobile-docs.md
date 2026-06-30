# Mobile Docs

Last updated: 2026-06-30

This document is a living snapshot of the mobile app code as it exists now. Update it when mobile behavior, API contracts, navigation, styling, or known gaps change.

## Summary

The mobile app is an Expo + React Native + TypeScript app for the customer-facing event booking flow. It currently supports:

- Event discovery from the backend API.
- Event detail and ticket availability display.
- Quantity selection for available ticket types.
- Pending reservation creation against the backend.
- Reservation countdown and expiry UI.
- Mock payment success/failure flow.
- Mock ticket display after payment succeeds.
- In-memory booking list for the current app session.

The app talks to the backend for events and reservation holds. Payment, booking confirmation, and ticket issuance are mocked locally and are not persisted to the backend yet.

## Runtime And Tooling

Mobile location: `mobile/`

Main stack:

- Expo 56.
- React 19.
- React Native 0.85.
- TypeScript in strict mode.
- NativeWind and Tailwind CSS for styling.
- React Native Safe Area Context.
- Expo Status Bar.

Primary commands:

```bash
pnpm --dir mobile run start
pnpm --dir mobile run ios
pnpm --dir mobile run android
pnpm --dir mobile run web
pnpm --dir mobile exec tsc --noEmit
```

Required environment:

- `EXPO_PUBLIC_API_URL`, defaulting in code to `http://localhost:4000` when absent.

The example file is `mobile/.env.example`.

## Application Entry Point

`mobile/App.tsx` imports the global NativeWind CSS, wraps the app in `SafeAreaProvider`, sets a dark Expo status bar style, and renders `AppNavigator`.

`mobile/index.ts` is the Expo entry point through the package `main` field.

Expo app configuration lives in `mobile/app.json`:

- App name and slug are both `mobile`.
- Orientation is portrait.
- Light UI style.
- iOS tablet support is enabled.
- Android adaptive icons are configured.
- Web uses Metro and a favicon.

## Navigation

Navigation is implemented manually in `mobile/src/navigation/AppNavigator.tsx` with React state rather than a navigation library.

Current view states:

- `events`
- `bookings`
- `eventDetail`
- `reservationDetail`
- `payment`
- `ticket`

Navigator state:

- `selectedEventId`
- `activeReservation`
- `bookings`
- `activeView`

The flow is:

1. Event list.
2. Event detail.
3. Reservation detail after backend reservation creation.
4. Mock payment.
5. Mock ticket detail after payment succeeds.
6. Optional booking list for confirmed mock bookings in the current app session.

Bookings are held only in React state. They disappear when the app reloads.

## API Layer

API base URL:

- Defined in `mobile/src/api/config.ts`.
- Uses `EXPO_PUBLIC_API_URL` with trailing slash removed.
- Falls back to `http://localhost:4000`.

Event API:

- `getEvents()` calls `GET /events`.
- `getEvent(eventId)` calls `GET /events/:id`.
- Typed contracts include event list items, event detail, ticket types, and availability status.
- Non-2xx responses try to read the backend error message before falling back to generic copy.

Reservation API:

- `createReservation(items)` calls `POST /reservations`.
- Sends a generated idempotency key for each request.
- Always sends `x-demo-user-email: customer@eventbooking.local`.
- Converts backend error statuses into user-facing reservation messages.
- Throws `ReservationApiError` with an optional status code.

The mobile app currently does not call backend endpoints for:

- Authentication/user selection.
- Payment confirmation.
- Reservation confirmation.
- Ticket creation.
- Booking history.

## Screens

### Event List

Files:

- `mobile/src/screens/EventListScreen/EventListScreen.tsx`
- `mobile/src/screens/EventListScreen/useEventList.ts`
- `mobile/src/screens/EventListScreen/components/EventCard.tsx`
- `mobile/src/screens/EventListScreen/components/EventListHeader.tsx`

Behavior:

- Loads events on mount.
- Supports pull-to-refresh.
- Shows loading, error, empty, and populated states.
- Displays category, availability status, title, date, venue/city, and minimum price.
- Header includes a `My bookings` button with the in-memory booking count.

### Event Detail

File: `mobile/src/screens/EventDetailScreen.tsx`

Behavior:

- Loads event detail by selected event ID.
- Shows venue and event description.
- Lists ticket types with price, availability, capacity, sold-out state, and temporarily held count.
- Lets the user increment/decrement ticket quantities up to available quantity.
- Clamps selected quantities when refreshed availability drops.
- Creates a backend reservation with the selected items.
- Clears selection on successful reservation creation.
- Refreshes event availability after reservation attempts.
- Shows conflict-specific copy for `409` reservation failures.

### Reservation Detail

File: `mobile/src/screens/ReservationDetailScreen.tsx`

Behavior:

- Displays the pending reservation, event metadata, selected tickets, total price, reservation ID, and hold expiry time.
- Uses `CountdownTimer` until `reservation.expiresAt`.
- Switches to an expired state when the countdown reaches zero.
- Disables payment continuation after local expiry.

Important boundary:

- Expiry is enforced visually in the app, but the screen does not tell the backend to mark the reservation expired.

### Mock Payment

File: `mobile/src/screens/MockPaymentScreen.tsx`

Behavior:

- Shows amount due, order lines, and the reservation countdown.
- Supports `Pay now` and `Decline`.
- `Pay now` simulates processing for 800ms, then treats payment as succeeded.
- `Decline` sets local failed state and allows retry while the reservation hold is active.
- Expired reservations show an expired state and route the user back to ticket selection.

Important boundary:

- No payment API is called.
- No backend reservation confirmation is called.

### Ticket Detail

File: `mobile/src/screens/TicketDetailScreen.tsx`

Behavior:

- Shows a mock ticket after local payment success.
- Generates `bookingId` as `mock-<reservation.id>`.
- Generates `ticketCode` from the last 8 characters of the reservation ID.
- Shows payment status as `succeeded` and check-in status as `not checked in`.
- Lists ticket lines and confirmed total.

Important boundary:

- The ticket is locally generated and not backed by a persisted ticket record.

### Booking List

File: `mobile/src/screens/BookingListScreen.tsx`

Behavior:

- Shows confirmed mock bookings from the current app session.
- Displays an empty state when no local bookings exist.
- Lets the user reopen a mock ticket detail screen for a local booking.

Important boundary:

- Booking history is not loaded from the backend or persistent storage.

## Shared Components

Shared components live in `mobile/src/components/`.

Current components:

- `LoadingState`: centered spinner and label.
- `ErrorState`: warning panel with retry button.
- `EmptyState`: simple empty panel.
- `CountdownTimer`: countdown display with progress bar and `onExpire` callback.
- `ReservationExpiredState`: reusable expired-hold panel with optional action.

`CountdownTimer` accepts `Date` or timestamp values for `expiresAt` and `startedAt`. It ticks every second and calls `onExpire` once when time reaches zero.

## Styling

Styling is primarily NativeWind class names.

Configuration:

- `mobile/babel.config.js` enables Expo and NativeWind Babel presets.
- `mobile/metro.config.js` wraps Metro with NativeWind and uses `mobile/global.css`.
- `mobile/tailwind.config.js` defines the app color tokens.
- `mobile/src/utils/cn.ts` combines `clsx` and `tailwind-merge`.
- `mobile/src/theme/colors.ts` currently exposes only `brand` for imperative React Native APIs such as spinners and refresh controls.

The current palette is centered on:

- Green brand colors.
- Light app background.
- Ink/body/muted text colors.
- Warning, danger, sold-out, success, border, and timer states.

## State Management

The app uses local React state only.

Current state boundaries:

- Event list and detail are fetched from the backend as needed.
- Reservation data comes from the backend create-reservation response.
- Active reservation is stored in `AppNavigator` state.
- Confirmed bookings are stored in `AppNavigator` state.
- Payment status is local to `MockPaymentScreen`.
- Ticket codes and booking IDs are generated locally in `TicketDetailScreen`.

There is no global store, persistent storage, cache library, or navigation persistence.

## Current User Flow

1. User opens the event list.
2. App fetches published upcoming events from the backend.
3. User selects an event.
4. App fetches event detail and ticket availability.
5. User selects ticket quantities.
6. App creates a pending reservation as the seeded demo customer.
7. User sees the reservation countdown.
8. User continues to mock payment.
9. User can simulate success or failure.
10. On success, app stores a local confirmed booking and shows a mock ticket.
11. User can view the mock ticket from the in-memory booking list.

## Tests And Verification

There are currently no mobile test files in the app.

Current available verification is TypeScript checking:

```bash
pnpm --dir mobile exec tsc --noEmit
```

The root `pnpm run check` command includes mobile TypeScript checking through `pnpm run mobile:typecheck`.

## Current Gaps And Non-Goals

These are not implemented in the current mobile app:

- Production authentication.
- Demo user selection UI.
- Persistent login/session state.
- Navigation library integration.
- Deep links.
- Backend-backed booking history.
- Backend reservation confirmation after payment.
- Real payment integration.
- Backend-issued tickets.
- Ticket QR/barcode rendering.
- Ticket validation/check-in flow.
- Offline mode or persistent cache.
- Automated unit, integration, or end-to-end tests.
- Accessibility audit beyond basic `accessibilityRole` and selected labels.
- Internationalization/localization.

## Update Checklist

When refreshing this document, check:

- `mobile/App.tsx` for app shell changes.
- `mobile/src/navigation/AppNavigator.tsx` for flow and state changes.
- `mobile/src/api/**` for backend contract changes.
- `mobile/src/screens/**` for user-facing behavior changes.
- `mobile/src/components/**` for shared state/UI changes.
- `mobile/tailwind.config.js` and `mobile/src/theme/**` for styling changes.
- `mobile/package.json` for tooling and dependency changes.
