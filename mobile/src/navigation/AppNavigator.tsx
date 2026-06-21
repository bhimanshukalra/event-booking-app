import { useState } from "react";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { EventDetailScreen } from "../screens/EventDetailScreen";
import { EventListScreen } from "../screens/EventListScreen";
import { MockPaymentScreen } from "../screens/MockPaymentScreen";
import { ReservationDetailScreen } from "../screens/ReservationDetailScreen";

type ActiveReservation = {
  event: EventDetail;
  reservation: Reservation;
};

type ActiveView = "events" | "eventDetail" | "reservationDetail" | "payment";

export function AppNavigator() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeReservation, setActiveReservation] =
    useState<ActiveReservation | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("events");

  if (activeReservation && activeView === "payment") {
    return (
      <MockPaymentScreen
        event={activeReservation.event}
        onBackToReservation={() => setActiveView("reservationDetail")}
        onSelectTicketsAgain={() => {
          setSelectedEventId(activeReservation.event.id);
          setActiveReservation(null);
          setActiveView("eventDetail");
        }}
        reservation={activeReservation.reservation}
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
      onSelectEvent={(eventId) => {
        setSelectedEventId(eventId);
        setActiveView("eventDetail");
      }}
    />
  );
}
