import { useState } from "react";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import {
  BookingListScreen,
  type ConfirmedBooking,
} from "../screens/BookingListScreen";
import { EventDetailScreen } from "../screens/EventDetailScreen";
import { EventListScreen } from "../screens/EventListScreen";
import { MockPaymentScreen } from "../screens/MockPaymentScreen";
import { ReservationDetailScreen } from "../screens/ReservationDetailScreen";
import { TicketDetailScreen } from "../screens/TicketDetailScreen";

type ActiveReservation = {
  event: EventDetail;
  reservation: Reservation;
};

type ActiveView =
  | "events"
  | "bookings"
  | "eventDetail"
  | "reservationDetail"
  | "payment"
  | "ticket";

export function AppNavigator() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeReservation, setActiveReservation] =
    useState<ActiveReservation | null>(null);
  const [bookings, setBookings] = useState<ConfirmedBooking[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("events");

  function addConfirmedBooking(booking: ConfirmedBooking) {
    setBookings((current) => [
      booking,
      ...current.filter(
        (candidate) =>
          candidate.reservation.id !== booking.reservation.id,
      ),
    ]);
  }

  if (activeReservation && activeView === "payment") {
    return (
      <MockPaymentScreen
        event={activeReservation.event}
        onBackToReservation={() => setActiveView("reservationDetail")}
        onPaymentSucceeded={() => {
          addConfirmedBooking({
            confirmedAt: new Date().toISOString(),
            event: activeReservation.event,
            reservation: activeReservation.reservation,
          });
          setActiveView("ticket");
        }}
        onSelectTicketsAgain={() => {
          setSelectedEventId(activeReservation.event.id);
          setActiveReservation(null);
          setActiveView("eventDetail");
        }}
        reservation={activeReservation.reservation}
      />
    );
  }

  if (activeReservation && activeView === "ticket") {
    return (
      <TicketDetailScreen
        event={activeReservation.event}
        onBackToBookings={
          bookings.length > 0 ? () => setActiveView("bookings") : undefined
        }
        onBackToEvent={() => {
          setSelectedEventId(activeReservation.event.id);
          setActiveReservation(null);
          setActiveView("eventDetail");
        }}
        onBackToEvents={() => {
          setSelectedEventId(null);
          setActiveReservation(null);
          setActiveView("events");
        }}
        reservation={activeReservation.reservation}
      />
    );
  }

  if (activeView === "bookings") {
    return (
      <BookingListScreen
        bookings={bookings}
        onBackToEvents={() => setActiveView("events")}
        onSelectBooking={(booking) => {
          setActiveReservation({
            event: booking.event,
            reservation: booking.reservation,
          });
          setActiveView("ticket");
        }}
      />
    );
  }

  if (activeReservation && activeView === "reservationDetail") {
    return (
      <ReservationDetailScreen
        event={activeReservation.event}
        onBackToEvent={() => {
          setSelectedEventId(activeReservation.event.id);
          setActiveReservation(null);
          setActiveView("eventDetail");
        }}
        onBackToEvents={() => {
          setSelectedEventId(null);
          setActiveReservation(null);
          setActiveView("events");
        }}
        onContinueToPayment={() => setActiveView("payment")}
        reservation={activeReservation.reservation}
      />
    );
  }

  if (selectedEventId && activeView === "eventDetail") {
    return (
      <EventDetailScreen
        eventId={selectedEventId}
        onBack={() => {
          setSelectedEventId(null);
          setActiveView("events");
        }}
        onReservationCreated={(reservation, event) => {
          setActiveReservation({
            event,
            reservation,
          });
          setActiveView("reservationDetail");
        }}
      />
    );
  }

  return (
    <EventListScreen
      bookingCount={bookings.length}
      onSelectEvent={(eventId) => {
        setSelectedEventId(eventId);
        setActiveView("eventDetail");
      }}
      onViewBookings={() => setActiveView("bookings")}
    />
  );
}
